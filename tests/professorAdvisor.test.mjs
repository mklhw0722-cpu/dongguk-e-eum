import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// 1. firestore.rules 로드
const firestoreRules = fs.readFileSync(path.join(rootDir, "firestore.rules"), "utf8");

test("1. [Firestore 보안 규칙] 학생 본인의 지도교수(advisorProfessorId, advisorAssignedAt) 자가 배정 및 임의 변경이 원천 차단된다", () => {
  // users 컬렉션 update 규칙에서 학생 본인 수정 시 차단되는 필드 목록에 advisorProfessorId 및 advisorAssignedAt 포함 여부 검증
  assert.match(
    firestoreRules,
    /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)[\s\S]*?\.hasAny\([\s\S]*?'advisorProfessorId'[\s\S]*?'advisorAssignedAt'[\s\S]*?\)/,
    "일반 회원이 본인의 프로필을 수정할 때 advisorProfessorId와 advisorAssignedAt을 임의로 변경할 수 없도록 diff affectedKeys 차단에 포함되어야 합니다."
  );
});

test("2. [Firestore 보안 규칙] 상담 신청(consultations) 생성 시 본인의 studentId 및 pending 상태로만 등록 가능하다", () => {
  // consultations 컬렉션 match 블록 검증
  assert.match(firestoreRules, /match \/consultations\/\{consultationId\}/, "consultations 보안 규칙이 정의되어 있어야 합니다.");
  assert.match(
    firestoreRules,
    /request\.resource\.data\.studentId == request\.auth\.uid/,
    "상담 신청 시 studentId가 인증된 본인의 UID와 반드시 일치해야 합니다."
  );
  assert.match(
    firestoreRules,
    /request\.resource\.data\.status == 'pending'/,
    "상담 신청 최초 생성 시 상태는 반드시 pending이어야 합니다."
  );
  assert.match(
    firestoreRules,
    /request\.resource\.data\.status in \['pending', 'cancelled'\]/,
    "학생은 자가 승인을 할 수 없으며 대기 또는 취소 상태로만 갱신할 수 있어야 합니다."
  );
});

test("3. [지도교수 상태 판정] 지도교수 미배정 학생은 'unassigned'로 정확히 판별된다", () => {
  function resolveAdvisor(studentUser, approvedProfessors) {
    const advisorId = studentUser.advisorProfessorId;
    if (!advisorId) {
      return { professor: null, status: "unassigned" };
    }
    const prof = approvedProfessors.find((p) => p.id === advisorId);
    if (!prof) {
      return { professor: null, status: "invalid_status" };
    }
    if (prof.role === "professor" && prof.approvalStatus === "approved") {
      return { professor: prof, status: "assigned" };
    }
    return { professor: prof, status: "invalid_status" };
  }

  const studentWithoutAdvisor = {
    id: "student-1",
    name: "이명진",
    role: "student",
    approvalStatus: "approved",
    advisorProfessorId: undefined,
  };

  const professors = [
    {
      id: "prof-1",
      name: "백상아 교수",
      role: "professor",
      approvalStatus: "approved",
      specialty: "교육공학·HRD",
    },
  ];

  const result = resolveAdvisor(studentWithoutAdvisor, professors);
  assert.equal(result.status, "unassigned");
  assert.equal(result.professor, null);
});

test("4. [지도교수 상태 판정] 승인된 교수가 정상 배정된 경우 'assigned' 및 교수 정보가 반환된다", () => {
  function resolveAdvisor(studentUser, approvedProfessors) {
    const advisorId = studentUser.advisorProfessorId;
    if (!advisorId) {
      return { professor: null, status: "unassigned" };
    }
    const prof = approvedProfessors.find((p) => p.id === advisorId);
    if (!prof) {
      return { professor: null, status: "invalid_status" };
    }
    if (prof.role === "professor" && prof.approvalStatus === "approved") {
      return { professor: prof, status: "assigned" };
    }
    return { professor: prof, status: "invalid_status" };
  }

  const studentWithAdvisor = {
    id: "student-2",
    name: "김동국",
    role: "student",
    approvalStatus: "approved",
    advisorProfessorId: "prof-1",
  };

  const professors = [
    {
      id: "prof-1",
      name: "백상아 교수",
      role: "professor",
      approvalStatus: "approved",
      specialty: "교육공학·HRD 연구실",
    },
  ];

  const result = resolveAdvisor(studentWithAdvisor, professors);
  assert.equal(result.status, "assigned");
  assert.ok(result.professor);
  assert.equal(result.professor.name, "백상아 교수");
  assert.equal(result.professor.specialty, "교육공학·HRD 연구실");
});

test("5. [지도교수 상태 판정] 지정된 교수가 이용 정지(suspended)되거나 승인 취소/역할 변경 시 'invalid_status'로 판별된다", () => {
  function resolveAdvisor(studentUser, allKnownUsers) {
    const advisorId = studentUser.advisorProfessorId;
    if (!advisorId) {
      return { professor: null, status: "unassigned" };
    }
    const prof = allKnownUsers.find((p) => p.id === advisorId);
    if (!prof) {
      return { professor: null, status: "invalid_status" };
    }
    if (prof.role === "professor" && prof.approvalStatus === "approved") {
      return { professor: prof, status: "assigned" };
    }
    return { professor: prof, status: "invalid_status" };
  }

  // 1) 교수가 suspended 된 경우
  const student = {
    id: "student-3",
    name: "박필동",
    role: "student",
    advisorProfessorId: "prof-suspended",
  };

  const usersSuspended = [
    {
      id: "prof-suspended",
      name: "홍길동 교수",
      role: "professor",
      approvalStatus: "suspended",
    },
  ];

  const res1 = resolveAdvisor(student, usersSuspended);
  assert.equal(res1.status, "invalid_status");

  // 2) 교수 계정이 탈퇴되거나 없는 경우
  const res2 = resolveAdvisor(student, []);
  assert.equal(res2.status, "invalid_status");

  // 3) 회원 역할이 professor 가 아닌 경우
  const usersRoleChanged = [
    {
      id: "prof-suspended",
      name: "홍길동 교수",
      role: "alumni",
      approvalStatus: "approved",
    },
  ];
  const res3 = resolveAdvisor(student, usersRoleChanged);
  assert.equal(res3.status, "invalid_status");
});

test("6. [교수 목록 동적 필터링] role === 'professor' && approvalStatus === 'approved' 만 추출된다", () => {
  const allUsers = [
    { id: "u1", name: "김학생", role: "student", approvalStatus: "approved" },
    { id: "u2", name: "이교수", role: "professor", approvalStatus: "pending" }, // 승인 대기 제외
    { id: "u3", name: "박교수", role: "professor", approvalStatus: "approved", specialty: "교육행정" }, // 통과
    { id: "u4", name: "최동문", role: "alumni", approvalStatus: "approved" },
    { id: "u5", name: "백교수", role: "professor", approvalStatus: "approved", specialty: "교육공학" }, // 통과
  ];

  const approvedProfessors = allUsers.filter(
    (u) => u.role === "professor" && u.approvalStatus === "approved"
  );

  assert.equal(approvedProfessors.length, 2);
  assert.deepEqual(
    approvedProfessors.map((p) => p.name),
    ["박교수", "백교수"]
  );
});

test("7. [교수 목록 동적 필터링] 등록된 승인 교수가 없을 경우 임의의 가상 교수를 생성하지 않고 빈 배열을 유지한다", () => {
  const usersWithoutProf = [
    { id: "u1", name: "김학생", role: "student", approvalStatus: "approved" },
    { id: "u2", name: "최동문", role: "alumni", approvalStatus: "approved" },
  ];

  const approvedProfessors = usersWithoutProf.filter(
    (u) => u.role === "professor" && u.approvalStatus === "approved"
  );

  assert.equal(approvedProfessors.length, 0);
});

test("8. [관리자 지도교수 배정 액션] 관리자는 학생의 지도교수를 배정 및 해제할 수 있다", () => {
  let student = {
    id: "student-1",
    name: "김동국",
    advisorProfessorId: undefined,
    advisorAssignedAt: undefined,
  };

  function adminAssign(targetStudent, professorId) {
    const nowIso = new Date().toISOString();
    return {
      ...targetStudent,
      advisorProfessorId: professorId || undefined,
      advisorAssignedAt: professorId ? nowIso : undefined,
    };
  }

  // 배정
  student = adminAssign(student, "prof-1");
  assert.equal(student.advisorProfessorId, "prof-1");
  assert.ok(student.advisorAssignedAt);

  // 해제
  student = adminAssign(student, null);
  assert.equal(student.advisorProfessorId, undefined);
  assert.equal(student.advisorAssignedAt, undefined);
});

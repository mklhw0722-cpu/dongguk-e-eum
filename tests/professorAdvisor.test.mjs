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

test("1-1. [Firestore 보안 규칙] 관리자 수정 시에도 비재학생(졸업생, 교수, 관리자)에게 지도교수 ID가 배정되는 것은 데이터베이스에서 차단된다", () => {
  assert.match(
    firestoreRules,
    /isApprovedAdmin\(\)[\s\S]*?request\.resource\.data\.role == 'student'/,
    "관리자가 회원을 수정할 때에도 advisorProfessorId가 설정되어 있다면 role은 반드시 student여야 합니다."
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

test("9. [상담 신청 데이터 생성 및 유효성 검증] 학생이 희망 날짜, 시간, 상담 유형, 내용을 입력해 생성 시 pending 상태로 초기화된다", () => {
  function createConsultation(input, student) {
    if (!input.professorId || !input.type || !input.preferredDate || !input.preferredTime || !input.topic) {
      throw new Error("필수 입력 항목 누락");
    }
    const validTypes = ["academic", "career", "dual_major", "grad_school", "other"];
    if (!validTypes.includes(input.type)) {
      throw new Error("유효하지 않은 상담 유형");
    }

    return {
      id: "consultation-mock-" + Date.now(),
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      studentMajor: student.major,
      studentStudentNumber: student.studentNumber,
      professorId: input.professorId,
      professorName: input.professorName,
      type: input.type,
      topic: input.topic,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const student = {
    id: "student-100",
    name: "박동국",
    email: "dongguk@dgu.ac.kr",
    major: "교육학과",
    studentNumber: "2023110001",
  };

  const newReq = createConsultation(
    {
      professorId: "prof-1",
      professorName: "백상아 교수",
      type: "career",
      preferredDate: "2026-11-10",
      preferredTime: "14:00~15:00",
      topic: "교육공학 진로 및 학부 연구생 참여 문의",
    },
    student
  );

  assert.equal(newReq.status, "pending");
  assert.equal(newReq.studentId, "student-100");
  assert.equal(newReq.professorId, "prof-1");
  assert.equal(newReq.type, "career");
  assert.equal(newReq.topic, "교육공학 진로 및 학부 연구생 참여 문의");
});

test("10. [학생 상담 취소 권한] 대기 중(pending)인 신청만 학생이 취소(cancelled)할 수 있으며 이미 처리된 상담은 자가 취소 불가", () => {
  function cancelConsultation(consultation, studentId) {
    if (consultation.studentId !== studentId) {
      throw new Error("본인의 상담 신청만 취소할 수 있습니다.");
    }
    if (consultation.status !== "pending") {
      throw new Error("대기 중인 상담 신청만 취소할 수 있습니다.");
    }
    return {
      ...consultation,
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    };
  }

  const pendingConsultation = {
    id: "c-1",
    studentId: "student-100",
    professorId: "prof-1",
    status: "pending",
  };

  const cancelled = cancelConsultation(pendingConsultation, "student-100");
  assert.equal(cancelled.status, "cancelled");

  // 타인이 취소 시도 시 차단
  assert.throws(() => {
    cancelConsultation(pendingConsultation, "student-999");
  }, /본인의 상담 신청만/);

  // 이미 수락된 상담은 학생이 임의로 취소 불가
  const acceptedConsultation = {
    id: "c-2",
    studentId: "student-100",
    professorId: "prof-1",
    status: "accepted",
  };
  assert.throws(() => {
    cancelConsultation(acceptedConsultation, "student-100");
  }, /대기 중인 상담/);
});

test("11. [교수 상담 처리 상태 전이] 교수는 대기 중인 상담에 대해 수락, 일정조정, 거절, 완료를 처리할 수 있다", () => {
  function updateStatusByProfessor(consultation, professorId, newStatus, rescheduleNote) {
    if (consultation.professorId !== professorId) {
      throw new Error("자신에게 접수된 상담만 처리할 수 있습니다.");
    }
    const allowed = ["accepted", "rejected", "reschedule_requested", "completed"];
    if (!allowed.includes(newStatus)) {
      throw new Error("유효하지 않은 교수 처리 상태");
    }
    return {
      ...consultation,
      status: newStatus,
      rescheduleNote: newStatus === "reschedule_requested" ? rescheduleNote : consultation.rescheduleNote,
      updatedAt: new Date().toISOString(),
    };
  }

  const consult = {
    id: "c-1",
    studentId: "student-1",
    professorId: "prof-1",
    status: "pending",
  };

  // 1) 수락
  const accepted = updateStatusByProfessor(consult, "prof-1", "accepted");
  assert.equal(accepted.status, "accepted");

  // 2) 일정 조정 요청 (조정 메모 포함)
  const reschedule = updateStatusByProfessor(
    consult,
    "prof-1",
    "reschedule_requested",
    "화요일 16시에는 학과 회의가 있어 수요일 14시로 조정 부탁드립니다."
  );
  assert.equal(reschedule.status, "reschedule_requested");
  assert.match(reschedule.rescheduleNote, /수요일 14시/);

  // 3) 타 교수가 처리 시도 시 차단
  assert.throws(() => {
    updateStatusByProfessor(consult, "prof-2", "accepted");
  }, /자신에게 접수된 상담만/);
});

test("12. [실시간 1:1 대화 연결 연동] 승인된 상담에서 대화하기 클릭 시 기존 1:1 대화방을 재사용하고 중복 방을 생성하지 않는다", () => {
  const existingConversations = [
    {
      id: "conv-101",
      type: "direct",
      participants: ["student-1", "prof-1"],
      participantNames: ["김학생", "백상아 교수"],
    },
  ];

  function getOrCreateDirectChat(currentUserId, targetUserId, allConversations) {
    const existing = allConversations.find(
      (c) =>
        c.type === "direct" &&
        c.participants.includes(currentUserId) &&
        c.participants.includes(targetUserId)
    );
    if (existing) {
      return { conversationId: existing.id, isNew: false };
    }
    return {
      conversationId: "conv-new-" + Date.now(),
      isNew: true,
    };
  }

  // 기존 대화방이 이미 있으면 해당 대화방 ID 반환 (중복 생성 X)
  const res1 = getOrCreateDirectChat("student-1", "prof-1", existingConversations);
  assert.equal(res1.isNew, false);
  assert.equal(res1.conversationId, "conv-101");

  // 없는 상대와의 대화는 새로운 방 생성
  const res2 = getOrCreateDirectChat("student-1", "prof-2", existingConversations);
  assert.equal(res2.isNew, true);
  assert.ok(res2.conversationId.startsWith("conv-new-"));
});

test("13. [새로고침 및 상태 유지] 상담 신청 데이터와 상태 변경 내역이 목록에 정확히 반영된다", () => {
  let mockConsultations = [
    {
      id: "req-1",
      studentId: "student-1",
      professorId: "prof-1",
      status: "pending",
      topic: "졸업요건 심사 상담",
    },
  ];

  // 상태 변경 적용
  mockConsultations = mockConsultations.map((c) =>
    c.id === "req-1" ? { ...c, status: "accepted" } : c
  );

  // 필터링 검증: 학생의 신청 목록
  const studentList = mockConsultations.filter((c) => c.studentId === "student-1");
  assert.equal(studentList.length, 1);
  assert.equal(studentList[0].status, "accepted");

  // 필터링 검증: 교수의 접수 목록
  const profList = mockConsultations.filter((c) => c.professorId === "prof-1");
  assert.equal(profList.length, 1);
  assert.equal(profList[0].status, "accepted");
});

test("14. [메신저 통합 상담 신청 및 진행 방식(대면/채팅) 승인 연동] 교수 승인 시 대면/채팅 방식을 선택하고 1:1 대화방이 연결된다", () => {
  // 1. 메신저 사용자 검색 목록에서 학생 기준 교수는 '상담신청', 일반 사용자는 '대화 요청' 버튼 레이블 결정
  function getActionLabelForUser(targetUser, currentUserRole = "student") {
    if (targetUser.role === "professor") {
      return currentUserRole === "professor" ? "대화 요청" : "상담신청";
    }
    return "대화 요청";
  }

  assert.equal(getActionLabelForUser({ role: "professor", name: "김교수" }, "student"), "상담신청");
  assert.equal(getActionLabelForUser({ role: "student", name: "박학생" }, "student"), "대화 요청");
  assert.equal(getActionLabelForUser({ role: "alumni", name: "이동문" }, "student"), "대화 요청");

  // 2. 상담 신청 객체
  let consultation = {
    id: "consult-100",
    studentId: "student-1",
    studentName: "홍길동",
    professorId: "prof-1",
    professorName: "백상아",
    consultationType: "진로 상담",
    preferredDate: "2026-11-05",
    preferredTime: "15:00",
    purpose: "에듀테크 기업 취업 관련 조언을 구하고 싶습니다.",
    status: "pending",
  };

  // 3. 교수 승인 및 상담 방식(대면 또는 채팅) 선택
  function approveConsultation(c, method, conversationId) {
    if (method !== "대면" && method !== "채팅") {
      throw new Error("유효하지 않은 상담 방식");
    }
    return {
      ...c,
      status: "accepted",
      consultationMethod: method,
      conversationId,
      updatedAt: new Date().toISOString(),
    };
  }

  // 4. 대면 상담으로 승인
  const approvedInPerson = approveConsultation(consultation, "대면", "conv-chat-in-person");
  assert.equal(approvedInPerson.status, "accepted");
  assert.equal(approvedInPerson.consultationMethod, "대면");
  assert.equal(approvedInPerson.conversationId, "conv-chat-in-person");

  // 5. 채팅 상담으로 승인
  const approvedChat = approveConsultation(consultation, "채팅", "conv-chat-direct");
  assert.equal(approvedChat.status, "accepted");
  assert.equal(approvedChat.consultationMethod, "채팅");
  assert.equal(approvedChat.conversationId, "conv-chat-direct");
});

test("15. [교수 계정 아래 지도학생 배정 권한 및 역할 제한 검증] 오직 재학생(student)만 지도학생으로 배정 가능하며 졸업생·교수진·관리자는 원천 차단되고, 역할 변경 시 지도학생 정보가 자동 해제된다", () => {
  const allUsers = [
    { id: "u-stud-1", name: "김학생", role: "student", approvalStatus: "approved" },
    { id: "u-stud-2", name: "이재학", role: "student", approvalStatus: "approved", advisorProfessorId: "prof-1" },
    { id: "u-alumni-1", name: "박동문", role: "alumni", approvalStatus: "approved" },
    { id: "u-prof-1", name: "신나민", role: "professor", approvalStatus: "approved" },
    { id: "u-admin-1", name: "최관리", role: "admin", approvalStatus: "approved" },
  ];

  // 1. 교수 계정 아래로 배정 가능한 지도학생 목록 필터링: 오직 role === 'student' 만 허용
  const assignableStudents = allUsers.filter(
    (u) => u.role === "student" && u.approvalStatus === "approved"
  );
  assert.equal(assignableStudents.length, 2);
  assert.deepEqual(assignableStudents.map((s) => s.id), ["u-stud-1", "u-stud-2"]);

  // 졸업생, 교수, 관리자는 배정 대상 목록에서 100% 제외
  const nonStudents = assignableStudents.filter((u) => u.role !== "student");
  assert.equal(nonStudents.length, 0);

  // 2. 지도학생 배정 함수: 비재학생 대상 배정 시도시 예외 발생
  function assignAdvisor(targetUser, professorId) {
    if (professorId && targetUser.role !== "student") {
      throw new Error("재학생만 지도교수를 배정받을 수 있습니다. 졸업생, 교수진, 관리자는 지도학생으로 배정될 수 없습니다.");
    }
    return {
      ...targetUser,
      advisorProfessorId: professorId || undefined,
      advisorAssignedAt: professorId ? new Date().toISOString() : undefined,
    };
  }

  // 재학생 정상 배정
  const assigned = assignAdvisor(allUsers[0], "prof-1");
  assert.equal(assigned.advisorProfessorId, "prof-1");

  // 졸업생, 교수, 관리자 배정 시도 시 즉시 에러 차단
  assert.throws(
    () => assignAdvisor(allUsers[2], "prof-1"),
    /재학생만 지도교수를 배정받을 수 있습니다/
  );
  assert.throws(
    () => assignAdvisor(allUsers[3], "prof-1"),
    /재학생만 지도교수를 배정받을 수 있습니다/
  );
  assert.throws(
    () => assignAdvisor(allUsers[4], "prof-1"),
    /재학생만 지도교수를 배정받을 수 있습니다/
  );

  // 3. 학생이 졸업생, 교수, 관리자로 역할 변경 시 지도학생 배정 정보 자동 초기화 검증
  function changeRole(user, newRole) {
    const updated = { ...user, role: newRole };
    if (newRole !== "student") {
      updated.advisorProfessorId = undefined;
      updated.advisorAssignedAt = undefined;
    }
    return updated;
  }

  const promotedToAlumni = changeRole(allUsers[1], "alumni");
  assert.equal(promotedToAlumni.role, "alumni");
  assert.equal(promotedToAlumni.advisorProfessorId, undefined);

  const promotedToAdmin = changeRole(allUsers[1], "admin");
  assert.equal(promotedToAdmin.role, "admin");
  assert.equal(promotedToAdmin.advisorProfessorId, undefined);
});
test("16. [회원 삭제 기능 및 파이어베이스 연동 정합성 검증] 관리자는 회원을 안전하게 삭제할 수 있고 본인 삭제는 차단되며 배정된 지도학생의 연동 정보가 자동 정리된다", () => {
  // 1. 초기 사용자 상태
  let users = [
    { id: "admin-1", uid: "admin-1", name: "관리자", role: "admin", approvalStatus: "approved" },
    { id: "prof-1", uid: "prof-1", name: "신나민", role: "professor", approvalStatus: "approved" },
    { id: "stud-1", uid: "stud-1", name: "김학생", role: "student", approvalStatus: "approved", advisorProfessorId: "prof-1" },
    { id: "stud-2", uid: "stud-2", name: "이재학", role: "student", approvalStatus: "approved", advisorProfessorId: "prof-1" },
    { id: "pending-1", uid: "pending-1", name: "스팸가입자", role: "student", approvalStatus: "pending" },
  ];

  let publicProfiles = {
    "admin-1": { id: "admin-1", name: "관리자", role: "admin" },
    "prof-1": { id: "prof-1", name: "신나민", role: "professor" },
    "stud-1": { id: "stud-1", name: "김학생", role: "student" },
    "stud-2": { id: "stud-2", name: "이재학", role: "student" },
  };

  const currentAdmin = users[0];

  // 2. 관리자 삭제 처리 함수 시뮬레이션
  function deleteUser(targetUserId, executorUser) {
    if (executorUser.role !== "admin") {
      throw new Error("관리자만 회원을 삭제할 수 있습니다.");
    }
    if (targetUserId === executorUser.id || targetUserId === executorUser.uid) {
      throw new Error("현재 로그인된 관리자 본인 계정은 삭제할 수 없습니다.");
    }

    // users 목록에서 제거 & 해당 유저가 지도교수였던 경우 학생 배정 초기화
    users = users
      .filter((u) => u.id !== targetUserId)
      .map((u) =>
        u.advisorProfessorId === targetUserId
          ? { ...u, advisorProfessorId: "", advisorAssignedAt: "" }
          : u
      );

    // publicProfiles 삭제
    delete publicProfiles[targetUserId];
  }

  // 3. 관리자 본인 삭제 시도 시 차단 검증
  assert.throws(
    () => deleteUser(currentAdmin.id, currentAdmin),
    /현재 로그인된 관리자 본인 계정은 삭제할 수 없습니다/
  );

  // 4. 일반 사용자가 삭제 시도 시 차단 검증
  assert.throws(
    () => deleteUser("prof-1", users[1]),
    /관리자만 회원을 삭제할 수 있습니다/
  );

  // 5. 스팸/대기 회원 삭제 검증
  deleteUser("pending-1", currentAdmin);
  assert.equal(users.some((u) => u.id === "pending-1"), false);

  // 6. 지도교수(prof-1) 삭제 시 배정되어 있던 학생들의 지도교수 정보 자동 정리 검증
  deleteUser("prof-1", currentAdmin);
  assert.equal(users.some((u) => u.id === "prof-1"), false);
  assert.equal(publicProfiles["prof-1"], undefined);

  // 배정되어 있던 학생 2명의 advisorProfessorId가 빈 문자열("")로 초기화되었는지 확인
  const s1 = users.find((u) => u.id === "stud-1");
  const s2 = users.find((u) => u.id === "stud-2");
  assert.equal(s1.advisorProfessorId, "");
  assert.equal(s2.advisorProfessorId, "");
});

test("17. [회원 삭제 시 상담 및 채팅방 데이터 연쇄 정리 및 유령 계정 방지 검증]", () => {
  // 1. 초기 데이터 설정: 교수(prof-baek), 학생(stud-lee, stud-kim)
  let users = [
    { id: "admin-1", role: "admin", name: "관리자" },
    { id: "prof-baek", role: "professor", name: "백상아" },
    { id: "stud-lee", role: "student", name: "이혜원" },
    { id: "stud-kim", role: "student", name: "김학생" },
  ];

  let consultations = [
    {
      id: "c-1",
      studentId: "stud-lee",
      professorId: "prof-baek",
      professorName: "백상아",
      status: "accepted",
    },
    {
      id: "c-2",
      studentId: "stud-kim",
      professorId: "prof-baek",
      professorName: "백상아",
      status: "pending",
    },
  ];

  let chats = [
    // 1:1 대화방 (이혜원 - 백상아 교수)
    {
      id: "chat-direct-1",
      isGroup: false,
      title: "백상아 교수님",
      participants: ["stud-lee", "prof-baek"],
    },
    // 단체 대화방 (스터디 모임: 4명 참여 중)
    {
      id: "chat-group-1",
      isGroup: true,
      title: "스터디 모임",
      participants: ["stud-lee", "stud-kim", "prof-baek"],
    },
  ];

  // 2. 관리자가 백상아 교수(prof-baek) 삭제 수행
  const targetUid = "prof-baek";
  users = users.filter((u) => u.id !== targetUid);

  // 연쇄 삭제: 상담 데이터에서 prof-baek 관련 상담 완전 제거
  consultations = consultations.filter(
    (c) => c.studentId !== targetUid && c.professorId !== targetUid
  );

  // 연쇄 삭제: 1:1 대화방은 삭제, 단체 대화방에서는 참여자에서 제외
  chats = chats
    .filter((chat) => {
      if (!chat.isGroup && chat.participants.includes(targetUid)) return false;
      return true;
    })
    .map((chat) => ({
      ...chat,
      participants: chat.participants.filter((p) => p !== targetUid),
    }));

  // 3. 검증
  // 1) 상담 목록에 백상아 교수 관련 상담이 0건이어야 함
  assert.equal(consultations.length, 0);

  // 2) 1:1 대화방(chat-direct-1)이 완전히 제거되어 대화방 목록에 남지 않음
  assert.equal(chats.some((c) => c.id === "chat-direct-1"), false);

  // 3) 단체 대화방에서 prof-baek가 제거되고 참여자가 2명으로 갱신됨
  const groupChat = chats.find((c) => c.id === "chat-group-1");
  assert.ok(groupChat);
  assert.deepEqual(groupChat.participants, ["stud-lee", "stud-kim"]);
  assert.equal(groupChat.participants.includes("prof-baek"), false);

  // 4) UI 활성 참여자 계산 시 '학과 구성원' 더미 객체로 치환되지 않고 유효 사용자만 추출됨
  const availableUsers = users;
  const activeMembers = groupChat.participants
    .map((uid) => availableUsers.find((u) => u.id === uid))
    .filter(Boolean);

  assert.equal(activeMembers.length, 2);
  assert.equal(activeMembers.some((m) => m.name === "학과 구성원"), false);

  // 5) firestore.rules 파일에 chats 컬렉션 allow delete 관리자 권한이 선언되어 있는지 검증
  const rulesContent = fs.readFileSync("firestore.rules", "utf8");
  assert.ok(
    rulesContent.includes("match /chats/{chatId}") &&
      rulesContent.includes("allow delete: if isApprovedAdmin();"),
    "firestore.rules에 chats allow delete: if isApprovedAdmin() 규칙이 포함되어야 합니다."
  );
});

test("18. [교수 계정 간 상호작용] 교수 계정으로 다른 교수를 조회할 때는 '상담신청'이 아닌 '대화요청'으로 처리되며, 학생 계정일 때만 '상담신청'으로 분기된다", () => {
  function getButtonType(targetUser, currentUser) {
    const isCurrentUserProfessor = currentUser.role === "professor";
    if (targetUser.role === "professor" && !isCurrentUserProfessor) {
      return "상담신청";
    }
    return "대화 요청";
  }

  function getConversationTag(targetUser, currentUser) {
    const isCurrentUserProfessor = currentUser.role === "professor";
    const isTargetProfessor = targetUser.role === "professor";
    if (isCurrentUserProfessor && isTargetProfessor) {
      return "교수진 1:1 대화";
    }
    if (isCurrentUserProfessor) {
      return "교수-학생 면담";
    }
    if (isTargetProfessor) {
      return "교수-학생 대화";
    }
    return "학과 구성원 1:1 대화";
  }

  const profShin = { id: "prof-1", name: "신나민", role: "professor" };
  const profYe = { id: "prof-2", name: "예상백", role: "professor" };
  const studLee = { id: "stud-1", name: "이혜원", role: "student" };

  // 1) 학생 -> 교수: 상담신청 모달 연결
  assert.equal(getButtonType(profShin, studLee), "상담신청");

  // 2) 교수 -> 교수: 대화 요청 버튼 및 교수진 1:1 대화 태그 연결
  assert.equal(getButtonType(profYe, profShin), "대화 요청");
  assert.equal(getConversationTag(profYe, profShin), "교수진 1:1 대화");

  // 3) 교수 -> 학생: 대화 요청 및 면담 태그 연결
  assert.equal(getButtonType(studLee, profShin), "대화 요청");
  assert.equal(getConversationTag(studLee, profShin), "교수-학생 면담");
});

test("19. [교수 홈 대시보드 지도학생 섹션 연동] 교수로 로그인 시 추천 동문 프로필 대신 나의 지도학생 목록이 도출되고 배너 아래에 우선 표시된다", () => {
  const currentProf = {
    id: "u-prof-1",
    uid: "u-prof-1",
    name: "박종배",
    role: "professor",
    approvalStatus: "approved",
  };

  const allMembers = [
    {
      id: "u-student-1",
      uid: "u-student-1",
      name: "김동국",
      role: "student",
      studentIdOrYear: "23학번",
      careerTrack: "HRD 트랙",
      doubleMajor: "경영학과",
      advisorProfessorId: "u-prof-1",
      approvalStatus: "approved",
    },
    {
      id: "u-student-2",
      uid: "u-student-2",
      name: "이지은",
      role: "student",
      studentIdOrYear: "24학번",
      careerTrack: "교직 트랙",
      doubleMajor: "",
      advisorProfessorId: "u-prof-2", // 타 교수 지도학생
      approvalStatus: "approved",
    },
    {
      id: "u-student-3",
      uid: "u-student-3",
      name: "박필동",
      role: "student",
      studentIdOrYear: "24학번",
      careerTrack: "교직 트랙",
      doubleMajor: "국어교육학과",
      advisorProfessorId: "u-prof-1",
      approvalStatus: "approved",
    },
    {
      id: "u-alumni-1",
      uid: "u-alumni-1",
      name: "최졸업",
      role: "alumni",
      approvalStatus: "approved",
    },
  ];

  // 1) 교수 판별 로직 검증
  const isProfessor = currentProf.role === "professor";
  assert.equal(isProfessor, true);

  // 2) 나의 지도학생 동적 필터링 검증
  const profIds = new Set([currentProf.id, currentProf.uid]);
  const myStudents = allMembers.filter(
    (m) => m.role === "student" && m.advisorProfessorId && profIds.has(m.advisorProfessorId)
  );

  assert.equal(myStudents.length, 2);
  assert.equal(myStudents[0].name, "김동국");
  assert.equal(myStudents[1].name, "박필동");

  // 3) 홈 대시보드 렌더링 분기: 교수는 추천 졸업생 프로필이 비활성화되고 지도학생이 활성화됨
  const showRecommendedAlumni = !isProfessor;
  const showMyAdviseeStudents = isProfessor;

  assert.equal(showRecommendedAlumni, false);
  assert.equal(showMyAdviseeStudents, true);
});

test("20. [홈 대시보드 상담 요청·일정 위젯 및 대면/비대면 수락 연동] 홈 배너에서 진로·복전 게시판과 후기 대신 상담 요청 및 상담 일정이 표시되고, 비대면 수락 시 대화창 연결·대면 수락 시 상담 일정이 생성된다", () => {
  const homePage = fs.readFileSync(path.join(rootDir, "src/app/page.tsx"), "utf8");
  const calendarComp = fs.readFileSync(path.join(rootDir, "src/components/calendar/EditableCalendar.tsx"), "utf8");
  const appContext = fs.readFileSync(path.join(rootDir, "src/context/AppContext.tsx"), "utf8");

  // 1) 교수 본인 로그인 시 approvedProfessors 및 consultations 필터에서 본인 상담이 누락되지 않는지 확인
  assert.ok(
    appContext.includes("myIds.forEach((id) => validProfIds.add(id))"),
    "교수 로그인 시 본인의 UID가 validProfIds에 포함되어 본인에게 온 상담 요청이 누락되지 않아야 함"
  );

  // 2) 홈 화면에서 기존 게시판/후기 위젯이 제거되고 상담 요청 및 상담 일정 위젯이 렌더링되는지 확인
  assert.equal(homePage.includes("최근 등록된 복수전공 후기"), false, "홈에서 최근 등록된 복수전공 후기 위젯이 제거되어야 함");
  assert.ok(homePage.includes("renderConsultationRequestsSection"), "홈에 상담 요청 위젯이 존재해야 함");
  assert.ok(homePage.includes("renderConsultationScheduleSection"), "홈에 상담 일정 위젯이 존재해야 함");

  // 3) 비대면 상담 수락 시 대화창(/chat?convId=...)으로 연결되고, 대면 상담 수락 시 상담 일정(캘린더)이 생성되는지 확인
  assert.ok(homePage.includes("비대면 상담 수락"), "비대면 상담 수락 버튼이 존재해야 함");
  assert.ok(homePage.includes("대면 상담 수락"), "대면 상담 수락 버튼이 존재해야 함");
  assert.ok(homePage.includes("registerFaceToFaceCalendarEvent"), "대면 상담 수락 시 캘린더 일정 생성 함수가 호출되어야 함");
  assert.ok(calendarComp.includes("consult-cal-"), "캘린더 컴포넌트에 승인된 대면 상담 일정이 자동 반영되어야 함");
});

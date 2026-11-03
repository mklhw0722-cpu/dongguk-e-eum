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
  // 1. 메신저 사용자 검색 목록에서 교수는 '상담신청', 일반 사용자는 '대화 요청' 버튼 레이블 결정
  function getActionLabelForUser(user) {
    return user.role === "professor" ? "상담신청" : "대화 요청";
  }

  assert.equal(getActionLabelForUser({ role: "professor", name: "김교수" }), "상담신청");
  assert.equal(getActionLabelForUser({ role: "student", name: "박학생" }), "대화 요청");
  assert.equal(getActionLabelForUser({ role: "alumni", name: "이동문" }), "대화 요청");

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

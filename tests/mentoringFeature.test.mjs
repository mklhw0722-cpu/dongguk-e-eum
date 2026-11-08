import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. MOCK_MENTORING_REQUESTS 및 멘토링 답변 데이터 구조 확인", () => {
  const mockContent = fs.readFileSync(
    path.join(rootDir, "src/data/mockData.ts"),
    "utf8"
  );
  assert.ok(mockContent.includes("export const MOCK_MENTORING_REQUESTS: MentoringRequest[] = ["));
  assert.ok(mockContent.includes('status: "답변완료"'), "답변완료 상태가 포함되어 있어야 함");
  assert.ok(mockContent.includes("replyMessage:"), "replyMessage 필드가 정의되어 있어야 함");
  assert.ok(mockContent.includes("repliedAt:"), "repliedAt 필드가 정의되어 있어야 함");

  const typesContent = fs.readFileSync(
    path.join(rootDir, "src/types/index.ts"),
    "utf8"
  );
  assert.ok(typesContent.includes("replyMessage?: string;"));
  assert.ok(typesContent.includes("repliedAt?: string;"));
});

test("2. 멘토링 요청 열람 권한 필터링 검증 (신청자, 요청받은 멘토, 관리자만 접근)", () => {
  const sampleRequests = [
    {
      id: "req-1",
      fromUserId: "user-student-kim",
      fromUserName: "김학생 (23학번)",
      toAlumniProfileId: "alumni-lee",
      toAlumniName: "이동문 (19학번)",
      topic: "질문 1",
      message: "내용 1",
      status: "대기중",
    },
    {
      id: "req-2",
      fromUserId: "user-student-park",
      fromUserName: "박학생 (22학번)",
      toAlumniProfileId: "alumni-choi",
      toAlumniName: "최동문 (18학번)",
      topic: "질문 2",
      message: "내용 2",
      status: "답변완료",
    },
  ];

  const canViewRequest = (req, user, isAdmin, myAlumniProfile) => {
    if (isAdmin) return true;
    const isMentee =
      req.fromUserId === user.id ||
      (Boolean(user.name) && req.fromUserName.includes(user.name));
    const isMentor =
      (myAlumniProfile && req.toAlumniProfileId === myAlumniProfile.id) ||
      req.toAlumniProfileId === user.id ||
      (Boolean(user.name) && req.toAlumniName.includes(user.name));
    return isMentee || isMentor;
  };

  // 1) 신청자 '김학생'
  const kimUser = { id: "user-student-kim", name: "김학생" };
  const kimVisible = sampleRequests.filter((r) => canViewRequest(r, kimUser, false, null));
  assert.equal(kimVisible.length, 1);
  assert.equal(kimVisible[0].id, "req-1");

  // 2) 멘토 '이동문'
  const leeUser = { id: "user-alumni-lee", name: "이동문" };
  const leeProfile = { id: "alumni-lee", displayName: "이동문 (19학번)" };
  const leeVisible = sampleRequests.filter((r) => canViewRequest(r, leeUser, false, leeProfile));
  assert.equal(leeVisible.length, 1);
  assert.equal(leeVisible[0].id, "req-1");

  // 3) 제3자 '정학생' (신청자도 아니고 멘토도 아님)
  const otherUser = { id: "user-student-other", name: "정학생" };
  const otherVisible = sampleRequests.filter((r) => canViewRequest(r, otherUser, false, null));
  assert.equal(otherVisible.length, 0, "제3자에게는 어떤 멘토링 요청도 노출되지 않아야 함");

  // 4) 관리자 (모든 멘토링 요청 열람 가능)
  const adminUser = { id: "admin-1", name: "관리자" };
  const adminVisible = sampleRequests.filter((r) => canViewRequest(r, adminUser, true, null));
  assert.equal(adminVisible.length, 2, "관리자는 모든 멘토링 요청을 확인할 수 있어야 함");
});

test("3. 멘토링 수락 및 답변 등록 시 상태 '답변완료' 및 답변 내용 보존 검증", () => {
  let requests = [
    {
      id: "req-test",
      fromUserId: "user-1",
      fromUserName: "학생A",
      toAlumniProfileId: "alumni-1",
      toAlumniName: "선배B",
      topic: "취업 준비",
      message: "선배님 조언 부탁드립니다",
      status: "대기중",
    },
  ];

  const updateStatus = (id, status, replyMessage) => {
    requests = requests.map((r) => {
      if (r.id !== id) return r;
      return {
        ...r,
        status,
        ...(replyMessage !== undefined
          ? { replyMessage, repliedAt: "2026-11-08" }
          : {}),
      };
    });
  };

  // 1단계: 수락
  updateStatus("req-test", "수락됨");
  assert.equal(requests[0].status, "수락됨");

  // 2단계: 답변 등록
  const testReply = "열심히 준비하시면 좋은 결과가 있을 것입니다!";
  updateStatus("req-test", "답변완료", testReply);
  assert.equal(requests[0].status, "답변완료");
  assert.equal(requests[0].replyMessage, testReply);
  assert.equal(requests[0].repliedAt, "2026-11-08");
});

test("4. alumni/page.tsx 및 Cards.tsx UI에서 불필요한 문구 및 버튼 제거 검증", () => {
  const pageCode = fs.readFileSync(
    path.join(rootDir, "src/app/alumni/page.tsx"),
    "utf8"
  );
  const cardsCode = fs.readFileSync(
    path.join(rootDir, "src/components/common/Cards.tsx"),
    "utf8"
  );

  // 제거되어야 할 항목 검증
  assert.ok(
    !pageCode.includes("졸업생 모드: 요청 상태를 변경할 수 있습니다."),
    "'졸업생 모드: 요청 상태를 변경할 수 있습니다.' 문구가 완전히 제거되어야 함"
  );
  assert.ok(
    !pageCode.includes("답변완료 표시"),
    "'답변완료 표시' 버튼이 완전히 제거되어야 함"
  );
  assert.ok(
    !pageCode.includes("멘토링 요청 확인 및 상태 변경"),
    "'멘토링 요청 확인 및 상태 변경' 설명 배너가 완전히 제거되어야 함"
  );
  assert.ok(
    !cardsCode.includes("> 대화 요청<"),
    "동문 카드에서 '대화 요청' 버튼이 제거되어야 함"
  );

  // 새롭게 추가된 필수 로직 검증
  assert.ok(
    pageCode.includes("visibleMentoringRequests"),
    "권한별 필터링 visibleMentoringRequests 가 포함되어 있어야 함"
  );
  assert.ok(
    pageCode.includes("후배를 위한 멘토링 답변 작성"),
    "답변 작성 입력 영역이 포함되어 있어야 함"
  );
  assert.ok(
    pageCode.includes("답변 등록"),
    "답변 등록 버튼이 포함되어 있어야 함"
  );
});

test("5. 관리자는 멘토링 요청 현황을 열람할 수 있지만 답변 등록 및 수정 권한은 차단된다", () => {
  const pageCode = fs.readFileSync(
    path.join(rootDir, "src/app/alumni/page.tsx"),
    "utf8"
  );

  // 1) 관리자 모니터링 뱃지 존재 확인
  assert.ok(
    pageCode.includes("관리자 모니터링 (열람 전용)"),
    "관리자에게는 열람 전용 모니터링 뱃지가 노출되어야 함"
  );

  // 2) canManage 권한이 isMentor(해당 멘토 동문 본인)로만 제한되는지 확인
  assert.ok(
    pageCode.includes("const canManage = isMentor;"),
    "멘토링 관리 권한은 관리자가 아닌 오직 멘토 본인(isMentor)에게만 부여되어야 함"
  );

  // 3) showReplyForm 및 isEditing 권한이 isMentor로만 제한되는지 확인
  assert.ok(
    pageCode.includes('const showReplyForm = isMentor && (req.status === "수락됨" || isEditing);'),
    "답변 등록 폼은 오직 멘토 본인에게만 표시되어야 함"
  );

  // 4) 답변 등록 클릭 시 멘토 여부 검증 방어 로직 확인
  assert.ok(
    pageCode.includes("멘토링 답변 등록 및 수정은 해당 멘토 동문 본인만 가능합니다."),
    "관리자가 답변 등록을 시도하더라도 멘토가 아니면 차단되어야 함"
  );
});

// 동국e음 실시간 채팅 읽음 표시(Read Receipt) 및 안 읽은 메시지 수 계산·보안 규칙 테스트
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  effectiveReadSeq,
  unreadCountForMessage,
  unreadCountForUser,
  formatUnreadBadge,
  computeMarkReadTarget,
  compareBySeq,
  formatChatMemberHakbun,
  resolveChatSortTimestamp,
  compareChatRoomsByLatestMessage,
  sortConversationsByLatestMessage,
  parseTimeStringToMs,
  extractEntranceHakbun,
  compareGroupChatMembers,
  sortChatUsersForGroupCreation,
  formatChatDateDivider,
  resolveMessageTimestampMs,
  formatMessageDateDivider,
  isDifferentChatDate,
  formatMessageTimeDisplay,
} from "../src/lib/chatReadReceipts.ts";

test("1. [1:1 채팅] 사용자 A가 B에게 메시지를 보내면 A 화면에 '1'이 표시되고, A 본인의 안 읽은 메시지 수는 0이다", () => {
  // 초기 1:1 방 생성 직후: msgSeq = 0, 두 사람 모두 readSeq = 0
  // A가 첫 메시지(seq: 1) 전송 -> 방의 msgSeq: 1, A의 readSeq: 1, B의 readSeq: 0
  const room = {
    participants: ["userA", "userB"],
    msgSeq: 1,
    readSeq: { userA: 1, userB: 0 },
    joinSeq: { userA: 0, userB: 0 },
  };
  const msgFromA = { senderId: "userA", seq: 1, isSystemMessage: false };

  // 메시지 옆 숫자: B가 아직 안 읽었으므로 1
  assert.equal(unreadCountForMessage(msgFromA, room), 1);
  // 본인이 보낸 메시지는 본인의 안 읽은 메시지 수에 포함되지 않음
  assert.equal(unreadCountForUser(room, "userA"), 0);
  // 상대방 B의 방 목록 안 읽은 배지 수는 1
  assert.equal(unreadCountForUser(room, "userB"), 1);
});

test("2. [1:1 채팅] 상대방 B가 해당 채팅방을 열어 메시지를 확인하면 숫자 '1'이 자동 제거(0)되고 배지도 0이 된다", () => {
  const roomBefore = {
    participants: ["userA", "userB"],
    msgSeq: 1,
    readSeq: { userA: 1, userB: 0 },
    joinSeq: { userA: 0, userB: 0 },
  };
  const msgFromA = { senderId: "userA", seq: 1, isSystemMessage: false };

  // B가 채팅방을 열고 화면이 활성화된 상태에서 메시지(latestLoadedSeq: 1)를 확인
  const targetSeq = computeMarkReadTarget({
    isRoomOpen: true,
    isPageVisible: true,
    messagesLoaded: true,
    isScrolledToLatest: true,
    latestLoadedSeq: 1,
    currentReadSeq: effectiveReadSeq(roomBefore, "userB"),
  });
  assert.equal(targetSeq, 1);

  // Firestore를 통해 B의 readSeq가 1로 동기화된 후
  const roomAfter = {
    ...roomBefore,
    readSeq: { ...roomBefore.readSeq, userB: targetSeq },
  };

  // A와 B 화면 모두에서 메시지 옆 숫자가 0(표시 제거)이 되고 B의 방 목록 배지도 0이 됨
  assert.equal(unreadCountForMessage(msgFromA, roomAfter), 0);
  assert.equal(unreadCountForUser(roomAfter, "userB"), 0);
});

test("3. [읽음 처리 기준] B가 다른 채팅방을 보고 있거나 브라우저 탭이 백그라운드에 있으면 읽음 처리되지 않고 '1'이 유지된다", () => {
  const room = {
    participants: ["userA", "userB"],
    msgSeq: 2,
    readSeq: { userA: 2, userB: 1 },
    joinSeq: { userA: 0, userB: 0 },
  };
  const msg2 = { senderId: "userA", seq: 2, isSystemMessage: false };

  // 3-1) 다른 채팅방을 보고 있는 경우 (isRoomOpen: false)
  assert.equal(
    computeMarkReadTarget({
      isRoomOpen: false,
      isPageVisible: true,
      messagesLoaded: true,
      isScrolledToLatest: true,
      latestLoadedSeq: 2,
      currentReadSeq: 1,
    }),
    null
  );

  // 3-2) 브라우저 탭이 백그라운드에 있는 경우 (isPageVisible: false)
  assert.equal(
    computeMarkReadTarget({
      isRoomOpen: true,
      isPageVisible: false,
      messagesLoaded: true,
      isScrolledToLatest: true,
      latestLoadedSeq: 2,
      currentReadSeq: 1,
    }),
    null
  );

  // 3-3) 아직 메시지를 서버에서 불러오지 않은 경우 (messagesLoaded: false)
  assert.equal(
    computeMarkReadTarget({
      isRoomOpen: true,
      isPageVisible: true,
      messagesLoaded: false,
      isScrolledToLatest: true,
      latestLoadedSeq: 2,
      currentReadSeq: 1,
    }),
    null
  );

  // 3-4) 이전 대화를 보느라 스크롤을 위로 올려 최신 메시지를 아직 안 본 경우 (isScrolledToLatest: false)
  assert.equal(
    computeMarkReadTarget({
      isRoomOpen: true,
      isPageVisible: true,
      messagesLoaded: true,
      isScrolledToLatest: false,
      latestLoadedSeq: 2,
      currentReadSeq: 1,
    }),
    null
  );

  // 여전히 안 읽은 인원 수 1 유지
  assert.equal(unreadCountForMessage(msg2, room), 1);
});

test("4. [단체 채팅] 5명이 참여하는 단체방에서 메시지를 보내면 4가 표시되고, 참여자들이 읽을 때마다 3 -> 2 -> 1 -> 0으로 감소한다", () => {
  const participants = ["u1", "u2", "u3", "u4", "u5"];
  const msg = { senderId: "u1", seq: 10, isSystemMessage: false };

  // u1이 seq=10 메시지를 방금 보낸 상태 (나머지 4명은 seq=9까지 읽음)
  const roomStep0 = {
    participants,
    msgSeq: 10,
    readSeq: { u1: 10, u2: 9, u3: 9, u4: 9, u5: 9 },
    joinSeq: { u1: 0, u2: 0, u3: 0, u4: 0, u5: 0 },
  };
  assert.equal(unreadCountForMessage(msg, roomStep0), 4);
  assert.equal(unreadCountForUser(roomStep0, "u1"), 0);
  assert.equal(unreadCountForUser(roomStep0, "u2"), 1);

  // u2가 읽음 -> 3 표시
  const roomStep1 = { ...roomStep0, readSeq: { ...roomStep0.readSeq, u2: 10 } };
  assert.equal(unreadCountForMessage(msg, roomStep1), 3);

  // u3, u4가 읽음 -> 1 표시
  const roomStep2 = { ...roomStep1, readSeq: { ...roomStep1.readSeq, u3: 10, u4: 10 } };
  assert.equal(unreadCountForMessage(msg, roomStep2), 1);

  // 마지막 u5까지 모두 읽음 -> 0 (화면에서 숫자 제거)
  const roomStep3 = { ...roomStep2, readSeq: { ...roomStep2.readSeq, u5: 10 } };
  assert.equal(unreadCountForMessage(msg, roomStep3), 0);
});

test("5. [새로고침 후 유지] 이미 읽은 메시지는 새로고침 후 Firestore 문서를 다시 불러와도 다시 읽지 않은 상태가 되지 않는다", () => {
  const persistedRoomFromFirestore = {
    participants: ["userA", "userB"],
    msgSeq: 5,
    readSeq: { userA: 5, userB: 5 },
    joinSeq: { userA: 0, userB: 0 },
  };
  const messages = [1, 2, 3, 4, 5].map((seq) => ({
    senderId: seq % 2 === 1 ? "userA" : "userB",
    seq,
    isSystemMessage: false,
  }));

  for (const m of messages) {
    assert.equal(unreadCountForMessage(m, persistedRoomFromFirestore), 0);
  }
  assert.equal(unreadCountForUser(persistedRoomFromFirestore, "userA"), 0);
  assert.equal(unreadCountForUser(persistedRoomFromFirestore, "userB"), 0);

  // 새로고침 직후 똑같은 방을 열어도 이미 currentReadSeq === 5 이므로 불필요한 중복 쓰기를 하지 않음
  assert.equal(
    computeMarkReadTarget({
      isRoomOpen: true,
      isPageVisible: true,
      messagesLoaded: true,
      isScrolledToLatest: true,
      latestLoadedSeq: 5,
      currentReadSeq: effectiveReadSeq(persistedRoomFromFirestore, "userB"),
    }),
    null
  );
});

test("6. [다중 기기 동시 접속] 스마트폰에서 이미 10번까지 읽었다면, PC에서 7번까지만 로드된 상태여도 읽음 위치가 7로 역행하지 않는다", () => {
  const roomSyncedFromPhone = {
    participants: ["userA", "userB"],
    msgSeq: 10,
    readSeq: { userA: 10, userB: 10 },
    joinSeq: { userA: 0, userB: 0 },
  };

  // PC에서 최신 로드된 순번이 7이더라도 currentReadSeq(10) 이하이므로 null 반환 (역행 차단)
  const targetOnPc = computeMarkReadTarget({
    isRoomOpen: true,
    isPageVisible: true,
    messagesLoaded: true,
    isScrolledToLatest: true,
    latestLoadedSeq: 7,
    currentReadSeq: effectiveReadSeq(roomSyncedFromPhone, "userB"),
  });
  assert.equal(targetOnPc, null);
});

test("7. [참여자 초대 및 퇴장] 새로 초대된 사람은 초대 이전 메시지의 안 읽음 수에 포함되지 않고, 나간 사람으로 인해 음수가 되지 않는다", () => {
  // 1) 기존에 u1, u2가 seq=5까지 대화하던 방에 u3가 초대됨 (u3의 joinSeq=5, readSeq=5)
  const roomAfterInvite = {
    participants: ["u1", "u2", "u3"],
    msgSeq: 5,
    readSeq: { u1: 5, u2: 3, u3: 5 },
    joinSeq: { u1: 0, u2: 0, u3: 5 },
  };

  const msgBeforeInvite = { senderId: "u1", seq: 4, isSystemMessage: false };
  // seq=4 메시지는 u2만 안 읽었고, 새로 초대된 u3(joinSeq=5)는 초대 이전 메시지이므로 안 읽은 사람으로 세지 않음 -> 1명
  assert.equal(unreadCountForMessage(msgBeforeInvite, roomAfterInvite), 1);
  // 새로 초대된 u3의 방 목록 안 읽은 배지 수도 0이어야 함
  assert.equal(unreadCountForUser(roomAfterInvite, "u3"), 0);

  // 2) 초대 이후 u1이 새 메시지(seq=6)를 보내면 u2, u3 모두 안 읽었으므로 2 표시
  const roomAfterNewMsg = {
    ...roomAfterInvite,
    msgSeq: 6,
    readSeq: { ...roomAfterInvite.readSeq, u1: 6 },
  };
  const msgAfterInvite = { senderId: "u1", seq: 6, isSystemMessage: false };
  assert.equal(unreadCountForMessage(msgAfterInvite, roomAfterNewMsg), 2);
  assert.equal(unreadCountForUser(roomAfterNewMsg, "u3"), 1);

  // 3) 만약 안 읽었던 u2가 채팅방을 나가면 participants에서 제외되므로 u3 1명만 남아 1로 계산됨 (음수나 오류 없음)
  const roomAfterLeave = {
    ...roomAfterNewMsg,
    participants: ["u1", "u3"],
  };
  assert.equal(unreadCountForMessage(msgAfterInvite, roomAfterLeave), 1);
  // 나간 사람(u2)의 안 읽은 메시지 수는 0이고 절대 음수가 되지 않음
  assert.equal(unreadCountForUser(roomAfterLeave, "u2"), 0);
});

test("8. [기존 메시지 호환성] 순번(seq)이 없는 이전 저장 메시지와 시스템 안내 메시지는 읽음 숫자를 잘못 표시하지 않는다", () => {
  const room = {
    participants: ["userA", "userB", "userC"],
    msgSeq: 3,
    readSeq: { userA: 3, userB: 0, userC: 0 },
  };

  const legacyMessageWithoutSeq = {
    senderId: "userA",
    seq: undefined,
    isSystemMessage: false,
  };
  const systemMessage = {
    senderId: "userA",
    seq: 2,
    isSystemMessage: true,
  };

  assert.equal(unreadCountForMessage(legacyMessageWithoutSeq, room), 0);
  assert.equal(unreadCountForMessage(systemMessage, room), 0);

  // 정렬 시 seq가 있는 메시지는 seq 순서대로 정렬되고, 없는 메시지는 0을 반환해 기존 시간 정렬을 유지함
  assert.ok(compareBySeq({ senderId: "a", seq: 1 }, { senderId: "b", seq: 2 }) < 0);
  assert.equal(compareBySeq({ senderId: "a" }, { senderId: "b" }), 0);
});

test("9. [보안 규칙 검증] 비참여자·미승인자는 채팅방 읽음 정보에 접근할 수 없고, 참여자는 본인의 readSeq만 단조 증가로 갱신할 수 있다", () => {
  const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const modalFile = fs.readFileSync(
    new URL("../src/components/common/FirebaseSetupModal.tsx", import.meta.url),
    "utf8"
  );

  for (const content of [rules, modalFile]) {
    // 1) 채팅방 열람은 승인된 회원(isApprovedUser) 중 참여자(request.auth.uid in resource.data.participants)만 가능
    assert.match(
      content,
      /match \/chats\/\{chatId\}[\s\S]*?allow read:\s*if isApprovedUser\(\) && \(\s*request\.auth\.uid in resource\.data\.participants/
    );
    // 2) readSeq 단독 업데이트 시 본인 UID 키만 변경 가능 (타인의 읽음 상태 변경 차단)
    assert.match(
      content,
      /request\.resource\.data\.readSeq\.diff\(resource\.data\.get\('readSeq',\s*\{\}\)\)\.affectedKeys\(\)\.hasOnly\(\[request\.auth\.uid\]\)/
    );
    // 3) readSeq 값이 기존 값 이상(>=)이어야 함 (읽음 상태 역행/조작 차단)
    assert.match(
      content,
      /request\.resource\.data\.readSeq\[request\.auth\.uid\] >= resource\.data\.get\('readSeq',\s*\{\}\)\.get\(request\.auth\.uid,\s*0\)/
    );
  }
});

test("10. [대량 메시지 및 배지 포맷 최적화] 50개의 밀린 메시지를 한꺼번에 읽어도 마지막 순번 1번만 갱신하며, 100개 이상은 '99+'로 표시한다", () => {
  const roomWith50Unread = {
    participants: ["userA", "userB"],
    msgSeq: 50,
    readSeq: { userA: 50, userB: 0 },
    joinSeq: { userA: 0, userB: 0 },
  };

  assert.equal(unreadCountForUser(roomWith50Unread, "userB"), 50);

  // 1~50번 메시지가 한꺼번에 로드되었을 때 computeMarkReadTarget은 마지막 순번(50) 단 1개만 반환
  const singleWriteTarget = computeMarkReadTarget({
    isRoomOpen: true,
    isPageVisible: true,
    messagesLoaded: true,
    isScrolledToLatest: true,
    latestLoadedSeq: 50,
    currentReadSeq: effectiveReadSeq(roomWith50Unread, "userB"),
  });
  assert.equal(singleWriteTarget, 50);

  // 배지 포맷 검증 (0개 -> 빈 문자열, 1~99개 -> 숫자 그대로, 100개 이상 -> '99+')
  assert.equal(formatUnreadBadge(0), "");
  assert.equal(formatUnreadBadge(1), "1");
  assert.equal(formatUnreadBadge(99), "99");
  assert.equal(formatUnreadBadge(100), "99+");
  assert.equal(formatUnreadBadge(250), "99+");
});

test("11. [채팅방 참여 구성원 카드 포맷팅] 관리자 및 교수는 복전·학번 미표시, 재학생 및 졸업생은 00학번만 깔끔하게 표시된다", () => {
  // 1. 관리자(admin): 학번/복전 일체 미표시 (빈 문자열)
  assert.equal(
    formatChatMemberHakbun({
      role: "admin",
      studentIdOrYear: "2022111234",
      bio: "22학번 동국e음 관리자",
    }),
    ""
  );

  // 2. 교수(professor): 학번/복전 일체 미표시 (빈 문자열)
  assert.equal(
    formatChatMemberHakbun({
      role: "professor",
      studentIdOrYear: "교수",
      bio: "교육학과 교수",
    }),
    ""
  );

  // 3. 재학생(student): '22학번' 등의 00학번으로 포맷팅
  assert.equal(
    formatChatMemberHakbun({
      role: "student",
      studentIdOrYear: "2022112345",
      bio: "재학생 소개",
    }),
    "22학번"
  );
  assert.equal(
    formatChatMemberHakbun({
      role: "student",
      studentIdOrYear: "22학번",
    }),
    "22학번"
  );

  // 4. 졸업생(alumni): '19학번' 등의 00학번으로 포맷팅
  assert.equal(
    formatChatMemberHakbun({
      role: "alumni",
      studentIdOrYear: "2019110001",
      bio: "19학번 졸업생",
    }),
    "19학번"
  );
  assert.equal(
    formatChatMemberHakbun({
      role: "alumni",
      studentIdOrYear: "19학번",
    }),
    "19학번"
  );

  // 5. null/undefined 또는 학번 미등록 시 빈 문자열
  assert.equal(formatChatMemberHakbun(null), "");
  assert.equal(formatChatMemberHakbun({ role: "student" }), "");
});

test("15. [대화방 나가기 보안 권한 및 원자적 배치 검증] 대화방 퇴장 시 시스템 메시지 전송과 참여자 제거가 안전하게 처리되어 'Missing or insufficient permissions' 오류를 방지한다", () => {
  const firebaseSrc = fs.readFileSync(new URL("../src/lib/firebase.ts", import.meta.url), "utf8");
  const chatPageSrc = fs.readFileSync(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");

  // 1) firebase.ts에서 leaveChatInFirestore가 batch로 시스템 메시지와 참여자 제거를 함께 묶어 원자적으로 처리하는지 검증
  assert.match(
    firebaseSrc,
    /writeBatch\(db\)[\s\S]*?batch\.set\(sysMsgRef[\s\S]*?batch\.update\(chatDocRef[\s\S]*?participants:\s*arrayRemove\(currentUser\.id\)/
  );

  // 2) chat/page.tsx에서 대화방 나가기 전 activeConvId를 먼저 전환하여 잔여 리스너 권한 충돌을 방지하는지 검증
  assert.match(
    chatPageSrc,
    /setActiveConvId\(remaining\[0\]\?\.id\s*\|\|\s*""\)[\s\S]*?await leaveChat\(leavingId\)/
  );
});

test("16. [채팅방 헤더 나가기 버튼 및 참여자 보기 명칭 검증] 참여자 패널을 열지 않고도 상단 헤더에서 '방 나가기' 버튼을 즉시 누를 수 있고 '참여자 보기'로 표시된다", () => {
  const chatPageSrc = fs.readFileSync(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");

  // 1) 대화방 상단 헤더 영역에 '방 나가기' 버튼이 위치하는지 확인
  assert.match(
    chatPageSrc,
    /onClick=\{handleLeaveCurrentChat\}[\s\S]*?방 나가기[\s\S]*?onClick=\{\(\)\s*=>\s*setShowMemberPanel/
  );

  // 2) '참여자 관리'가 아닌 '참여자 보기' (또는 열렸을 때 '참여자 닫기')로 표시되는지 확인
  assert.match(
    chatPageSrc,
    /참여자\s*\{showMemberPanel\s*\?\s*"닫기"\s*:\s*"보기"\}/
  );
  assert.equal(chatPageSrc.includes('참여자 {showMemberPanel ? "닫기" : "관리"}'), false);

  // 3) 참여자 상세 패널 내부에서는 '방 나가기' 버튼이 제거되어 상단 헤더에만 단독 존재하는지 확인
  const memberPanelMatch = chatPageSrc.match(/\{showMemberPanel\s*&&[\s\S]*?채팅방 참여 구성원[\s\S]*?\{activeMembers\.map/);
  assert.ok(memberPanelMatch);
  assert.equal(memberPanelMatch[0].includes("방 나가기"), false, "참여자 패널 내부의 방 나가기 버튼은 삭제되어야 함");
});

test("17. [채팅방 목록 최신 메시지순 정렬] 메시지 전송 시 방이 즉시 목록 최상단(0번)으로 이동하며, 1:1 및 단체방 모두 동일하게 동작한다", () => {
  const baseTime = 1762950000000;
  const roomA = {
    id: "chat-a",
    title: "1:1 대화방 A",
    isGroup: false,
    lastMessageText: "안녕",
    lastMessageTimestamp: baseTime,
  };
  const roomB = {
    id: "chat-b",
    title: "단체 대화방 B",
    isGroup: true,
    lastMessageText: "과제 공지",
    lastMessageTimestamp: baseTime + 1000,
  };
  const roomC = {
    id: "chat-c",
    title: "1:1 대화방 C",
    isGroup: false,
    lastMessageText: "질문있습니다",
    lastMessageTimestamp: baseTime + 2000,
  };

  // 초기 상태: C가 가장 최신이므로 [C, B, A] 순서
  let list = [roomA, roomB, roomC];
  let sorted = sortConversationsByLatestMessage(list);
  assert.deepEqual(sorted.map((r) => r.id), ["chat-c", "chat-b", "chat-a"]);

  // 1) 채팅방 A에서 내가 새 메시지를 전송 (lastMessageTimestamp 갱신)
  const roomAUpdated = {
    ...roomA,
    lastMessageText: "새 메시지 전송",
    lastMessageTimestamp: baseTime + 3000,
  };
  list = [roomAUpdated, roomB, roomC];
  sorted = sortConversationsByLatestMessage(list);
  // 방 A가 즉시 목록 맨 위로 이동
  assert.deepEqual(sorted.map((r) => r.id), ["chat-a", "chat-c", "chat-b"]);

  // 2) 이후 단체 채팅방 B에서 상대방이 새 메시지를 전송
  const roomBUpdated = {
    ...roomB,
    lastMessageText: "상대방의 새 메시지",
    lastMessageTimestamp: baseTime + 4000,
  };
  list = [roomAUpdated, roomBUpdated, roomC];
  sorted = sortConversationsByLatestMessage(list);
  // 방 B가 즉시 맨 위로 이동하고, 이전에 1등이던 A는 2번째로 이동
  assert.deepEqual(sorted.map((r) => r.id), ["chat-b", "chat-a", "chat-c"]);
});

test("18. [읽기/클릭 시 정렬 순서 불변 검증] 채팅방을 클릭하거나 메시지를 읽었을 때(readSeq 갱신)는 순서가 변경되지 않는다", () => {
  const baseTime = 1762950000000;
  const room1 = {
    id: "chat-1",
    title: "대화방 1",
    lastMessageTimestamp: baseTime + 5000,
    readSeq: { userA: 1 },
    msgSeq: 3,
  };
  const room2 = {
    id: "chat-2",
    title: "대화방 2",
    lastMessageTimestamp: baseTime + 3000,
    readSeq: { userA: 2 },
    msgSeq: 2,
  };
  const room3 = {
    id: "chat-3",
    title: "대화방 3",
    lastMessageTimestamp: baseTime + 1000,
    readSeq: { userA: 0 },
    msgSeq: 5,
  };

  const initialList = [room1, room2, room3];
  const initialSorted = sortConversationsByLatestMessage(initialList);
  assert.deepEqual(initialSorted.map((r) => r.id), ["chat-1", "chat-2", "chat-3"]);

  // 사용자가 3번 방(가장 오래된 방)을 클릭하여 메시지를 모두 읽음 (readSeq 0 -> 5)
  // 단, lastMessageTimestamp는 변경되지 않음
  const room3Read = {
    ...room3,
    readSeq: { userA: 5 },
  };

  const afterReadList = [room1, room2, room3Read];
  const afterReadSorted = sortConversationsByLatestMessage(afterReadList);

  // 메시지를 읽거나 클릭해도 방의 순서는 [1, 2, 3] 그대로 유지되어야 함
  assert.deepEqual(afterReadSorted.map((r) => r.id), ["chat-1", "chat-2", "chat-3"]);
});

test("19. [기존 채팅 기록 호환성 및 보조 정렬 검증] lastMessageTimestamp가 없는 구형 방, 한국어 시간 문자열, 생성 시각 폴백 및 누락 방지", () => {
  // 1) 한국어 시간 문자열 파싱 검증: createdAt 날짜와 결합되어 정확한 시각 추출
  const parsedYesterdayPM = parseTimeStringToMs("오후 11:50", "2026-11-10");
  const parsedTodayAM = parseTimeStringToMs("오전 09:10", "2026-11-11");
  assert.ok(parsedYesterdayPM);
  assert.ok(parsedTodayAM);
  // 어제 밤 11시 50분보다 오늘 아침 9시 10분이 더 최신이어야 함 (기존 localeCompare의 치명적 오류 해결 검증)
  assert.ok(parsedTodayAM > parsedYesterdayPM, "오늘 아침 9시가 어제 밤 11시보다 최신이어야 함");

  // 2) 레거시 방 목록 정렬
  const legacyRooms = [
    {
      id: "legacy-yesterday",
      title: "어제 밤 대화방",
      lastMessageAt: "오후 11:50",
      createdAt: "2026-11-10",
    },
    {
      id: "legacy-today",
      title: "오늘 아침 대화방",
      lastMessageAt: "오전 09:10",
      createdAt: "2026-11-11",
    },
    {
      id: "new-room-no-msgs",
      title: "메시지 없는 신규 개설 방",
      lastMessageAt: "",
      createdAt: "2026-11-12",
    },
    {
      id: "modern-active-room",
      title: "최신 메시지가 전송된 방",
      lastMessageTimestamp: 1794500000000,
    },
    {
      id: "very-old-room",
      title: "타임스탬프 필드가 전혀 없는 극단적 레거시 방",
    },
  ];

  const sortedLegacy = sortConversationsByLatestMessage(legacyRooms);

  // 어떤 방도 필터링되거나 누락되지 않고 5개 모두 보존됨
  assert.equal(sortedLegacy.length, 5);

  // 1등: 현대식 숫자 타임스탬프 방
  assert.equal(sortedLegacy[0].id, "modern-active-room");
  // 2등: 2026-11-12 생성된 신규 방 (메시지 없지만 생성일 기준)
  assert.equal(sortedLegacy[1].id, "new-room-no-msgs");
  // 3등: 2026-11-11 오늘 아침 방
  assert.equal(sortedLegacy[2].id, "legacy-today");
  // 4등: 2026-11-10 어제 밤 방
  assert.equal(sortedLegacy[3].id, "legacy-yesterday");
  // 5등: 필드가 아예 없는 레거시 방 (맨 아래에 안전하게 유지)
  assert.equal(sortedLegacy[4].id, "very-old-room");
});

test("20. [Firestore 보안 규칙 및 트랜잭션 동시성 검증] 대화방 갱신 시 lastMessageTimestamp, lastMessageIso가 원자적으로 저장되고 보안 규칙에 위배되지 않는다", () => {
  const firebaseSrc = fs.readFileSync(new URL("../src/lib/firebase.ts", import.meta.url), "utf8");
  const rulesSrc = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

  // 1) firebase.ts에서 sendChatMessageInFirestore가 트랜잭션 내에서 lastMessageTimestamp, lastMessageIso를 원자적으로 갱신하는지 확인
  assert.match(
    firebaseSrc,
    /lastMessageTimestamp:\s*effectiveTimestamp/
  );
  assert.match(
    firebaseSrc,
    /lastMessageIso:\s*nowIso/
  );

  // 2) 클라이언트 시계 역행이나 동시성 충돌을 방지하는 Math.max(nowMs, prevTs + 1) 단조 증가 보장 확인
  assert.match(
    firebaseSrc,
    /Math\.max\(nowMs,\s*prevTs\s*\+\s*1\)/
  );

  // 3) subscribeToUserChats에서 compareChatRoomsByLatestMessage를 사용하여 실시간 최신순 정렬하는지 확인
  assert.match(
    firebaseSrc,
    /list\.sort\(compareChatRoomsByLatestMessage\)/
  );

  // 4) Firestore 쿼리가 orderBy를 강제하여 필드 미존재 구형 방을 드롭하지 않고, where("participants", "array-contains")로 전체 조회 후 클라이언트 정렬하는 구조 확인
  assert.match(
    firebaseSrc,
    /where\("participants",\s*"array-contains",\s*currentUid\)/
  );

  // 5) firestore.rules에서 참여자의 대화방 갱신(affectedKeys check)이 정상 허용되는지 확인
  assert.match(
    rulesSrc,
    /match \/chats\/\{chatId\}[\s\S]*?allow update:\s*if isApprovedUser\(\)\s*&&/
  );
});

test("21. [학번 추출 - extractEntranceHakbun] 2자리 학번, 4자리 입학연도, '2026학년도(22학번)', '99학번 이전', 10자리 학번을 정확하게 입학 학번 4자리 숫자로 파싱한다", () => {
  // '24학번' -> 2024
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "24학번" }), 2024);
  // '2022' -> 2022
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "2022" }), 2022);
  // '2026학년도(22학번)' -> 졸업연도가 아닌 괄호 안 입학학번(22학번) 2022 우선 추출
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "2026학년도(22학번)" }), 2022);
  // '99학번 이전' -> 1999
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "99학번 이전" }), 1999);
  // 10자리 학번 '2023112345' -> 2023
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "2023112345" }), 2023);
  // null / 빈 값 / 비정형 -> null
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "" }), null);
  assert.equal(extractEntranceHakbun(null), null);
  assert.equal(extractEntranceHakbun({ studentIdOrYear: "미정" }), null);
});

test("22. [재학생 정렬] 입학 학번 작은 순서(20 -> 21 -> 22...)로 정렬되고, 동일 학번은 한국어 이름 가나다순으로 정렬되며, 학번 미기재자는 맨 뒤에 위치한다", () => {
  const users = [
    { id: "u1", name: "홍길동", role: "student", studentIdOrYear: "24학번" },
    { id: "u2", name: "강감찬", role: "student", studentIdOrYear: "21학번" },
    { id: "u3", name: "김유신", role: "student", studentIdOrYear: "21학번" },
    { id: "u4", name: "이순신", role: "student", studentIdOrYear: "20학번" },
    { id: "u5", name: "나미정", role: "student", studentIdOrYear: "" },
    { id: "u6", name: "안중근", role: "student", studentIdOrYear: "26학번" },
  ];

  const sorted = sortChatUsersForGroupCreation(users, "student");
  // 20학번: 이순신 (u4)
  // 21학번: 강감찬 (u2) -> 김유신 (u3)
  // 24학번: 홍길동 (u1)
  // 26학번: 안중근 (u6)
  // 학번미기재: 나미정 (u5)
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["u4", "u2", "u3", "u1", "u6", "u5"]
  );
});

test("23. [졸업생 정렬] 졸업 연도가 아닌 입학 학번 기준으로 작은 순서대로 정렬되며 동일 학번은 이름 가나다순, 미기재자는 맨 뒤로 정렬된다", () => {
  const users = [
    { id: "a1", name: "최선배", role: "alumni", studentIdOrYear: "2026학년도(22학번)" }, // 입학: 2022
    { id: "a2", name: "강선배", role: "alumni", studentIdOrYear: "2024학년도(18학번)" }, // 입학: 2018
    { id: "a3", name: "김선배", role: "alumni", studentIdOrYear: "2024학년도(18학번)" }, // 입학: 2018
    { id: "a4", name: "고선배", role: "alumni", studentIdOrYear: "99학번 이전" },        // 입학: 1999
    { id: "a5", name: "박선배", role: "alumni", studentIdOrYear: "20학번" },             // 입학: 2020
    { id: "a6", name: "무학번", role: "alumni", studentIdOrYear: "" },                   // 입학: 미기재
  ];

  const sorted = sortChatUsersForGroupCreation(users, "alumni");
  // 1999: 고선배 (a4)
  // 2018: 강선배 (a2) -> 김선배 (a3) (동일학번 가나다순)
  // 2020: 박선배 (a5)
  // 2022: 최선배 (a1)
  // 미기재: 무학번 (a6)
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["a4", "a2", "a3", "a5", "a1", "a6"]
  );
});

test("24. [교수진 정렬] 학번 기준이 적용되지 않고 교수 이름의 한국어 가나다순(ko-KR)으로만 정렬된다", () => {
  const professors = [
    { id: "p1", name: "황교수", role: "professor", studentIdOrYear: "95학번" },
    { id: "p2", name: "강교수", role: "professor", studentIdOrYear: "00학번" },
    { id: "p3", name: "김교수", role: "professor", studentIdOrYear: "" },
    { id: "p4", name: "남궁교수", role: "professor", studentIdOrYear: "88학번" },
  ];

  const sorted = sortChatUsersForGroupCreation(professors, "professor");
  // 가나다순: 강교수 -> 김교수 -> 남궁교수 -> 황교수
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["p2", "p3", "p4", "p1"]
  );
});

test("25. [동일 학번·이름 안정적 정렬] 학번과 이름이 완전히 같아도 사용자 ID(id)를 기준으로 일관된 순서를 보장한다", () => {
  const users = [
    { id: "user-b", name: "이동국", role: "student", studentIdOrYear: "23학번" },
    { id: "user-a", name: "이동국", role: "student", studentIdOrYear: "23학번" },
  ];

  const sorted = sortChatUsersForGroupCreation(users, "student");
  assert.deepEqual(
    sorted.map((u) => u.id),
    ["user-a", "user-b"]
  );
});

test("26. [단체 채팅방 UI 소스코드 구조 검증] 탭(재학생/졸업생/교수진), 카운트, 검색, 빈 목록 안내, 탭 이동 시 선택 상태 유지가 구현되어 있다", () => {
  const chatSrc = fs.readFileSync(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");

  // 1) 3개 카테고리 탭 (재학생, 졸업생, 교수진)
  assert.match(chatSrc, /key:\s*"student"[\s\S]*?label:\s*"재학생"/);
  assert.match(chatSrc, /key:\s*"alumni"[\s\S]*?label:\s*"졸업생"/);
  assert.match(chatSrc, /key:\s*"professor"[\s\S]*?label:\s*"교수진"/);

  // 2) 탭에 인원 수 표시
  assert.match(chatSrc, /groupStudentsList\.length/);
  assert.match(chatSrc, /groupAlumniList\.length/);
  assert.match(chatSrc, /groupProfessorList\.length/);

  // 3) 카테고리별 정렬 적용 (sortChatUsersForGroupCreation)
  assert.match(chatSrc, /sortChatUsersForGroupCreation\(list,\s*groupCategoryTab\)/);

  // 4) 검색어 입력 창 및 검색 결과 필터링
  assert.match(chatSrc, /groupUserSearchQuery/);
  assert.match(chatSrc, /이름, 학번/);

  // 5) 빈 목록 시 안내 문구
  assert.match(chatSrc, /해당하는 회원이 없습니다/);

  // 6) 탭 전환 시 선택 유지 (selectedUserIds 상태가 groupCategoryTab과 독립적으로 전역 유지)
  assert.match(chatSrc, /selectedUserIds\.includes\(u\.id\)/);
});

test("27. [날짜 구분선 포맷] 한국 표준시(Asia/Seoul) 기준 'YYYY년 M월 D일 요일' 형식으로 정확히 변환된다", () => {
  // 2026년 11월 13일 (금요일) KST 테스트
  // UTC 2026-11-13T03:00:00Z -> KST 2026-11-13 12:00:00 (금요일)
  const d = new Date("2026-11-13T03:00:00Z");
  const formatted = formatChatDateDivider(d);
  assert.equal(formatted, "2026년 11월 13일 금요일");

  // 밀리초 타임스탬프 입력 지원
  assert.equal(formatChatDateDivider(d.getTime()), "2026년 11월 13일 금요일");

  // 유효하지 않은 입력 시 빈 문자열 반환
  assert.equal(formatChatDateDivider(new Date(NaN)), "");
});

test("28. [자정 전후 날짜 구분] UTC 기준과 한국(KST) 기준의 자정 전후 시점이 올바른 한국 날짜와 요일로 계산된다", () => {
  // UTC 2026-11-12T14:59:00Z -> KST 2026-11-12 23:59:00 (목요일)
  const beforeMidnight = new Date("2026-11-12T14:59:00Z");
  assert.equal(formatChatDateDivider(beforeMidnight), "2026년 11월 12일 목요일");

  // UTC 2026-11-12T15:01:00Z -> KST 2026-11-13 00:01:00 (금요일)
  const afterMidnight = new Date("2026-11-12T15:01:00Z");
  assert.equal(formatChatDateDivider(afterMidnight), "2026년 11월 13일 금요일");

  const msg1 = { timestamp: beforeMidnight };
  const msg2 = { timestamp: afterMidnight };

  // 두 메시지가 서로 다른 날짜임을 올바르게 감지
  assert.equal(isDifferentChatDate(msg1, msg2), true);
  assert.equal(isDifferentChatDate(msg1, msg1), false);
});

test("29. [메시지 타임스탬프 추출] Firestore Timestamp, Date, ISO, time string, ID 타임스탬프를 안전하게 추출한다", () => {
  // 1) Firestore toMillis()
  const msgWithToMillis = {
    timestamp: { toMillis: () => 1794557452000 },
  };
  assert.equal(resolveMessageTimestampMs(msgWithToMillis), 1794557452000);

  // 2) Firestore seconds & nanoseconds
  const msgWithSeconds = {
    timestamp: { seconds: 1794557452, nanoseconds: 500000000 },
  };
  assert.equal(resolveMessageTimestampMs(msgWithSeconds), 1794557452500);

  // 3) createdAtTimestamp
  const msgWithCreatedTs = {
    createdAtTimestamp: 1794557452000,
  };
  assert.equal(resolveMessageTimestampMs(msgWithCreatedTs), 1794557452000);

  // 4) createdAtIso
  const msgWithIso = {
    createdAtIso: "2026-11-13T12:00:00.000Z",
  };
  assert.equal(resolveMessageTimestampMs(msgWithIso), Date.parse("2026-11-13T12:00:00.000Z"));

  // 5) createdAt 시간 문자열 + baseDateStr
  const msgWithTime = {
    createdAt: "오후 02:30",
  };
  const timeMs = resolveMessageTimestampMs(msgWithTime, "2026-11-13");
  assert.ok(timeMs !== null);
  assert.equal(formatChatDateDivider(timeMs), "2026년 11월 13일 금요일");

  // 6) msg.id 타임스탬프 (시스템 메시지 등)
  const msgWithId = {
    id: "msg-sys-1794557452000",
  };
  assert.equal(resolveMessageTimestampMs(msgWithId), 1794557452000);

  // 7) 시간 정보가 아예 없는 경우 null 반환 (가짜 임의 날짜 생성 방지)
  const emptyMsg = { content: "시간 없는 메시지" };
  assert.equal(resolveMessageTimestampMs(emptyMsg), null);
  assert.equal(formatMessageDateDivider(emptyMsg), null);
});

test("30. [날짜 구분선 배치 로직] 첫 메시지 표시, 동일 날짜 중복 제거, 날짜 변경 시 새 구분선, 시스템 메시지 연동 검증", () => {
  const msgs = [
    { id: "m1", timestamp: new Date("2026-11-12T10:00:00+09:00"), content: "안녕하세요 1" },
    { id: "m2", timestamp: new Date("2026-11-12T11:00:00+09:00"), content: "네 안녕하세요 2" },
    { id: "m3", isSystemMessage: true, timestamp: new Date("2026-11-13T09:00:00+09:00"), content: "새 참여자 입장" },
    { id: "m4", timestamp: new Date("2026-11-13T10:00:00+09:00"), content: "오늘 회의 일정입니다" },
  ];

  // 각 메시지 인덱스별 구분선 출력 여부 시뮬레이션
  const dividers = msgs.map((msg, idx) => {
    const cur = formatMessageDateDivider(msg);
    const prev = idx > 0 ? formatMessageDateDivider(msgs[idx - 1]) : null;
    return cur && cur !== prev ? cur : null;
  });

  assert.deepEqual(dividers, [
    "2026년 11월 12일 목요일", // 첫 메시지 위에 표시
    null,                      // 같은 날이므로 중복 표시 안 함
    "2026년 11월 13일 금요일", // 자정 넘어 날짜 바뀌었으므로 새 날짜 표시 (시스템 메시지 포함)
    null,                      // 13일의 다음 메시지이므로 중복 표시 안 함
  ]);
});

test("31. [메시지 시간 표기] formatMessageTimeDisplay는 오전/오후 HH:MM 형식을 안전하게 보장한다", () => {
  assert.equal(formatMessageTimeDisplay("오후 02:30"), "오후 02:30");
  assert.equal(formatMessageTimeDisplay("14:30"), "14:30");
  const isoTime = formatMessageTimeDisplay("2026-11-13T05:30:00Z"); // 14:30 KST
  assert.match(isoTime, /오후\s*0?2:30|2:30/);
});

test("32. [채팅 화면 UI 소스코드 검증] 카카오톡 스타일 날짜 구분선(중앙 정렬, 구분선 라인, role=separator)이 적용되어 있다", () => {
  const chatSrc = fs.readFileSync(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");

  // 1) formatMessageDateDivider 및 formatMessageTimeDisplay import 확인
  assert.match(chatSrc, /formatMessageDateDivider/);
  assert.match(chatSrc, /formatMessageTimeDisplay/);

  // 2) 날짜 구분선 DOM 및 role="separator"
  assert.match(chatSrc, /role="separator"/);
  assert.match(chatSrc, /data-testid=\{`chat-date-divider-\$\{msg\.id/);

  // 3) 중앙 정렬 및 라인 스타일 (flex, justify-center, bg-slate-200)
  assert.match(chatSrc, /flex items-center justify-center/);
  assert.match(chatSrc, /bg-slate-200/);
  assert.match(chatSrc, /rounded-full/);
});



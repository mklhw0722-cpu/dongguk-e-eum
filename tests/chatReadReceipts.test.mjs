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

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("1. [게시판 목록 갱신 및 명칭 전환] 경제학, 심리학, 컴퓨터공학이 제거되고 국어교육학과 및 법학과를 포함한 모든 항목이 '게시판' 명칭과 빈 참여자 배열(memberIds: [])을 가진다", () => {
  const mockContent = fs.readFileSync(new URL("../src/data/mockData.ts", import.meta.url), "utf8");

  // 제거 대상 확인
  assert.equal(mockContent.includes('"room-dm-econ"'), false, "경제학 게시판 id가 존재하지 않아야 함");
  assert.equal(mockContent.includes('"room-dm-psych"'), false, "심리학 게시판 id가 존재하지 않아야 함");
  assert.equal(mockContent.includes('"room-dm-cs"'), false, "컴퓨터공학 게시판 id가 존재하지 않아야 함");

  // 게시판 명칭 전환 확인
  assert.ok(mockContent.includes('"room-dm-korean-edu"'), "국어교육학과 게시판 id가 존재해야 함");
  assert.ok(mockContent.includes("국어교육학과 복수전공 게시판"), "국어교육학과 복수전공 게시판 이름이 존재해야 함");
  assert.ok(mockContent.includes('"room-dm-law"'), "법학과 게시판 id가 존재해야 함");
  assert.ok(mockContent.includes("법학과 복수전공 게시판"), "법학과 복수전공 게시판 이름이 존재해야 함");
  assert.ok(mockContent.includes("교직 · 임용 준비 게시판"), "교직 · 임용 준비 게시판 이름이 존재해야 함");
  assert.ok(mockContent.includes("교육행정 · 공무원 트랙 게시판"), "교육행정 · 공무원 트랙 게시판 이름이 존재해야 함");
});

test("2. [게시글 연결 정합성] 기존 후기 게시글 데이터가 유지되며 국어교육학과 및 법학과 게시판으로 정상 연결되어 있다", () => {
  const mockContent = fs.readFileSync(new URL("../src/data/mockData.ts", import.meta.url), "utf8");

  // post-1 이 국어교육학과 게시판으로 연결되었는지 검증
  assert.match(
    mockContent,
    /id:\s*"post-1"[\s\S]*?roomId:\s*"room-dm-korean-edu"[\s\S]*?roomName:\s*"국어교육학과 복수전공 게시판"/
  );

  // post-2 가 법학과 게시판으로 연결되었는지 검증
  assert.match(
    mockContent,
    /id:\s*"post-2"[\s\S]*?roomId:\s*"room-dm-law"[\s\S]*?roomName:\s*"법학과 복수전공 게시판"/
  );
});

test("3. [캐시 마이그레이션 및 참여자 데이터 비활성화] repository.ts 에서 삭제된 방 필터링, 게시판 명칭 정규화 및 memberIds 초기화가 구현되어 있다", () => {
  const repoContent = fs.readFileSync(new URL("../src/services/repository.ts", import.meta.url), "utf8");

  // storage key 버전 갱신 검증
  assert.ok(repoContent.includes("dongguk_e_eum_demo_state_v3"));

  // 삭제된 방 필터링 로직 검증
  assert.ok(repoContent.includes('const removedRoomIds = new Set(["room-dm-econ", "room-dm-psych", "room-dm-cs"]);'));
  assert.ok(repoContent.includes("!removedRoomIds.has(r.id)"));

  // 공유방 -> 게시판 자동 치환 및 memberIds: [] 초기화 검증
  assert.ok(repoContent.includes('.replace(/공유방/g, "게시판")'));
  assert.ok(repoContent.includes("memberIds: []"));
});

test("4. [게시판 필터 및 검색 구조] '내가 참여한 공유방' 필터가 삭제되고 게시판 전용 필터 및 검색창 문구가 적용되어 있다", () => {
  const pageContent = fs.readFileSync(new URL("../src/app/rooms/page.tsx", import.meta.url), "utf8");

  // 유지 필터 확인
  assert.ok(pageContent.includes('"전체 게시판"'));
  assert.ok(pageContent.includes('"진로 트랙별 게시판"'));
  assert.ok(pageContent.includes('"복수전공별 게시판"'));

  // 삭제 필터 확인
  assert.equal(pageContent.includes("내가 참여한 공유방"), false, "'내가 참여한 공유방' 필터가 완전히 삭제되어야 함");
  assert.equal(pageContent.includes("내가 참여한"), false);

  // 검색 플레이스홀더 확인
  assert.ok(pageContent.includes("진로/복수전공 게시판 검색"));
  assert.ok(pageContent.includes("국어교육, 경영학, 법학"));
});

test("5. [참여/입장 및 참여자 목록 UI 완전 제거] 참여하기·입장하기 버튼, 참여자 수, 참여 구성원 목록이 제거되고 '게시판 보기' 버튼 1개만 표시된다", () => {
  const pageContent = fs.readFileSync(new URL("../src/app/rooms/page.tsx", import.meta.url), "utf8");
  const cardsContent = fs.readFileSync(new URL("../src/components/common/Cards.tsx", import.meta.url), "utf8");

  // Cards.tsx 내 CommunityRoomCard 검증
  assert.equal(cardsContent.includes("+ 참여하기"), false, "참여하기 버튼이 제거되어야 함");
  assert.equal(cardsContent.includes("참여중 (나가기)"), false, "참여중 나가기 버튼이 제거되어야 함");
  assert.equal(cardsContent.includes("입장하기"), false, "입장하기 버튼이 제거되어야 함");
  assert.equal(cardsContent.includes("명 참여"), false, "참여자 수 표시가 제거되어야 함");
  assert.ok(cardsContent.includes("게시판 보기"), "'게시판 보기' 이동 버튼이 표시되어야 함");
  assert.ok(cardsContent.includes("진로 트랙 게시판"), "게시판 분류 배지가 표시되어야 함");
  assert.ok(cardsContent.includes("복수전공 게시판"), "복수전공 게시판 분류 배지가 표시되어야 함");

  // rooms/page.tsx 내 상세 화면 검증
  assert.equal(pageContent.includes("공유방 참여하기"), false, "상세 화면 참여하기 버튼이 제거되어야 함");
  assert.equal(pageContent.includes("공유방 참여 구성원"), false, "누가 참여했는지 확인하는 구성원 목록이 제거되어야 함");
  assert.equal(pageContent.includes("toggleJoinRoom"), false, "참여 토글 함수 호출이 제거되어야 함");
  assert.equal(pageContent.includes("새 공유방 개설"), false, "일반 사용자용 새 공유방 개설 버튼이 제거되어야 함");
});

test("6. [게시판 내부 동작 및 Firestore 보안 규칙] 글 목록, 글 작성, 댓글, 공감 기능과 승인 회원 전용 보안 규칙이 정상 유지된다", () => {
  const pageContent = fs.readFileSync(new URL("../src/app/rooms/page.tsx", import.meta.url), "utf8");
  const rulesContent = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

  // 게시판 내부 기능 유지 확인
  assert.ok(pageContent.includes("createCommunityPost"));
  assert.ok(pageContent.includes("addCommunityComment"));
  assert.ok(pageContent.includes("likeCommunityPost"));
  assert.ok(pageContent.includes("deleteCommunityPost"));

  // Firestore 보안 규칙에서 승인된 회원(isApprovedUser)만 communityPosts 읽기/쓰기 가능한지 확인
  assert.match(rulesContent, /match \/communityPosts\/\{postId\}[\s\S]*?allow read:\s*if isApprovedUser\(\);/);
});

test("7. [도움이 됐어요 중복 방지 및 토글 취소, 초기값 0 검증] 한 계정당 1회만 누를 수 있고, 2회 누르면 취소되며, 모든 mock 게시글의 좋아요가 0으로 초기화된다", () => {
  const mockContent = fs.readFileSync(new URL("../src/data/mockData.ts", import.meta.url), "utf8");
  const appContext = fs.readFileSync(new URL("../src/context/AppContext.tsx", import.meta.url), "utf8");
  const roomsPage = fs.readFileSync(new URL("../src/app/rooms/page.tsx", import.meta.url), "utf8");

  // 1) mockData의 모든 게시글의 likes가 0으로 초기화되었는지 검증
  const postLikesMatches = [...mockContent.matchAll(/id:\s*"post-\d+"[\s\S]*?likes:\s*(\d+)/g)];
  assert.ok(postLikesMatches.length >= 5, "최소 5개의 게시글이 존재해야 함");
  for (const match of postLikesMatches) {
    assert.equal(match[1], "0", "모든 게시글의 초기 도움이 됐어요는 0이어야 함");
  }

  // 2) AppContext 내 1계정 1회 및 2회 누를 시 취소(토글) 로직 검증
  assert.ok(
    appContext.includes("hasLiked"),
    "이미 공감을 눌렀는지 확인하는 hasLiked 변수가 존재해야 함"
  );
  assert.ok(
    appContext.includes("Math.max(0, (targetPost.likes ?? 1) - 1)"),
    "이미 누른 경우 2번째 누르면 공감이 취소(1 감소)되어야 함"
  );
  assert.ok(
    appContext.includes("(targetPost.likes ?? 0) + 1"),
    "처음 누른 경우 공감이 1 증가해야 함"
  );

  // 3) rooms/page.tsx 내 내가 누른 여부(isLikedByMe)에 따른 UI 및 취소 툴팁 검증
  assert.ok(roomsPage.includes("isLikedByMe"), "내가 누른 상태를 판별하는 isLikedByMe가 포함되어야 함");
  assert.ok(roomsPage.includes("도움이 됐어요 취소"), "이미 누른 경우 취소 툴팁이 제공되어야 함");
});

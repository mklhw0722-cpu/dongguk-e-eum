import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("1. [공유방 목록 갱신] 경제학, 심리학, 컴퓨터공학 공유방이 제거되고 국어교육학과 및 법학과 공유방이 등록되어 있다", () => {
  const mockContent = fs.readFileSync(new URL("../src/data/mockData.ts", import.meta.url), "utf8");

  // 제거 대상 확인
  assert.equal(mockContent.includes('"room-dm-econ"'), false, "경제학 공유방 id가 존재하지 않아야 함");
  assert.equal(mockContent.includes('"room-dm-psych"'), false, "심리학 공유방 id가 존재하지 않아야 함");
  assert.equal(mockContent.includes('"room-dm-cs"'), false, "컴퓨터공학 공유방 id가 존재하지 않아야 함");
  assert.equal(mockContent.includes("경제학 복수전공 공유방"), false, "경제학 복수전공 공유방 이름이 제거되어야 함");
  assert.equal(mockContent.includes("심리학 복수전공 공유방"), false, "심리학 복수전공 공유방 이름이 제거되어야 함");
  assert.equal(mockContent.includes("컴퓨터공학 복수전공 공유방"), false, "컴퓨터공학 복수전공 공유방 이름이 제거되어야 함");

  // 추가 대상 확인
  assert.ok(mockContent.includes('"room-dm-korean-edu"'), "국어교육학과 공유방 id가 존재해야 함");
  assert.ok(mockContent.includes("국어교육학과 복수전공 공유방"), "국어교육학과 복수전공 공유방 이름이 존재해야 함");

  assert.ok(mockContent.includes('"room-dm-law"'), "법학과 공유방 id가 존재해야 함");
  assert.ok(mockContent.includes("법학과 복수전공 공유방"), "법학과 복수전공 공유방 이름이 존재해야 함");
});

test("2. [게시글 연결 정합성] 기존 후기 게시글이 신규 개설된 국어교육학과 및 법학과 공유방으로 정상 재연결되어 있다", () => {
  const mockContent = fs.readFileSync(new URL("../src/data/mockData.ts", import.meta.url), "utf8");

  // post-1 이 국어교육학과로 연결되었는지 검증
  assert.match(
    mockContent,
    /id:\s*"post-1"[\s\S]*?roomId:\s*"room-dm-korean-edu"[\s\S]*?roomName:\s*"국어교육학과 복수전공 공유방"/
  );

  // post-2 가 법학과로 연결되었는지 검증
  assert.match(
    mockContent,
    /id:\s*"post-2"[\s\S]*?roomId:\s*"room-dm-law"[\s\S]*?roomName:\s*"법학과 복수전공 공유방"/
  );
});

test("3. [캐시 마이그레이션 정합성] repository.ts 에서 삭제된 방 필터링 및 신규 방 보장이 구현되어 있다", () => {
  const repoContent = fs.readFileSync(new URL("../src/services/repository.ts", import.meta.url), "utf8");

  // storage key 버전 갱신 검증
  assert.ok(repoContent.includes('dongguk_e_eum_demo_state_v2'));

  // 삭제된 방 필터링 로직 검증
  assert.ok(repoContent.includes('const removedRoomIds = new Set(["room-dm-econ", "room-dm-psych", "room-dm-cs"]);'));
  assert.ok(repoContent.includes('!removedRoomIds.has(r.id)'));
});

test("4. [공유방 페이지 검색 플레이스홀더] 국어교육, 법학 키워드가 반영되어 있다", () => {
  const pageContent = fs.readFileSync(new URL("../src/app/rooms/page.tsx", import.meta.url), "utf8");

  assert.ok(pageContent.includes("국어교육, 경영학, 법학"));
  assert.equal(pageContent.includes("심리학, 경영학, 컴퓨터공학"), false);
});

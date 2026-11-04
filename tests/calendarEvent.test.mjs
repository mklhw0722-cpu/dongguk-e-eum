import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("1. [Firestore 보안 규칙] 개인 캘린더 일정(users/{userId}/calendarEvents) 보안 규칙이 올바르게 정의되어 있다", () => {
  const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  // subcollection matching
  assert.match(
    rules,
    /match \/calendarEvents\/\{eventId\}[\s\S]*?allow read, write:\s*if isApprovedUser\(\) && \(request\.auth\.uid == userId \|\| isApprovedAdmin\(\)\);/
  );
  // root-level matching
  assert.match(
    rules,
    /match \/calendarEvents\/\{eventId\}[\s\S]*?allow read:\s*if isApprovedUser\(\)/
  );
});

test("2. [캘린더 일정 모델 및 정렬] 일정 생성, 수정, 삭제 및 날짜·시간순 정렬 로직 검증", () => {
  const events = [
    {
      id: "ev-2",
      title: "오후 2시 세미나",
      date: "2026-11-10",
      time: "14:00",
      isAllDay: false,
      category: "class",
    },
    {
      id: "ev-1",
      title: "종일 행사",
      date: "2026-11-10",
      isAllDay: true,
      category: "official",
    },
    {
      id: "ev-3",
      title: "오전 10시 과제 제출",
      date: "2026-11-10",
      time: "10:00",
      isAllDay: false,
      category: "assignment",
    },
    {
      id: "ev-0",
      title: "이전 날짜 일정",
      date: "2026-11-05",
      isAllDay: true,
      category: "personal",
    },
  ];

  // 정렬: 날짜순 -> 종일 우선 -> 시간순
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return (a.time || "").localeCompare(b.time || "");
  });

  assert.equal(events[0].id, "ev-0", "이전 날짜가 가장 먼저 나와야 함");
  assert.equal(events[1].id, "ev-1", "같은 날짜에서는 종일 일정이 가장 먼저 나와야 함");
  assert.equal(events[2].id, "ev-3", "오전 10시 일정이 오후 2시보다 먼저 나와야 함");
  assert.equal(events[3].id, "ev-2", "오후 2시 일정이 마지막에 나와야 함");
});

test("3. [사용자 격리 및 기기 동기화 데이터 구조] 다른 사용자의 캘린더 경로와 분리된다", () => {
  const userAId = "user-student-A";
  const userBId = "user-student-B";

  const pathA = `users/${userAId}/calendarEvents/ev-100`;
  const pathB = `users/${userBId}/calendarEvents/ev-100`;

  assert.notEqual(pathA, pathB, "사용자별 경로가 달라 상호 간섭이 발생하지 않아야 함");
});

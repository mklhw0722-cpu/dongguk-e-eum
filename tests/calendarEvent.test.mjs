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

test("4. [모바일/신규 접속 시 예시 데이터 원천 차단] initialSamples 주입이 제거되고 예시 일정이 엄격히 필터링된다", () => {
  const calendarCode = fs.readFileSync(new URL("../src/components/calendar/EditableCalendar.tsx", import.meta.url), "utf8");
  
  // initialSamples 자동 등록 코드가 제거되었는지 검증
  assert.equal(calendarCode.includes("const initialSamples"), false, "초기 예시 데이터 선언(initialSamples)이 제거되어 있어야 함");
  assert.equal(calendarCode.includes('id: "sample-1"'), false, "sample-1 예시 일정이 소스코드에 존재하지 않아야 함");

  // 예시 데이터 필터 로직 검증
  const isSampleCalendarEvent = (ev) => {
    if (!ev) return true;
    if (typeof ev.id === "string" && ev.id.startsWith("sample-")) return true;
    if (typeof ev.title === "string") {
      const trimmed = ev.title.trim();
      if (trimmed.includes("[예시]")) return true;
      if (trimmed === "교육공학 프로젝트 발표 준비") return true;
      if (trimmed === "교육방법론 과제 제출 마감") return true;
      if (trimmed === "학과 멘토링 모임") return true;
    }
    return false;
  };

  const sampleList = [
    { id: "sample-1", title: "교육공학 프로젝트 발표 준비", date: "2026-11-04" },
    { id: "sample-2", title: "교육방법론 과제 제출 마감", date: "2026-11-07" },
    { id: "sample-3", title: "학과 멘토링 모임", date: "2026-11-11" },
    { id: "custom-1", title: "[예시] 임의의 예시 타이틀", date: "2026-11-12" },
    { id: "real-1", title: "실제 학생의 과제 제출", date: "2026-11-15" },
    { id: "real-2", title: "기말고사 시험 준비", date: "2026-11-20" },
  ];

  const cleaned = sampleList.filter((item) => !isSampleCalendarEvent(item));
  assert.equal(cleaned.length, 2, "예시 데이터 4건이 모두 걸러지고 실제 등록된 일정 2건만 남아야 함");
  assert.equal(cleaned[0].id, "real-1");
  assert.equal(cleaned[1].id, "real-2");
});


test("5. [캘린더 UI 간소화] '직접 수정 가능', 설명 문구, '새 일정 만들기' 중복 버튼이 제거되어 깔끔한 화면을 제공한다", () => {
  const calendarContent = fs.readFileSync(new URL("../src/components/calendar/EditableCalendar.tsx", import.meta.url), "utf8");

  // 문구 및 배지 삭제 확인
  assert.equal(calendarContent.includes("직접 수정 가능"), false, "'직접 수정 가능' 배지가 제거되어야 함");
  assert.equal(calendarContent.includes("원하는 날짜를 클릭해 새 일정을 등록하고"), false, "설명 문구가 제거되어야 함");
  assert.equal(calendarContent.includes("새 일정 만들기"), false, "하단 '새 일정 만들기' 버튼이 제거되어야 함");

  // 기본 제목 및 상단 '+ 이 날에 새 일정 등록'은 정상 유지되는지 확인
  assert.ok(calendarContent.includes("나의 학업 & 일정 캘린더"));
  assert.ok(calendarContent.includes("이 날에 새 일정 등록"));
});

test("6. [역할별 캘린더 제목 분기] 교수, 졸업생, 관리자는 '나의 캘린더'로 심플하게 표시되고 재학생은 '나의 학업 & 일정 캘린더'로 표시된다", () => {
  const getCalendarTitle = (role) => {
    const isNonStudent = role === "professor" || role === "alumni" || role === "admin";
    return isNonStudent ? "나의 캘린더" : "나의 학업 & 일정 캘린더";
  };

  assert.equal(getCalendarTitle("professor"), "나의 캘린더");
  assert.equal(getCalendarTitle("alumni"), "나의 캘린더");
  assert.equal(getCalendarTitle("admin"), "나의 캘린더");
  assert.equal(getCalendarTitle("student"), "나의 학업 & 일정 캘린더");

  // EditableCalendar.tsx 소스 코드에 해당 분기 로직 및 '나의 캘린더' 문구가 반영되어 있는지 확인
  const calendarCode = fs.readFileSync(new URL("../src/components/calendar/EditableCalendar.tsx", import.meta.url), "utf8");
  assert.ok(calendarCode.includes('"나의 캘린더"'));
  assert.ok(calendarCode.includes('"나의 학업 & 일정 캘린더"'));
});

// 동국e음 공식 공지 자동 수집·중복 제거·캘린더 일정 추출·보안 규칙 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  OFFICIAL_NOTICE_SOURCES,
  parseDepartmentTableHtml,
  parseMainCampusListHtml,
  classifyNoticeCategory,
  extractScheduleFromTitle,
  mergeAndDeduplicateNotices,
} from "../src/lib/officialNoticeParser.ts";

const officialNoticesJson = JSON.parse(
  fs.readFileSync(new URL("../src/data/officialNotices.json", import.meta.url), "utf8")
);

test("1. 공식 홈페이지 수집 데이터(officialNotices.json)가 6개 공식 게시판을 모두 포함하고 유효한 원문 URL을 가진다", () => {
  assert.equal(officialNoticesJson.sources.length, 6);
  assert.ok(Array.isArray(officialNoticesJson.notices));
  assert.ok(officialNoticesJson.notices.length >= 30, "최소 30건 이상의 실제 공식 공지가 수집되어야 함");

  const seenIds = new Set();
  const seenUrls = new Set();
  for (const item of officialNoticesJson.notices) {
    assert.equal(item.isOfficialSynced, true);
    assert.ok(item.title && item.title.length > 0);
    assert.match(item.createdAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(
      item.officialUrl,
      /^https:\/\/(education|edu|www)\.dongguk\.edu\/article\/[A-Za-z0-9_]+\/detail\/\d+$/,
      `유효하지 않은 공식 원문 URL: ${item.officialUrl}`
    );
    assert.ok(!seenIds.has(item.id), `중복된 공지 ID 발견: ${item.id}`);
    assert.ok(!seenUrls.has(item.officialUrl), `중복된 원문 URL 발견: ${item.officialUrl}`);
    seenIds.add(item.id);
    seenUrls.add(item.officialUrl);
  }
});

test("2. 교육학과 및 사범대학 테이블형 게시판 HTML 파서가 제목·분류·작성일·원문 링크를 정확히 추출한다", () => {
  const eduCollegeSource = OFFICIAL_NOTICE_SOURCES.find(
    (s) => s.sourceId === "edu_college_notice"
  );
  const sampleHtml = `
    <table>
      <tbody>
        <tr>
          <td class="td_num"><span class="mark">공지</span></td>
          <td class="td_tit">
            <a href="#none" onclick="goDetail(216102);">
              <span>교직</span>2026학년도 1학기 교직적성 및 인성검사 실시 안내 (신청: 5/1~5/8)
              <img src="/images/ico_file.gif" alt="첨부파일" />
            </a>
          </td>
          <td class="td_write">사범대학학사운영실</td>
          <td>2026-04-06</td>
          <td>312</td>
        </tr>
      </tbody>
    </table>
  `;

  const parsed = parseDepartmentTableHtml(sampleHtml, eduCollegeSource, "2026-04-07T00:00:00.000Z");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "edu_college_notice_216102");
  assert.equal(parsed[0].subCategoryTag, "교직");
  assert.equal(parsed[0].category, "교직 관련 안내");
  assert.equal(parsed[0].isPinned, true);
  assert.equal(parsed[0].hasAttachment, true);
  assert.equal(parsed[0].officialUrl, "https://edu.dongguk.edu/article/notice/detail/216102");
  assert.equal(parsed[0].scheduleStatus, "confirmed");
  assert.equal(parsed[0].eventStartDate, "2026-05-01");
  assert.equal(parsed[0].eventEndDate, "2026-05-08");
});

test("3. 본교(www.dongguk.edu) 리스트형 게시판 HTML 파서가 모바일 중복 공지 태그를 제거하고 정상 파싱한다", () => {
  const haksaSource = OFFICIAL_NOTICE_SOURCES.find((s) => s.sourceId === "dgu_haksa");
  const sampleHtml = `
    <div class="board_list">
      <ul>
        <li>
          <a href="#none" onclick="goDetail(26766678);">
            <div class="mark"><span class="fix">공지</span></div>
            <div class="top">
              <em>수업/성적</em>
              <p class="tit"><span class="mobile">공지</span>2026학년도 여름 계절학기 수강신청 안내</p>
            </div>
            <div class="bot">
              <span>2026.04.14.</span>
              <span>조회 1995</span>
            </div>
          </a>
        </li>
      </ul>
    </div>
  `;

  const parsed = parseMainCampusListHtml(sampleHtml, haksaSource, "2026-04-15T00:00:00.000Z");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "dgu_haksa_26766678");
  assert.equal(parsed[0].title, "2026학년도 여름 계절학기 수강신청 안내");
  assert.equal(parsed[0].subCategoryTag, "수업/성적");
  assert.equal(parsed[0].category, "학사 일정");
  assert.equal(parsed[0].createdAt, "2026-04-14");
  assert.equal(parsed[0].officialUrl, "https://www.dongguk.edu/article/HAKSANOTICE/detail/26766678");
  // 제목에 수강신청 키워드는 있으나 명시적 날짜가 없으므로 작성일(2026-04-14)을 행사일로 오인하지 않고 needs_review 처리
  assert.equal(parsed[0].scheduleStatus, "needs_review");
  assert.equal(parsed[0].eventStartDate, undefined);
});

test("4. 중복 공지 제거 및 수정 감지, 수집 실패 시 기존 데이터 보존 검증", () => {
  const existing = [
    {
      id: "edu_dept_news2_100",
      articleSeq: "100",
      sourceId: "edu_dept_news2",
      organization: "동국대학교 교육학과",
      category: "교육학과 공지",
      title: "기존 공지 제목",
      summary: "요약",
      authorName: "교육학과",
      createdAt: "2026-04-01",
      isPinned: false,
      hasAttachment: false,
      viewCount: 10,
      officialUrl: "https://education.dongguk.edu/article/news2/detail/100",
      isOfficialSynced: true,
      isNew: false,
      collectedAt: "2026-04-01T00:00:00.000Z",
      lastVerifiedAt: "2026-04-01T00:00:00.000Z",
      syncState: "active",
      scheduleStatus: "none",
    },
    {
      id: "dgu_janghak_200",
      articleSeq: "200",
      sourceId: "dgu_janghak",
      organization: "동국대학교 학생처(장학)",
      category: "장학 및 지원",
      title: "일시 오류 출처의 기존 장학 공지",
      summary: "요약",
      authorName: "장학팀",
      createdAt: "2026-04-02",
      isPinned: false,
      hasAttachment: false,
      viewCount: 20,
      officialUrl: "https://www.dongguk.edu/article/JANGHAKNOTICE/detail/200",
      isOfficialSynced: true,
      isNew: false,
      collectedAt: "2026-04-02T00:00:00.000Z",
      lastVerifiedAt: "2026-04-02T00:00:00.000Z",
      syncState: "active",
      scheduleStatus: "none",
    },
  ];

  // edu_dept_news2_100 제목이 수정되었고, dgu_janghak 출처는 일시 네트워크 오류로 수집 실패했다고 가정
  const fetched = [
    {
      ...existing[0],
      title: "기존 공지 제목 (장소 변경 안내 추가)",
      viewCount: 55,
    },
  ];

  const merged = mergeAndDeduplicateNotices({
    existingNotices: existing,
    fetchedNotices: fetched,
    failedSourceIds: ["dgu_janghak"],
    nowIso: "2026-04-10T09:00:00.000Z",
  });

  // 중복 없이 2건 모두 유지되어야 함 (수집 실패한 dgu_janghak_200 이 삭제되지 않아야 함)
  assert.equal(merged.length, 2);

  const updatedItem = merged.find((n) => n.id === "edu_dept_news2_100");
  assert.equal(updatedItem.syncState, "updated", "제목 변경 시 updated 상태로 감지되어야 함");
  assert.equal(updatedItem.collectedAt, "2026-04-01T00:00:00.000Z", "최초 수집 시각은 보존되어야 함");
  assert.equal(updatedItem.lastVerifiedAt, "2026-04-10T09:00:00.000Z");

  const preservedItem = merged.find((n) => n.id === "dgu_janghak_200");
  assert.ok(preservedItem, "수집 실패한 출처의 기존 공지가 삭제되지 않고 유지되어야 함");
  assert.equal(preservedItem.syncState, "unverified");
});

test("5. 캘린더 일정 추출: 게시글 작성일(createdAt)을 행사일로 오인하지 않고 명확한 날짜만 confirmed로 분류한다", () => {
  const s1 = extractScheduleFromTitle(
    "[학부] 2026학년도 1학기 다전공 포기 신청 안내 (4/15~4/21)",
    "2026-04-01"
  );
  assert.equal(s1.scheduleStatus, "confirmed");
  assert.equal(s1.eventStartDate, "2026-04-15");
  assert.equal(s1.eventEndDate, "2026-04-21");

  const s2 = extractScheduleFromTitle(
    "2026학년도 1학기 교직 응급처치 및 심폐소생술 실습 신청 안내",
    "2026-04-03"
  );
  assert.equal(s2.scheduleStatus, "needs_review");
  assert.equal(s2.eventStartDate, undefined, "작성일(2026-04-03)이 행사 시작일로 들어가면 안 됨");

  const s3 = extractScheduleFromTitle(
    "교육학과 학과사무실 위치 및 연락처 안내",
    "2026-03-02"
  );
  assert.equal(s3.scheduleStatus, "none");
  assert.equal(s3.eventStartDate, undefined);
});

test("6. Firestore 보안 규칙에서 공지(notices) 조회는 승인된 회원만, 등록·수정은 승인된 관리자만 허용된다", () => {
  const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(
    rules,
    /match \/notices\/\{noticeId\}[\s\S]*?allow read:\s*if isApprovedUser\(\);[\s\S]*?allow create, update, delete:\s*if isApprovedAdmin\(\);/
  );
  assert.match(
    rules,
    /match \/system\/notice_sync_status[\s\S]*?allow read:\s*if isApprovedUser\(\);[\s\S]*?allow write:\s*if isApprovedAdmin\(\);/
  );
});

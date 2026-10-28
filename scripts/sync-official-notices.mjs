#!/usr/bin/env node
/**
 * 동국e음 — 동국대학교 공식 공지사항 자동 수집 스크립트
 *
 * - 대상 출처:
 *   1) 동국대학교 교육학과 학부 공지 (https://education.dongguk.edu/article/news2/list)
 *   2) 동국대학교 교육학과 학과소식 (https://education.dongguk.edu/article/news1/list)
 *   3) 동국대학교 사범대학 공지사항 (https://edu.dongguk.edu/article/notice/list)
 *   4) 동국대학교 학사공지 (https://www.dongguk.edu/article/HAKSANOTICE/list)
 *   5) 동국대학교 장학공지 (https://www.dongguk.edu/article/JANGHAKNOTICE/list)
 *   6) 동국대학교 일반공지 (https://www.dongguk.edu/article/GENERALNOTICES/list)
 *
 * - 원칙:
 *   - robots.txt 준수 (각 사이트 공개 공지 목록 1페이지만 저빈도로 조회)
 *   - 공지 본문 및 첨부파일 무단 복제 금지 (제목·작성일·작성기관·분류·공식 원문 URL만 저장)
 *   - 일시적 네트워크/파싱 오류 시 기존 수집 공지 데이터를 절대 삭제하지 않고 유지
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OFFICIAL_NOTICE_SOURCES,
  parseDepartmentTableHtml,
  parseMainCampusListHtml,
  mergeAndDeduplicateNotices,
} from "../src/lib/officialNoticeParser.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/officialNotices.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBoardHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Dongguk-E-Eum-NoticeSync/1.0; +https://mklhw0722-cpu.github.io/dongguk-e-eum/)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const nowIso = new Date().toISOString();
  const cacheArgIdx = process.argv.indexOf("--from-cache");
  let cachedBoards = null;

  if (cacheArgIdx !== -1 && process.argv[cacheArgIdx + 1]) {
    const rawText = fs.readFileSync(process.argv[cacheArgIdx + 1], "utf8");
    const startIdx = rawText.indexOf("FECHED_BOARDS_JSON_START");
    const endIdx = rawText.indexOf("FECHED_BOARDS_JSON_END");
    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = rawText.slice(startIdx + "FECHED_BOARDS_JSON_START".length, endIdx);
      cachedBoards = JSON.parse(jsonStr);
    }
  }

  let existingData = {
    lastAttemptAt: nowIso,
    lastSuccessAt: null,
    scheduleNote: "하루 3회 자동 수집 (09:00, 14:00, 20:00 KST · GitHub Actions)",
    sources: [],
    notices: [],
  };

  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    } catch {
      // ignore corrupted file
    }
  }

  const prevSourcesMap = new Map(
    (existingData.sources || []).map((s) => [s.sourceId, s])
  );

  const fetchedNotices = [];
  const failedSourceIds = [];
  const updatedSources = [];
  let anySuccess = false;

  for (const source of OFFICIAL_NOTICE_SOURCES) {
    const prevSource = prevSourcesMap.get(source.sourceId);
    try {
      let html = "";
      if (cachedBoards && cachedBoards[source.sourceId]) {
        if (cachedBoards[source.sourceId].status !== 200) {
          throw new Error(`HTTP ${cachedBoards[source.sourceId].status}`);
        }
        html = cachedBoards[source.sourceId].html;
      } else {
        html = await fetchBoardHtml(source.boardUrl);
        // 사이트에 과도한 요청을 보내지 않도록 요청 간 1초 대기
        await sleep(1000);
      }

      const parsed =
        source.layoutType === "department_table"
          ? parseDepartmentTableHtml(html, source, nowIso)
          : parseMainCampusListHtml(html, source, nowIso);

      if (parsed.length === 0) {
        throw new Error("게시판 목록 파싱 결과가 0건입니다 (사이트 구조 변경 또는 일시 오류 가능성)");
      }

      // 각 게시판당 최신 12건까지만 유지하여 데이터 크기 최적화
      const topItems = parsed.slice(0, 12);
      fetchedNotices.push(...topItems);
      anySuccess = true;

      updatedSources.push({
        sourceId: source.sourceId,
        name: source.name,
        organization: source.organization,
        boardUrl: source.boardUrl,
        defaultCategory: source.defaultCategory,
        status: "ok",
        fetchedCount: topItems.length,
        lastSuccessAt: nowIso,
        lastAttemptAt: nowIso,
      });
      console.log(`[OK] ${source.name} (${source.boardUrl}): ${topItems.length}건 수집`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failedSourceIds.push(source.sourceId);
      updatedSources.push({
        sourceId: source.sourceId,
        name: source.name,
        organization: source.organization,
        boardUrl: source.boardUrl,
        defaultCategory: source.defaultCategory,
        status: "error",
        fetchedCount: prevSource?.fetchedCount || 0,
        lastSuccessAt: prevSource?.lastSuccessAt || null,
        lastAttemptAt: nowIso,
        errorMessage: msg,
      });
      console.warn(`[WARN] ${source.name} 수집 실패 (기존 데이터 유지): ${msg}`);
    }
  }

  const mergedNotices = mergeAndDeduplicateNotices({
    existingNotices: existingData.notices || [],
    fetchedNotices,
    failedSourceIds,
    nowIso,
  });

  const finalPayload = {
    lastAttemptAt: nowIso,
    lastSuccessAt: anySuccess ? nowIso : existingData.lastSuccessAt,
    scheduleNote: "하루 3회 자동 수집 (09:00, 14:00, 20:00 KST · GitHub Actions)",
    sources: updatedSources,
    notices: mergedNotices,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalPayload, null, 2), "utf8");
  console.log(
    `총 ${mergedNotices.length}건의 공식 공지사항이 ${OUTPUT_PATH} 에 저장되었습니다.`
  );
}

main().catch((err) => {
  console.error("공지 수집 치명적 오류:", err);
  process.exit(1);
});

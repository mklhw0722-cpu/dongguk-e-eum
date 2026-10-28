import type { NoticeCategory } from "@/types";

export type OfficialSourceId =
  | "edu_dept_news2"      // 교육학과 학부 공지
  | "edu_dept_news1"      // 교육학과 학과소식
  | "edu_college_notice"  // 사범대학 공지사항
  | "dgu_haksa"           // 동국대 학사공지
  | "dgu_janghak"         // 동국대 장학공지
  | "dgu_general";        // 동국대 일반공지

export type ScheduleStatus = "confirmed" | "needs_review" | "none";

export interface OfficialNoticeItem {
  /** 출처별 고유 ID (예: edu_dept_news2_215755) */
  id: string;
  /** 원문 게시글 고유 번호 (article_seq) */
  articleSeq: string;
  /** 출처 식별자 */
  sourceId: OfficialSourceId;
  /** 작성 기관 / 출처명 (예: 동국대학교 교육학과, 사범대학, 동국대학교 학사공지) */
  organization: string;
  /** 게시판 내 세부 분류 태그 (예: 교직, 학적, 수업/성적, 장학 등) */
  subCategoryTag?: string;
  /** 동국e음 표준 공지 분류 */
  category: NoticeCategory;
  /** 공지 제목 */
  title: string;
  /** 한 줄 요약 (메타데이터 기반 안내, 본문 무단 복제 안 함) */
  summary: string;
  /** 작성자 / 부서명 */
  authorName: string;
  /** 작성일 (YYYY-MM-DD) */
  createdAt: string;
  /** 상단 고정 공지 여부 */
  isPinned: boolean;
  /** 첨부파일 포함 여부 */
  hasAttachment: boolean;
  /** 조회수 */
  viewCount: number;
  /** 공식 홈페이지 원문 URL */
  officialUrl: string;
  /** 공식 홈페이지 자동 수집 여부 (관리자 직접 작성 공지와 구분) */
  isOfficialSynced: true;
  /** 신규 공지 여부 (최근 7일 이내 작성 또는 신규 수집) */
  isNew: boolean;
  /** 최초 수집 시각 (ISO 8601) */
  collectedAt: string;
  /** 마지막 확인 시각 (ISO 8601) */
  lastVerifiedAt: string;
  /** 원문 상태: active(정상), updated(제목/정보 변경 감지), unverified(일시 오류로 미확인) */
  syncState: "active" | "updated" | "unverified";
  /** 캘린더 일정 분류 상태: confirmed(일정 확정), needs_review(날짜 불확실·관리자 검토 필요), none(일반 안내) */
  scheduleStatus: ScheduleStatus;
  /** 추출된 일정 시작일 (YYYY-MM-DD, confirmed 일 때만 존재) */
  eventStartDate?: string;
  /** 추출된 일정 종료일 (YYYY-MM-DD, confirmed 일 때만 존재) */
  eventEndDate?: string;
  /** 제목에서 감지된 일정 원문 표현 (예: "11/2~11/4") */
  extractedDateText?: string;
}

export interface NoticeSourceMeta {
  sourceId: OfficialSourceId;
  name: string;
  organization: string;
  boardUrl: string;
  detailBaseUrl: string;
  defaultCategory: NoticeCategory;
  layoutType: "department_table" | "main_list";
}

export const OFFICIAL_NOTICE_SOURCES: NoticeSourceMeta[] = [
  {
    sourceId: "edu_dept_news2",
    name: "교육학과 학부 공지",
    organization: "동국대학교 교육학과",
    boardUrl: "https://education.dongguk.edu/article/news2/list",
    detailBaseUrl: "https://education.dongguk.edu/article/news2/detail/",
    defaultCategory: "교육학과 공지",
    layoutType: "department_table",
  },
  {
    sourceId: "edu_dept_news1",
    name: "교육학과 학과소식",
    organization: "동국대학교 교육학과",
    boardUrl: "https://education.dongguk.edu/article/news1/list",
    detailBaseUrl: "https://education.dongguk.edu/article/news1/detail/",
    defaultCategory: "교육학과 공지",
    layoutType: "department_table",
  },
  {
    sourceId: "edu_college_notice",
    name: "사범대학 공지사항",
    organization: "동국대학교 사범대학",
    boardUrl: "https://edu.dongguk.edu/article/notice/list",
    detailBaseUrl: "https://edu.dongguk.edu/article/notice/detail/",
    defaultCategory: "교직 관련 안내",
    layoutType: "department_table",
  },
  {
    sourceId: "dgu_haksa",
    name: "동국대학교 학사공지",
    organization: "동국대학교 교무처(학사)",
    boardUrl: "https://www.dongguk.edu/article/HAKSANOTICE/list",
    detailBaseUrl: "https://www.dongguk.edu/article/HAKSANOTICE/detail/",
    defaultCategory: "학사 일정",
    layoutType: "main_list",
  },
  {
    sourceId: "dgu_janghak",
    name: "동국대학교 장학공지",
    organization: "동국대학교 학생처(장학)",
    boardUrl: "https://www.dongguk.edu/article/JANGHAKNOTICE/list",
    detailBaseUrl: "https://www.dongguk.edu/article/JANGHAKNOTICE/detail/",
    defaultCategory: "장학 및 지원",
    layoutType: "main_list",
  },
  {
    sourceId: "dgu_general",
    name: "동국대학교 일반공지",
    organization: "동국대학교",
    boardUrl: "https://www.dongguk.edu/article/GENERALNOTICES/list",
    detailBaseUrl: "https://www.dongguk.edu/article/GENERALNOTICES/detail/",
    defaultCategory: "학교 공지",
    layoutType: "main_list",
  },
];

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function normalizeDateString(raw: string): string {
  const m = raw.trim().match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return raw.trim();
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * 공지 제목과 게시판 세부 분류 태그를 바탕으로 동국e음 표준 카테고리를 결정합니다.
 */
export function classifyNoticeCategory(
  source: NoticeSourceMeta,
  title: string,
  subTag?: string
): NoticeCategory {
  const tag = (subTag || "").trim();
  const t = title.trim();

  if (tag === "교직" || /교직|교원자격|교육실습|교육봉사|임용|교직적성|인성검사|응급처치/.test(t)) {
    return "교직 관련 안내";
  }
  if (source.sourceId === "edu_dept_news2" || source.sourceId === "edu_dept_news1") {
    if (/장학|장학생|지원금|근로/.test(t)) {
      return "장학 및 지원";
    }
    return "교육학과 공지";
  }
  if (source.sourceId === "dgu_janghak" || tag === "장학" || /장학|장학생|학자금|국가근로/.test(t)) {
    return "장학 및 지원";
  }
  if (
    source.sourceId === "dgu_haksa" ||
    tag === "학적" ||
    tag === "수업/성적" ||
    tag === "계절학기" ||
    tag === "국내학점교류" ||
    tag === "등록" ||
    /수강신청|다전공|복수전공|전공결정|계절학기|휴학|복학|졸업|학점|성적|재수강|전과/.test(t)
  ) {
    return "학사 일정";
  }
  if (source.sourceId === "edu_college_notice") {
    return "교직 관련 안내";
  }
  return source.defaultCategory;
}

/**
 * 공지 제목에서 신청 기간·행사 일시를 추출합니다.
 * - 절대 게시글 작성일(createdAt)을 행사일로 잘못 해석하지 않습니다.
 * - 제목에 명시적인 날짜(예: 11/2~11/4, 2026.10.28~11.5, 11월 15일)가 있을 때만 confirmed 로 판정합니다.
 * - '신청', '모집', '접수', '특강', '학술제', '설문', '시행' 등 일정 키워드가 있으나 날짜가 제목에 없으면
 *   needs_review(관리자 검토 필요)로 분류하고 캘린더에 자동 등록하지 않습니다.
 */
export function extractScheduleFromTitle(
  title: string,
  createdAt: string
): {
  scheduleStatus: ScheduleStatus;
  eventStartDate?: string;
  eventEndDate?: string;
  extractedDateText?: string;
} {
  const baseYearMatch = createdAt.match(/^(\d{4})/);
  const baseYear = baseYearMatch ? Number(baseYearMatch[1]) : new Date().getFullYear();

  const pad = (n: number) => String(n).padStart(2, "0");
  const validMonthDay = (m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31;

  // 1) YYYY.MM.DD ~ (YYYY.)MM.DD 형태
  const fullRangeRegex =
    /(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})일?(?:\([월화수목금토일]\))?\s*[~∼\-–]\s*(?:(20\d{2})[.\-/년\s]+)?(\d{1,2})[.\-/월\s]+(\d{1,2})일?/;
  const mFullRange = title.match(fullRangeRegex);
  if (mFullRange) {
    const y1 = Number(mFullRange[1]);
    const mo1 = Number(mFullRange[2]);
    const d1 = Number(mFullRange[3]);
    const y2 = mFullRange[4] ? Number(mFullRange[4]) : mo1 > Number(mFullRange[5]) ? y1 + 1 : y1;
    const mo2 = Number(mFullRange[5]);
    const d2 = Number(mFullRange[6]);
    if (validMonthDay(mo1, d1) && validMonthDay(mo2, d2)) {
      return {
        scheduleStatus: "confirmed",
        eventStartDate: `${y1}-${pad(mo1)}-${pad(d1)}`,
        eventEndDate: `${y2}-${pad(mo2)}-${pad(d2)}`,
        extractedDateText: mFullRange[0].trim(),
      };
    }
  }

  // 2) MM/DD ~ MM/DD 또는 MM.DD ~ MM.DD 또는 M월 D일 ~ M월 D일 형태
  const shortRangeRegex =
    /(?:기간\s*[:：]?\s*)?(\d{1,2})\s*(?:\/|\.|월\s*)(\d{1,2})일?(?:\([월화수목금토일]\))?\s*[~∼\-–]\s*(\d{1,2})\s*(?:\/|\.|월\s*)(\d{1,2})일?(?:\([월화수목금토일]\))?/;
  const mShortRange = title.match(shortRangeRegex);
  if (mShortRange) {
    const mo1 = Number(mShortRange[1]);
    const d1 = Number(mShortRange[2]);
    const mo2 = Number(mShortRange[3]);
    const d2 = Number(mShortRange[4]);
    if (validMonthDay(mo1, d1) && validMonthDay(mo2, d2)) {
      const y1 = baseYear;
      const y2 = mo2 < mo1 ? baseYear + 1 : baseYear;
      return {
        scheduleStatus: "confirmed",
        eventStartDate: `${y1}-${pad(mo1)}-${pad(d1)}`,
        eventEndDate: `${y2}-${pad(mo2)}-${pad(d2)}`,
        extractedDateText: mShortRange[0].trim(),
      };
    }
  }

  // 3) 단일 명시 날짜: (일시: 11/15) 또는 (~11/20까지) 또는 11월 20일(금)
  const deadlineRegex =
    /(?:~|∼|기한\s*[:：]?\s*|마감\s*[:：]?\s*|일시\s*[:：]?\s*)(\d{1,2})\s*(?:\/|\.|월\s*)(\d{1,2})일?(?:\([월화수목금토일]\))?(?:까지)?/;
  const mDeadline = title.match(deadlineRegex);
  if (mDeadline) {
    const mo = Number(mDeadline[1]);
    const d = Number(mDeadline[2]);
    if (validMonthDay(mo, d)) {
      const dateStr = `${baseYear}-${pad(mo)}-${pad(d)}`;
      return {
        scheduleStatus: "confirmed",
        eventStartDate: dateStr,
        eventEndDate: dateStr,
        extractedDateText: mDeadline[0].trim(),
      };
    }
  }

  // 4) 제목에 신청/모집/접수/특강/학술제/설문/포기/신청안내 키워드가 있으나 날짜가 제목에 없는 경우 -> 관리자 검토 필요
  if (/신청|모집|접수|특강|학술제|설문|시행|대회|공모|제출|마감|등록/.test(title)) {
    return {
      scheduleStatus: "needs_review",
    };
  }

  return {
    scheduleStatus: "none",
  };
}

/**
 * 교육학과(education.dongguk.edu) 및 사범대학(edu.dongguk.edu) 테이블형 게시판 HTML 파싱
 */
export function parseDepartmentTableHtml(
  html: string,
  source: NoticeSourceMeta,
  nowIso: string = new Date().toISOString()
): OfficialNoticeItem[] {
  const results: OfficialNoticeItem[] = [];
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return results;

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
    const rowHtml = trMatch[1];

    // article_seq 추출: onclick="goDetail(215755);" 또는 href="/article/.../detail/216102..."
    const seqOnClick = rowHtml.match(/goDetail\(\s*['"]?(\d+)['"]?\s*\)/i);
    const seqHref = rowHtml.match(/\/article\/[^/]+\/detail\/(\d+)/i);
    const articleSeq = seqOnClick?.[1] || seqHref?.[1];
    if (!articleSeq) continue;

    // 상단 고정 여부
    const isPinned = /<span[^>]*class=["'][^"']*mark[^"']*["'][^>]*>\s*공지\s*<\/span>/i.test(rowHtml);

    // 제목 영역 추출
    const tdTitMatch = rowHtml.match(/<td[^>]*class=["'][^"']*td_tit[^"']*["'][^>]*>([\s\S]*?)<\/td>/i);
    if (!tdTitMatch) continue;
    const aMatch = tdTitMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;

    let rawAnchorInner = aMatch[1];
    let subCategoryTag: string | undefined;

    // 사범대학 등 <span>교직</span> 카테고리 태그 분리
    const spanTagMatch = rawAnchorInner.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
    if (spanTagMatch) {
      subCategoryTag = decodeHtmlEntities(spanTagMatch[1].replace(/<[^>]+>/g, "").trim());
      rawAnchorInner = rawAnchorInner.replace(spanTagMatch[0], " ");
    }

    const title = decodeHtmlEntities(
      rawAnchorInner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (!title) continue;

    // 작성자, 작성일, 조회수 추출
    const authorMatch = rowHtml.match(/<td[^>]*class=["'][^"']*td_write[^"']*["'][^>]*>([\s\S]*?)<\/td>/i);
    const authorName = authorMatch
      ? decodeHtmlEntities(authorMatch[1].replace(/<[^>]+>/g, "").trim())
      : source.organization;

    const dateMatch = rowHtml.match(/<td>\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*<\/td>/i);
    const createdAt = dateMatch ? normalizeDateString(dateMatch[1]) : nowIso.slice(0, 10);

    const allTds = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );
    const viewStr = allTds.find((v) => /^\d+$/.test(v)) || "0";
    const viewCount = Number(viewStr) || 0;

    const hasAttachment = /has_file|첨부파일/i.test(rowHtml);

    const officialUrl = `${source.detailBaseUrl}${articleSeq}`;
    const category = classifyNoticeCategory(source, title, subCategoryTag);
    const schedule = extractScheduleFromTitle(title, createdAt);

    const daysDiff =
      (new Date(nowIso.slice(0, 10)).getTime() - new Date(createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const isNew = daysDiff >= -1 && daysDiff <= 7;

    results.push({
      id: `${source.sourceId}_${articleSeq}`,
      articleSeq,
      sourceId: source.sourceId,
      organization: source.organization,
      subCategoryTag,
      category,
      title,
      summary: `[${source.name}] ${source.organization}에서 게시한 공식 공지입니다. 자세한 본문과 첨부파일은 공식 원문 링크에서 확인하세요.`,
      authorName: authorName || source.organization,
      createdAt,
      isPinned,
      hasAttachment,
      viewCount,
      officialUrl,
      isOfficialSynced: true,
      isNew,
      collectedAt: nowIso,
      lastVerifiedAt: nowIso,
      syncState: "active",
      ...schedule,
    });
  }

  return results;
}

/**
 * 동국대학교 본교(www.dongguk.edu) 리스트형 게시판 HTML 파싱
 */
export function parseMainCampusListHtml(
  html: string,
  source: NoticeSourceMeta,
  nowIso: string = new Date().toISOString()
): OfficialNoticeItem[] {
  const results: OfficialNoticeItem[] = [];
  const boardMatch = html.match(/<div[^>]*class=["'][^"']*board_list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (!boardMatch) return results;

  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;
  while ((liMatch = liRegex.exec(boardMatch[1])) !== null) {
    const itemHtml = liMatch[1];

    const seqMatch =
      itemHtml.match(/goDetail\(\s*['"]?(\d+)['"]?\s*\)/i) ||
      itemHtml.match(/\/article\/[^/]+\/detail\/(\d+)/i);
    const articleSeq = seqMatch?.[1];
    if (!articleSeq) continue;

    const isPinned = /<span[^>]*class=["'][^"']*fix[^"']*["'][^>]*>/i.test(itemHtml);

    const emMatch = itemHtml.match(/<em>([\s\S]*?)<\/em>/i);
    const subCategoryTag = emMatch
      ? decodeHtmlEntities(emMatch[1].replace(/<[^>]+>/g, "").trim())
      : undefined;

    const titMatch = itemHtml.match(/<p[^>]*class=["'][^"']*tit[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    if (!titMatch) continue;

    // <span class="mobile">공지</span> 제거 후 텍스트 추출
    const cleanTitHtml = titMatch[1].replace(
      /<span[^>]*class=["'][^"']*mobile[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
      " "
    );
    const title = decodeHtmlEntities(
      cleanTitHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (!title) continue;

    const dateMatch = itemHtml.match(/(\d{4}\.\d{1,2}\.\d{1,2})\.?/);
    const createdAt = dateMatch ? normalizeDateString(dateMatch[1]) : nowIso.slice(0, 10);

    const viewMatch = itemHtml.match(/조회\s*(\d+)/);
    const viewCount = viewMatch ? Number(viewMatch[1]) : 0;

    const hasAttachment = /class=["'][^"']*file[^"']*["']|첨부파일/i.test(itemHtml);

    const officialUrl = `${source.detailBaseUrl}${articleSeq}`;
    const category = classifyNoticeCategory(source, title, subCategoryTag);
    const schedule = extractScheduleFromTitle(title, createdAt);

    const daysDiff =
      (new Date(nowIso.slice(0, 10)).getTime() - new Date(createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const isNew = daysDiff >= -1 && daysDiff <= 7;

    results.push({
      id: `${source.sourceId}_${articleSeq}`,
      articleSeq,
      sourceId: source.sourceId,
      organization: source.organization,
      subCategoryTag,
      category,
      title,
      summary: `[${source.name}${subCategoryTag ? ` · ${subCategoryTag}` : ""}] ${source.organization} 공식 공지사항입니다. 원문 이동 버튼을 눌러 상세 내용과 첨부파일을 확인하세요.`,
      authorName: source.organization,
      createdAt,
      isPinned,
      hasAttachment,
      viewCount,
      officialUrl,
      isOfficialSynced: true,
      isNew,
      collectedAt: nowIso,
      lastVerifiedAt: nowIso,
      syncState: "active",
      ...schedule,
    });
  }

  return results;
}

/**
 * 기존 수집 공지 목록과 새로 수집한 공지 목록을 안전하게 병합합니다.
 * - 원문 URL(officialUrl) 또는 고유 ID(id)를 기준으로 중복을 제거합니다.
 * - 기존 공지의 제목/분류가 수정된 경우 syncState: "updated" 로 표시하고 최초 수집 시각(collectedAt)은 유지합니다.
 * - 일시적인 수집 실패(failedSourceIds)가 발생한 출처의 기존 공지는 삭제하지 않고 그대로 보존합니다.
 */
export function mergeAndDeduplicateNotices(params: {
  existingNotices: OfficialNoticeItem[];
  fetchedNotices: OfficialNoticeItem[];
  failedSourceIds?: OfficialSourceId[];
  nowIso?: string;
}): OfficialNoticeItem[] {
  const nowIso = params.nowIso || new Date().toISOString();
  const failedSet = new Set<OfficialSourceId>(params.failedSourceIds || []);

  const byId = new Map<string, OfficialNoticeItem>();
  const urlToId = new Map<string, string>();

  for (const oldItem of params.existingNotices) {
    byId.set(oldItem.id, oldItem);
    urlToId.set(oldItem.officialUrl, oldItem.id);
  }

  const seenIdsInFetch = new Set<string>();

  for (const fresh of params.fetchedNotices) {
    const existingId = byId.has(fresh.id)
      ? fresh.id
      : urlToId.get(fresh.officialUrl);

    if (existingId && byId.has(existingId)) {
      const prev = byId.get(existingId)!;
      const isModified =
        prev.title !== fresh.title || prev.category !== fresh.category;
      const merged: OfficialNoticeItem = {
        ...fresh,
        id: prev.id,
        collectedAt: prev.collectedAt || fresh.collectedAt,
        lastVerifiedAt: nowIso,
        syncState: isModified ? "updated" : "active",
      };
      byId.set(prev.id, merged);
      seenIdsInFetch.add(prev.id);
    } else {
      byId.set(fresh.id, {
        ...fresh,
        collectedAt: nowIso,
        lastVerifiedAt: nowIso,
        syncState: "active",
      });
      urlToId.set(fresh.officialUrl, fresh.id);
      seenIdsInFetch.add(fresh.id);
    }
  }

  // 일시적인 수집 오류가 발생한 출처의 공지는 삭제하지 않고 그대로 유지
  for (const [id, item] of byId.entries()) {
    if (!seenIdsInFetch.has(id) && failedSet.has(item.sourceId)) {
      byId.set(id, {
        ...item,
        syncState: "unverified",
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const cmp = b.createdAt.localeCompare(a.createdAt);
    if (cmp !== 0) return cmp;
    return Number(b.articleSeq) - Number(a.articleSeq);
  });
}

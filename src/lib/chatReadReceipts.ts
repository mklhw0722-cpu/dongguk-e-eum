/**
 * 동국e음 채팅 읽음 표시(Read Receipt) 계산 로직
 *
 * [저장 방식: 참여자별 "읽은 위치(커서)" 방식]
 * - 채팅방 문서(chats/{chatId})에 다음 3가지만 저장합니다. 메시지마다 읽은 사람 목록을 저장하지 않습니다.
 *   1) msgSeq            : 이 방에서 지금까지 보낸 일반 메시지의 마지막 순번 (메시지를 보낼 때마다 +1)
 *   2) readSeq[uid]      : 각 참여자가 마지막으로 읽은 메시지 순번 (값은 커지기만 하고 절대 줄어들지 않음)
 *   3) joinSeq[uid]      : 각 참여자가 방에 들어온 시점의 msgSeq (초대 이전 메시지를 "안 읽음"으로 세지 않기 위함)
 * - 각 메시지(chats/{chatId}/messages/{id})에는 seq(순번) 하나만 추가로 저장합니다.
 *
 * [계산 규칙]
 * - 사용자의 실제 읽은 위치 = max(readSeq[uid], joinSeq[uid])
 * - 메시지 옆 숫자 = (현재 참여자 중) 보낸 사람을 제외하고, 읽은 위치가 그 메시지 순번보다 작은 사람 수
 * - 방 목록 안 읽은 개수 = max(0, msgSeq - 내 읽은 위치)
 *   (메시지를 보내면 내 readSeq 도 그 순번으로 함께 올라가므로, 내가 보낸 메시지는 내 안 읽은 개수에 포함되지 않음)
 * - 방을 나간 사람은 participants 에서 빠지므로 숫자 계산에서 제외됩니다.
 * - seq 가 없는 예전 메시지(기능 도입 이전 메시지)와 시스템 안내 메시지는 숫자를 표시하지 않습니다.
 */

export interface ReadStateRoom {
  participants: string[];
  msgSeq?: number;
  readSeq?: Record<string, number>;
  joinSeq?: Record<string, number>;
}

export interface ReadStateMessage {
  senderId: string;
  seq?: number;
  isSystemMessage?: boolean;
}

function safeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** 사용자의 실제 읽은 위치 (초대 시점 이전 메시지는 이미 읽은 것으로 간주) */
export function effectiveReadSeq(room: ReadStateRoom, uid: string): number {
  return Math.max(safeInt(room.readSeq?.[uid]), safeInt(room.joinSeq?.[uid]));
}

/** 메시지 옆에 표시할 "아직 읽지 않은 사람 수" (0 이면 표시하지 않음) */
export function unreadCountForMessage(message: ReadStateMessage, room: ReadStateRoom): number {
  if (message.isSystemMessage) return 0;
  const seq = safeInt(message.seq);
  if (seq === 0) return 0; // 예전 메시지(순번 없음)는 표시하지 않음
  let count = 0;
  for (const uid of new Set(room.participants || [])) {
    if (uid === message.senderId) continue;
    if (effectiveReadSeq(room, uid) < seq) count += 1;
  }
  return count;
}

/** 채팅방 목록에 표시할 내 안 읽은 메시지 수 */
export function unreadCountForUser(room: ReadStateRoom, uid: string): number {
  if (!(room.participants || []).includes(uid)) return 0;
  return Math.max(0, safeInt(room.msgSeq) - effectiveReadSeq(room, uid));
}

/** 안 읽은 개수 배지 문구 (100 이상이면 99+) */
export function formatUnreadBadge(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}

export interface MarkReadConditions {
  /** 이 채팅방이 현재 화면에서 열려 있는지 */
  isRoomOpen: boolean;
  /** 브라우저 탭이 화면에 보이는 상태인지 (document.visibilityState === "visible") */
  isPageVisible: boolean;
  /** 이 채팅방의 메시지를 서버에서 실제로 불러왔는지 */
  messagesLoaded: boolean;
  /** 사용자가 메시지 목록의 가장 아래(최신 메시지)를 보고 있는지 */
  isScrolledToLatest: boolean;
  /** 화면에 불러온 메시지 중 가장 큰 순번 */
  latestLoadedSeq: number;
  /** 현재 Firestore 에 저장된 내 읽은 위치 */
  currentReadSeq: number;
}

/**
 * 읽음 처리할 순번을 반환합니다. 읽음 처리하면 안 되는 상황이면 null.
 * - 로그인만 되어 있다고 읽음 처리하지 않습니다. 방이 열려 있고, 탭이 보이고, 메시지를 불러왔고,
 *   최신 메시지가 보이는 위치까지 내려와 있을 때만 "화면에서 확인 가능한 상태"로 보고 읽음 처리합니다.
 * - 불러오지 않은 메시지 순번까지 앞질러 읽음 처리하지 않습니다(latestLoadedSeq 까지만).
 * - 이미 읽은 위치보다 작거나 같으면 쓰지 않습니다 (불필요한 쓰기 방지 + 역행 방지).
 */
export function computeMarkReadTarget(c: MarkReadConditions): number | null {
  if (!c.isRoomOpen || !c.isPageVisible || !c.messagesLoaded || !c.isScrolledToLatest) return null;
  const target = safeInt(c.latestLoadedSeq);
  if (target <= safeInt(c.currentReadSeq)) return null;
  return target;
}

/** 메시지 정렬: 순번(seq)이 둘 다 있으면 순번 우선, 없으면 기존 시간 정렬 결과를 따름 */
export function compareBySeq(a: ReadStateMessage, b: ReadStateMessage): number {
  const sa = safeInt(a.seq);
  const sb = safeInt(b.seq);
  if (sa > 0 && sb > 0 && sa !== sb) return sa - sb;
  return 0;
}


/**
 * 채팅방 참여 구성원 카드용 학번 포맷터
 * - 관리자(admin) / 교수(professor): 복전 및 학번 일체 미표시 (빈 문자열)
 * - 재학생(student) / 졸업생(alumni): '00학번'만 깔끔하게 표시
 */
export function formatChatMemberHakbun(u: {
  role?: string;
  studentIdOrYear?: string;
  bio?: string;
}): string {
  if (!u || u.role === "admin" || u.role === "professor") {
    return "";
  }
  const raw = `${u.studentIdOrYear || ""} ${u.bio || ""}`.trim();
  const matchHakbun = raw.match(/(\d{2})\s*학번/);
  if (matchHakbun) return `${matchHakbun[1]}학번`;
  const matchYear = raw.match(/20(\d{2})/);
  if (matchYear) return `${matchYear[1]}학번`;
  const matchOldYear = raw.match(/19(\d{2})/);
  if (matchOldYear) return `${matchOldYear[1]}학번`;
  const matchNum = raw.match(/^\d{2}/);
  if (matchNum) return `${matchNum[0]}학번`;
  return "";
}

/** 정렬 대상 대화방의 타임스탬프 필드 인터페이스 */
export interface SortableChatRoom {
  id?: string;
  title?: string;
  lastMessageTimestamp?: number | null;
  lastMessageIso?: string | null;
  lastMessageAt?: string | null;
  createdAtTimestamp?: number | null;
  createdAt?: string | null;
}

/**
 * 한국어 또는 표준 시간 문자열("오후 11:03", "오전 09:15", "14:30")을 기준 날짜와 결합하여 밀리초로 변환합니다.
 */
export function parseTimeStringToMs(timeStr: string, baseDateStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // 1) 전체 날짜+시간 형태(ISO 8601 등)로 바로 파싱 가능한 경우
  const directParse = Date.parse(trimmed);
  if (!Number.isNaN(directParse) && directParse > 100000000000) {
    return directParse;
  }

  // 2) "오전/오후 HH:MM" 또는 "AM/PM HH:MM" 또는 "HH:MM" 정규식 매칭
  const match = trimmed.match(/(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})[:시\s]+(\d{1,2})/);
  if (!match) return null;

  const meridian = (match[1] || "").toLowerCase();
  let hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  if (meridian === "오후" || meridian === "pm") {
    if (hours < 12) hours += 12;
  } else if (meridian === "오전" || meridian === "am") {
    if (hours === 12) hours = 0;
  }

  // 기준 날짜 결합: createdAt(예: "2026-11-12")이 있으면 해당 날짜에 시간을 결합
  let year = 1970;
  let month = 0;
  let date = 1;

  if (baseDateStr && typeof baseDateStr === "string") {
    const bMatch = baseDateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (bMatch) {
      year = parseInt(bMatch[1], 10);
      month = parseInt(bMatch[2], 10) - 1;
      date = parseInt(bMatch[3], 10);
    } else {
      const bParsed = Date.parse(baseDateStr.trim());
      if (!Number.isNaN(bParsed) && bParsed > 0) {
        const dObj = new Date(bParsed);
        year = dObj.getFullYear();
        month = dObj.getMonth();
        date = dObj.getDate();
      }
    }
  }

  // 기준 날짜가 없거나 유효하지 않으면 2026년을 기본 기준년으로 설정(동국e음 기준)
  if (year === 1970) {
    const today = new Date();
    year = today.getFullYear();
    month = today.getMonth();
    date = today.getDate();
  }

  return new Date(year, month, date, hours, minutes, 0, 0).getTime();
}

/**
 * 대화방 객체에서 최신 메시지 정렬을 위한 단일 정규 밀리초(Epoch ms)를 안전하게 산출합니다.
 *
 * 우선순위:
 * 1. lastMessageTimestamp (숫자 밀리초 - 정밀도 최고)
 * 2. lastMessageIso (ISO 문자열 파싱)
 * 3. lastMessageAt (한국어 시간 문자열 파싱 + createdAt 결합)
 * 4. createdAtTimestamp (방 생성 시각 밀리초)
 * 5. createdAt (방 생성 날짜 파싱)
 * 6. ID 내 포함된 타임스탬프 (group_176295... 등)
 * 7. 0 (필드가 아예 없는 레거시 방도 누락 없이 맨 아래에 안전하게 유지)
 */
export function resolveChatSortTimestamp(room: SortableChatRoom | null | undefined): number {
  if (!room) return 0;

  // 1. lastMessageTimestamp
  if (
    typeof room.lastMessageTimestamp === "number" &&
    Number.isFinite(room.lastMessageTimestamp) &&
    room.lastMessageTimestamp > 0
  ) {
    return Math.floor(room.lastMessageTimestamp);
  }

  // 2. lastMessageIso
  if (typeof room.lastMessageIso === "string" && room.lastMessageIso.trim()) {
    const isoMs = Date.parse(room.lastMessageIso.trim());
    if (!Number.isNaN(isoMs) && isoMs > 0) {
      return isoMs;
    }
  }

  // 3. lastMessageAt
  if (typeof room.lastMessageAt === "string" && room.lastMessageAt.trim()) {
    const parsedMs = parseTimeStringToMs(room.lastMessageAt, room.createdAt);
    if (parsedMs !== null && parsedMs > 0) {
      return parsedMs;
    }
  }

  // 4. createdAtTimestamp
  if (
    typeof room.createdAtTimestamp === "number" &&
    Number.isFinite(room.createdAtTimestamp) &&
    room.createdAtTimestamp > 0
  ) {
    return Math.floor(room.createdAtTimestamp);
  }

  // 5. createdAt
  if (typeof room.createdAt === "string" && room.createdAt.trim()) {
    const createdMs = Date.parse(room.createdAt.trim());
    if (!Number.isNaN(createdMs) && createdMs > 0) {
      return createdMs;
    }
  }

  // 6. ID 내에 포함된 타임스탬프 (예: group_1762955000000_abc)
  if (typeof room.id === "string") {
    const matchId = room.id.match(/_(\d{10,13})_/);
    if (matchId) {
      const idMs = parseInt(matchId[1], 10);
      if (!Number.isNaN(idMs) && idMs > 0) {
        return idMs;
      }
    }
  }

  return 0;
}

/**
 * 두 대화방을 최신 메시지 시각 기준으로 내림차순(최신이 앞) 비교합니다.
 * - 시각이 동일한 경우 id를 기준으로 안정적인 정렬(stable sort)을 보장합니다.
 */
export function compareChatRoomsByLatestMessage(
  a: SortableChatRoom,
  b: SortableChatRoom
): number {
  const tsA = resolveChatSortTimestamp(a);
  const tsB = resolveChatSortTimestamp(b);
  if (tsB !== tsA) {
    return tsB - tsA;
  }
  return (b.id || "").localeCompare(a.id || "");
}

/**
 * 대화방 목록을 최신 메시지 시각 기준으로 내림차순 정렬하여 새 배열로 반환합니다.
 */
export function sortConversationsByLatestMessage<T extends SortableChatRoom>(
  rooms: T[]
): T[] {
  if (!Array.isArray(rooms)) return [];
  return [...rooms].sort(compareChatRoomsByLatestMessage);
}

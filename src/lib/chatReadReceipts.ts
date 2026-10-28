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

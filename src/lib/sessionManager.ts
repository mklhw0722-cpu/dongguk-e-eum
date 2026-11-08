/**
 * 동국e음 1시간(60분) 로그인 유지 및 자동 로그아웃 세션 관리자
 *
 * 핵심 정책:
 * 1. 로그인 성공 시점부터 정확히 60분(3,600,000ms) 동안 로그인 상태 유지
 * 2. 로그인 후 50분 경과(만료 10분 전, 남은 시간 <= 600,000ms) 시 세션 만료 안내 표시
 * 3. 사용자가 명시적으로 '로그인 연장' 버튼을 누른 경우에만 클릭 시점부터 다시 60분 유지
 * 4. 마우스 이동, 키보드 입력, 페이지 이동, 새로고침, 채팅 활동으로는 절대 자동 연장되지 않음
 * 5. 페이지 새로고침 및 브라우저 재실행 시에도 기존 만료 시각(expiresAt) 유지 (이미 만료된 경우 즉시 로그아웃)
 * 6. 로컬 스토리지 만료 시각 임의 조작 방지를 위한 무결성 해시(integrityHash) 및 최대 허용 시간(60분) 검증
 * 7. 다중 탭(Multi-tab) 간 로그인·연장·만료·로그아웃 상태 실시간 동기화 (storage 이벤트 + BroadcastChannel)
 */

export const SESSION_DURATION_MS = 60 * 60 * 1000; // 60분 (3,600,000ms)
export const SESSION_WARNING_THRESHOLD_MS = 10 * 60 * 1000; // 만료 10분 전 (600,000ms, 즉 로그인 50분 경과 시점)
export const SESSION_CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // 시계 오차 허용 범위 (1분)

export const SESSION_STORAGE_KEY = "dongguk_e_eum_auth_session_v1";
export const SESSION_EXPIRED_NOTICE_KEY = "dongguk_e_eum_session_expired_notice_v1";
export const SESSION_BROADCAST_CHANNEL = "dongguk_e_eum_session_sync_v1";

export const SESSION_EXPIRY_WARNING_MESSAGE =
  "로그인 시간이 10분 후 만료됩니다. 계속 이용하려면 로그인 시간을 연장해 주세요.";

export interface AuthSessionRecord {
  uid: string;
  startedAt: number;
  expiresAt: number;
  extendedCount: number;
  lastExtendedAt?: number;
  integrityHash: string;
}

export type SessionPhase =
  | "no_session"
  | "active"
  | "warning"
  | "expired"
  | "invalid";

export interface SessionEvaluation {
  phase: SessionPhase;
  remainingMs: number;
  remainingSeconds: number;
  isWarningVisible: boolean;
  isExpired: boolean;
  formattedMMSS: string;
  formattedKorean: string;
}

export type SessionSyncMessage =
  | { type: "SESSION_UPDATED"; record: AuthSessionRecord }
  | { type: "SESSION_CLEARED"; reason: "logout" | "expired" };

const INTEGRITY_SALT = "dongguk-e-eum-edu-session-v1-salt-2026";

/**
 * 클라이언트 localStorage 내 expiresAt 단순 수정(DevTools 조작)을 감지하기 위한 결정론적 무결성 해시 생성
 */
export function computeSessionIntegrityHash(
  uid: string,
  startedAt: number,
  expiresAt: number,
  extendedCount: number
): string {
  const payload = `${INTEGRITY_SALT}:${uid}:${startedAt}:${expiresAt}:${extendedCount}`;
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * 최초 로그인 시 60분 세션 레코드 생성
 */
export function createNewSession(
  uid: string,
  nowMs: number = Date.now()
): AuthSessionRecord {
  const startedAt = Math.floor(nowMs);
  const expiresAt = startedAt + SESSION_DURATION_MS;
  const extendedCount = 0;
  return {
    uid,
    startedAt,
    expiresAt,
    extendedCount,
    integrityHash: computeSessionIntegrityHash(uid, startedAt, expiresAt, extendedCount),
  };
}

/**
 * 사용자가 명시적으로 '로그인 연장' 버튼을 클릭했을 때 호출
 * 클릭 시점(nowMs)부터 다시 정확히 60분을 부여합니다.
 */
export function extendSessionRecord(
  current: AuthSessionRecord,
  nowMs: number = Date.now()
): AuthSessionRecord {
  const startedAt = Math.floor(nowMs);
  const expiresAt = startedAt + SESSION_DURATION_MS;
  const extendedCount = (current.extendedCount || 0) + 1;
  return {
    uid: current.uid,
    startedAt,
    expiresAt,
    extendedCount,
    lastExtendedAt: startedAt,
    integrityHash: computeSessionIntegrityHash(current.uid, startedAt, expiresAt, extendedCount),
  };
}

/**
 * 저장된 세션 레코드의 유효성 및 위변조 여부 검증
 * - UID 불일치, 비정상 숫자, 60분 초과 만료 시각 조작, 미래 시작 시각, 해시 불일치 시 false 반환
 */
export function validateSessionRecord(
  record: unknown,
  expectedUid: string | null | undefined,
  nowMs: number = Date.now()
): record is AuthSessionRecord {
  if (!record || typeof record !== "object" || !expectedUid) return false;
  const r = record as Partial<AuthSessionRecord>;

  if (typeof r.uid !== "string" || r.uid !== expectedUid) return false;
  if (typeof r.startedAt !== "number" || !Number.isFinite(r.startedAt)) return false;
  if (typeof r.expiresAt !== "number" || !Number.isFinite(r.expiresAt)) return false;
  if (typeof r.extendedCount !== "number" || r.extendedCount < 0 || !Number.isInteger(r.extendedCount)) {
    return false;
  }
  if (typeof r.integrityHash !== "string" || !r.integrityHash) return false;

  // 세션 길이가 60분을 초과하거나 0 이하인 경우 (임의 조작 차단)
  const duration = r.expiresAt - r.startedAt;
  if (duration <= 0 || duration > SESSION_DURATION_MS) return false;

  // 시작 시각이 현재 시각보다 비정상적인 미래인 경우 차단
  if (r.startedAt > nowMs + SESSION_CLOCK_SKEW_TOLERANCE_MS) return false;

  // 만료 시각이 현재 시각으로부터 60분(+오차)을 초과하는 경우 차단
  if (r.expiresAt > nowMs + SESSION_DURATION_MS + SESSION_CLOCK_SKEW_TOLERANCE_MS) return false;

  // 무결성 해시 대조
  const expectedHash = computeSessionIntegrityHash(
    r.uid,
    r.startedAt,
    r.expiresAt,
    r.extendedCount
  );
  if (r.integrityHash !== expectedHash) return false;

  return true;
}

/**
 * 남은 시간(ms)을 MM:SS 및 'M분 S초' 형태로 포맷팅
 */
export function formatRemainingTime(remainingMs: number): {
  formattedMMSS: string;
  formattedKorean: string;
  remainingSeconds: number;
} {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return {
    formattedMMSS: `${mm}:${ss}`,
    formattedKorean: `${minutes}분 ${ss}초`,
    remainingSeconds: totalSeconds,
  };
}

/**
 * 현재 시각(nowMs) 기준 세션 상태 판정
 * - 남은 시간 > 10분: active
 * - 0 < 남은 시간 <= 10분 (로그인 50분 경과 시점부터): warning (만료 안내 창 표시)
 * - 남은 시간 <= 0 (로그인 60분 경과 시점): expired (즉시 자동 로그아웃 대상)
 */
export function evaluateSessionStatus(
  record: unknown,
  expectedUid: string | null | undefined,
  nowMs: number = Date.now()
): SessionEvaluation {
  if (!expectedUid) {
    return {
      phase: "no_session",
      remainingMs: 0,
      remainingSeconds: 0,
      isWarningVisible: false,
      isExpired: false,
      formattedMMSS: "00:00",
      formattedKorean: "0분 00초",
    };
  }

  if (!validateSessionRecord(record, expectedUid, nowMs)) {
    return {
      phase: "invalid",
      remainingMs: 0,
      remainingSeconds: 0,
      isWarningVisible: false,
      isExpired: true,
      formattedMMSS: "00:00",
      formattedKorean: "0분 00초",
    };
  }

  const remainingMs = record.expiresAt - nowMs;
  if (remainingMs <= 0) {
    return {
      phase: "expired",
      remainingMs: 0,
      remainingSeconds: 0,
      isWarningVisible: false,
      isExpired: true,
      formattedMMSS: "00:00",
      formattedKorean: "0분 00초",
    };
  }

  const { formattedMMSS, formattedKorean, remainingSeconds } = formatRemainingTime(remainingMs);
  const isWarningVisible = remainingMs <= SESSION_WARNING_THRESHOLD_MS;

  return {
    phase: isWarningVisible ? "warning" : "active",
    remainingMs,
    remainingSeconds,
    isWarningVisible,
    isExpired: false,
    formattedMMSS,
    formattedKorean,
  };
}

/**
 * 페이지 로드·새로고침·브라우저 재열기 시점의 세션 복원/초기화 판정
 * - 기존에 같은 UID의 세션이 저장되어 있다면:
 *   1) 위변조되었거나 이미 만료 시각(expiresAt)이 지났다면 즉시 'expire' (자동 로그아웃)
 *   2) 아직 유효하다면 'keep' (기존 만료 시각 그대로 유지 — 새로고침해도 절대 리셋 안 됨)
 * - 저장된 세션이 없거나 다른 사용자의 세션이라면:
 *   새로운 60분 세션을 생성('create')
 */
export function restoreOrInitSessionOnAuth(
  uid: string,
  storedRecord: unknown,
  nowMs: number = Date.now()
): {
  action: "keep" | "create" | "expire";
  record: AuthSessionRecord | null;
} {
  if (!storedRecord || typeof storedRecord !== "object") {
    return {
      action: "create",
      record: createNewSession(uid, nowMs),
    };
  }

  const candidate = storedRecord as Partial<AuthSessionRecord>;
  // 다른 계정으로 로그인된 경우 새 세션 시작
  if (candidate.uid && candidate.uid !== uid) {
    return {
      action: "create",
      record: createNewSession(uid, nowMs),
    };
  }

  // 같은 계정의 세션이 있는데 무결성 검증에 실패(조작)한 경우 즉시 만료 처리
  if (!validateSessionRecord(storedRecord, uid, nowMs)) {
    return {
      action: "expire",
      record: null,
    };
  }

  // 이미 만료 시각이 지난 경우 (브라우저를 닫았다가 60분 뒤 다시 연 경우 등) 즉시 만료 처리
  if (nowMs >= storedRecord.expiresAt) {
    return {
      action: "expire",
      record: storedRecord,
    };
  }

  // 아직 유효한 세션이면 기존 만료 시각을 그대로 유지 (새로고침 시 초기화 금지)
  return {
    action: "keep",
    record: storedRecord,
  };
}

// ==========================================
// 브라우저 스토리지 및 다중 탭 동기화 헬퍼
// ==========================================

export function loadSessionFromStorage(): AuthSessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSessionRecord;
  } catch {
    return null;
  }
}

export function saveSessionToStorage(record: AuthSessionRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(record));
    window.localStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  } catch {
    // ignore storage quota errors
  }
  broadcastSessionMessage({ type: "SESSION_UPDATED", record });
}

export function clearSessionFromStorage(reason: "logout" | "expired" = "logout"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    if (reason === "expired") {
      window.localStorage.setItem(
        SESSION_EXPIRED_NOTICE_KEY,
        "로그인 유지 시간(60분)이 만료되어 자동 로그아웃되었습니다. 다시 로그인해 주세요."
      );
    } else {
      window.localStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
    }
  } catch {
    // ignore
  }
  broadcastSessionMessage({ type: "SESSION_CLEARED", reason });
}

export function consumeExpiredSessionNotice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const msg = window.localStorage.getItem(SESSION_EXPIRED_NOTICE_KEY);
    if (msg) {
      window.localStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
      return msg;
    }
    return null;
  } catch {
    return null;
  }
}

export function broadcastSessionMessage(msg: SessionSyncMessage): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
    channel.postMessage(msg);
    channel.close();
  } catch {
    // BroadcastChannel 미지원 환경은 storage 이벤트로 폴백
  }
}

/**
 * 여러 탭에서 동일한 로그인 상태 및 만료 시각을 동기화하기 위한 리스너 등록
 */
export function subscribeToMultiTabSessionSync(
  onUpdate: (record: AuthSessionRecord | null, reason?: "logout" | "expired") => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key !== SESSION_STORAGE_KEY) return;
    if (!e.newValue) {
      const hasExpiredNotice = Boolean(window.localStorage.getItem(SESSION_EXPIRED_NOTICE_KEY));
      onUpdate(null, hasExpiredNotice ? "expired" : "logout");
      return;
    }
    try {
      const parsed = JSON.parse(e.newValue) as AuthSessionRecord;
      onUpdate(parsed);
    } catch {
      onUpdate(null, "expired");
    }
  };

  window.addEventListener("storage", handleStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
      channel.onmessage = (event: MessageEvent<SessionSyncMessage>) => {
        const data = event.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "SESSION_UPDATED") {
          onUpdate(data.record);
        } else if (data.type === "SESSION_CLEARED") {
          onUpdate(null, data.reason);
        }
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener("storage", handleStorage);
    if (channel) {
      try {
        channel.close();
      } catch {
        // ignore
      }
    }
  };
}

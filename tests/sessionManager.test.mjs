import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SESSION_DURATION_MS,
  SESSION_WARNING_THRESHOLD_MS,
  SESSION_EXPIRY_WARNING_MESSAGE,
  createNewSession,
  extendSessionRecord,
  validateSessionRecord,
  evaluateSessionStatus,
  restoreOrInitSessionOnAuth,
  computeSessionIntegrityHash,
} from "../src/lib/sessionManager.ts";
import {
  resolveAccessGate,
  resolveRouteView,
  canAccessInternal,
  classifyRoute,
} from "../src/lib/accessGate.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const TEST_UID = "user-dongguk-2026";
const T0 = 1_762_600_000_000; // 기준 시각 (ms)
const ONE_MINUTE = 60 * 1000;

test("1. 로그인 성공 시점부터 정확히 60분 동안 유지되며, 60분이 지나면 즉시 만료(자동 로그아웃 대상)된다", () => {
  assert.equal(SESSION_DURATION_MS, 60 * 60 * 1000, "세션 유지 시간은 정확히 60분(3,600,000ms)이어야 함");

  const session = createNewSession(TEST_UID, T0);
  assert.equal(session.uid, TEST_UID);
  assert.equal(session.startedAt, T0);
  assert.equal(session.expiresAt, T0 + 60 * ONE_MINUTE);

  // 1) 로그인 직후 (0분 경과)
  const atStart = evaluateSessionStatus(session, TEST_UID, T0);
  assert.equal(atStart.phase, "active");
  assert.equal(atStart.isExpired, false);
  assert.equal(atStart.isWarningVisible, false);
  assert.equal(atStart.formattedMMSS, "60:00");

  // 2) 59분 59초 경과 (만료 1초 전)
  const at59m59s = evaluateSessionStatus(session, TEST_UID, T0 + 60 * ONE_MINUTE - 1000);
  assert.equal(at59m59s.isExpired, false);
  assert.equal(at59m59s.remainingSeconds, 1);

  // 3) 정확히 60분 경과 시점 -> 즉시 만료(expired)
  const at60m = evaluateSessionStatus(session, TEST_UID, T0 + 60 * ONE_MINUTE);
  assert.equal(at60m.phase, "expired");
  assert.equal(at60m.isExpired, true);
  assert.equal(at60m.remainingMs, 0);

  // 4) 60분 이후 (65분 경과) -> 만료 유지
  const at65m = evaluateSessionStatus(session, TEST_UID, T0 + 65 * ONE_MINUTE);
  assert.equal(at65m.phase, "expired");
  assert.equal(at65m.isExpired, true);
});

test("2. 로그인 후 50분이 지나면(만료 10분 전) 세션 만료 안내가 표시되고 필수 문구와 실시간 남은 시간을 제공한다", () => {
  assert.equal(SESSION_WARNING_THRESHOLD_MS, 10 * 60 * 1000, "만료 안내는 만료 10분 전(로그인 50분 후)이어야 함");
  assert.equal(
    SESSION_EXPIRY_WARNING_MESSAGE,
    "로그인 시간이 10분 후 만료됩니다. 계속 이용하려면 로그인 시간을 연장해 주세요."
  );

  const session = createNewSession(TEST_UID, T0);

  // 1) 49분 59초 경과 (남은 시간 10분 1초) -> 안내 창 미표시
  const before50m = evaluateSessionStatus(session, TEST_UID, T0 + 50 * ONE_MINUTE - 1000);
  assert.equal(before50m.phase, "active");
  assert.equal(before50m.isWarningVisible, false);

  // 2) 정확히 50분 경과 (남은 시간 10분 00초) -> 안내 창 표시 시작
  const at50m = evaluateSessionStatus(session, TEST_UID, T0 + 50 * ONE_MINUTE);
  assert.equal(at50m.phase, "warning");
  assert.equal(at50m.isWarningVisible, true);
  assert.equal(at50m.formattedMMSS, "10:00");
  assert.equal(at50m.formattedKorean, "10분 00초");

  // 3) 55분 30초 경과 (남은 시간 4분 30초) -> 실시간 남은 시간 반영 및 안내 창 유지
  const at55m30s = evaluateSessionStatus(session, TEST_UID, T0 + 55 * ONE_MINUTE + 30 * 1000);
  assert.equal(at55m30s.phase, "warning");
  assert.equal(at55m30s.isWarningVisible, true);
  assert.equal(at55m30s.formattedMMSS, "04:30");
  assert.equal(at55m30s.formattedKorean, "4분 30초");
});

test("3. '로그인 연장' 버튼을 누르면 클릭 시점부터 다시 60분이 적용되고 안내 창이 닫힌다", () => {
  const initialSession = createNewSession(TEST_UID, T0);

  // 로그인 후 53분 경과 시점 (남은 시간 7분, 만료 안내 창이 떠 있는 상태)
  const clickTime = T0 + 53 * ONE_MINUTE;
  const warningEval = evaluateSessionStatus(initialSession, TEST_UID, clickTime);
  assert.equal(warningEval.isWarningVisible, true);

  // 사용자가 명시적으로 '로그인 연장' 클릭
  const extendedSession = extendSessionRecord(initialSession, clickTime);
  assert.equal(extendedSession.startedAt, clickTime);
  assert.equal(extendedSession.expiresAt, clickTime + 60 * ONE_MINUTE, "클릭 시점부터 정확히 60분 후가 새 만료 시각이어야 함");
  assert.equal(extendedSession.extendedCount, 1);

  // 연장 직후 상태 평가 -> 안내 창 닫힘(isWarningVisible === false), 남은 시간 60:00
  const afterExtendEval = evaluateSessionStatus(extendedSession, TEST_UID, clickTime);
  assert.equal(afterExtendEval.phase, "active");
  assert.equal(afterExtendEval.isWarningVisible, false, "연장 성공 시 안내 창이 즉시 닫혀야 함");
  assert.equal(afterExtendEval.isExpired, false);
  assert.equal(afterExtendEval.formattedMMSS, "60:00");

  // 최초 로그인으로부터 60분(T0 + 60분)이 지나도 연장된 세션은 만료되지 않음 (남은 시간 53분)
  const atOriginalExpiry = evaluateSessionStatus(extendedSession, TEST_UID, T0 + 60 * ONE_MINUTE);
  assert.equal(atOriginalExpiry.isExpired, false);
  assert.equal(atOriginalExpiry.formattedMMSS, "53:00");

  // 연장 클릭 시점으로부터 정확히 60분 후(clickTime + 60분)에 만료됨
  const atExtendedExpiry = evaluateSessionStatus(extendedSession, TEST_UID, clickTime + 60 * ONE_MINUTE);
  assert.equal(atExtendedExpiry.isExpired, true);
});

test("4. 페이지 새로고침 및 화면 이동 후에도 기존 만료 시각이 초기화되지 않고 그대로 유지된다", () => {
  const initialSession = createNewSession(TEST_UID, T0);

  // 25분 경과 후 페이지 새로고침 발생 시뮬레이션
  const refreshTime = T0 + 25 * ONE_MINUTE;
  const restored = restoreOrInitSessionOnAuth(TEST_UID, initialSession, refreshTime);

  assert.equal(restored.action, "keep", "새로고침 시 기존 세션을 유지(keep)해야 함");
  assert.equal(restored.record?.startedAt, T0, "시작 시각이 초기화되면 안 됨");
  assert.equal(
    restored.record?.expiresAt,
    T0 + 60 * ONE_MINUTE,
    "새로고침해도 만료 시각이 늘어나거나 초기화되면 안 됨"
  );

  // 남은 시간은 정확히 35분이어야 함
  const statusAfterRefresh = evaluateSessionStatus(restored.record, TEST_UID, refreshTime);
  assert.equal(statusAfterRefresh.formattedMMSS, "35:00");
});

test("5. 브라우저를 종료했다 다시 열어도 기존 만료 시각이 적용되며, 이미 만료된 상태라면 즉시 로그아웃 처리된다", () => {
  const initialSession = createNewSession(TEST_UID, T0);

  // 케이스 A: 브라우저 종료 후 40분 만에 다시 열었을 때 -> 기존 만료 시각 유지 (남은 시간 20분)
  const reopenAt40m = T0 + 40 * ONE_MINUTE;
  const restoredActive = restoreOrInitSessionOnAuth(TEST_UID, initialSession, reopenAt40m);
  assert.equal(restoredActive.action, "keep");
  assert.equal(restoredActive.record?.expiresAt, initialSession.expiresAt);

  // 케이스 B: 브라우저 종료 후 70분 뒤(만료 이후) 다시 열었을 때 -> 즉시 'expire' 판정하여 자동 로그아웃
  const reopenAt70m = T0 + 70 * ONE_MINUTE;
  const restoredExpired = restoreOrInitSessionOnAuth(TEST_UID, initialSession, reopenAt70m);
  assert.equal(restoredExpired.action, "expire", "이미 만료된 상태로 브라우저를 다시 열면 즉시 expire 처리되어야 함");

  // 케이스 C: 로그아웃 후 다시 로그인하면 새로운 60분 시작
  const reloginTime = T0 + 80 * ONE_MINUTE;
  const afterRelogin = restoreOrInitSessionOnAuth(TEST_UID, null, reloginTime);
  assert.equal(afterRelogin.action, "create");
  assert.equal(afterRelogin.record?.startedAt, reloginTime);
  assert.equal(afterRelogin.record?.expiresAt, reloginTime + 60 * ONE_MINUTE);
});

test("6. 만료된 사용자는 모든 역할(관리자·교수·재학생·졸업생)에서 내부 페이지 및 관리자 페이지에 접근할 수 없다", () => {
  const roles = ["student", "alumni", "professor", "admin"];
  const internalRoutes = ["/", "/notices", "/chat", "/rooms", "/alumni", "/graduation", "/admin"];

  for (const role of roles) {
    const gateState = resolveAccessGate({
      authResolved: true,
      firebaseUser: { uid: TEST_UID },
      profileStatus: "loaded",
      profile: { approvalStatus: "approved", role },
      sessionExpired: true, // 60분 세션 만료됨
    });

    assert.equal(gateState, "signed_out", `${role} 역할도 세션 만료 시 즉시 signed_out 상태여야 함`);
    assert.equal(canAccessInternal(gateState), false, `${role} 역할도 만료 시 내부 접근이 차단되어야 함`);

    for (const route of internalRoutes) {
      const view = resolveRouteView(gateState, classifyRoute(route), role === "admin");
      assert.equal(view, "redirect_auth", `만료된 ${role} 사용자가 ${route} 접근 시 로그인 화면으로 이동해야 함`);
    }
  }
});

test("7. 클라이언트에 저장된 만료 시각(localStorage)을 사용자가 임의 조작하면 위변조로 감지하여 즉시 차단한다", () => {
  const validSession = createNewSession(TEST_UID, T0);
  assert.equal(validateSessionRecord(validSession, TEST_UID, T0 + 5 * ONE_MINUTE), true);

  // 공격 시나리오 1: DevTools에서 expiresAt만 10시간 뒤로 수정한 경우 (무결성 해시 불일치 & 최대 60분 초과)
  const tamperedExpires = {
    ...validSession,
    expiresAt: T0 + 600 * ONE_MINUTE,
  };
  assert.equal(validateSessionRecord(tamperedExpires, TEST_UID, T0 + 5 * ONE_MINUTE), false);
  const evalTampered1 = evaluateSessionStatus(tamperedExpires, TEST_UID, T0 + 5 * ONE_MINUTE);
  assert.equal(evalTampered1.phase, "invalid");
  assert.equal(evalTampered1.isExpired, true, "위변조된 세션은 즉시 만료(로그아웃)로 판정되어야 함");

  // 공격 시나리오 2: expiresAt을 10시간으로 늘리고 해시까지 재계산해 넣은 경우 -> 60분 초과 가드에 의해 차단
  const fakeLongEnd = T0 + 600 * ONE_MINUTE;
  const forgedHashSession = {
    ...validSession,
    expiresAt: fakeLongEnd,
    integrityHash: computeSessionIntegrityHash(TEST_UID, T0, fakeLongEnd, 0),
  };
  assert.equal(
    validateSessionRecord(forgedHashSession, TEST_UID, T0 + 5 * ONE_MINUTE),
    false,
    "해시를 재계산하더라도 60분을 초과하는 만료 시각은 원천 차단되어야 함"
  );

  // 공격 시나리오 3: 다른 사용자의 UID 세션 레코드를 복사해 넣은 경우
  assert.equal(validateSessionRecord(validSession, "other-user-uid", T0 + 5 * ONE_MINUTE), false);
});

test("8. 마우스 이동·화면 이동·채팅 활동에 의한 자동 연장이 없으며, 다중 탭 동기화 및 Firestore 규칙이 올바르게 구현되어 있다", () => {
  const appContextCode = fs.readFileSync(
    path.join(rootDir, "src/context/AppContext.tsx"),
    "utf8"
  );
  const appShellCode = fs.readFileSync(
    path.join(rootDir, "src/components/layout/AppShell.tsx"),
    "utf8"
  );
  const rulesCode = fs.readFileSync(
    path.join(rootDir, "firestore.rules"),
    "utf8"
  );

  // 1) 마우스/키보드 이벤트로 세션을 자동 연장하는 코드가 없음을 검증
  assert.equal(appContextCode.includes('addEventListener("mousemove"'), false);
  assert.equal(appContextCode.includes('addEventListener("keydown"'), false);

  // 2) 다중 탭 동기화(subscribeToMultiTabSessionSync) 연동 확인
  assert.ok(appContextCode.includes("subscribeToMultiTabSessionSync"));

  // 3) 만료 안내 창 UI에 필수 버튼('로그인 연장', '로그아웃') 및 안내 문구가 포함되어 있는지 검증
  assert.ok(appShellCode.includes("SESSION_EXPIRY_WARNING_MESSAGE"));
  assert.ok(appShellCode.includes("<span>로그인 연장</span>"));
  assert.ok(appShellCode.includes("<span>로그아웃</span>"));

  // 4) Firestore 보안 규칙에서 서버 시각(request.time) 기반 60분(3,600,000ms) 검증 함수가 포함되어 있는지 확인
  assert.ok(rulesCode.includes("function isSessionValid(userData)"));
  assert.ok(rulesCode.includes("request.time.toMillis() <= userData.sessionStartedAt.toMillis() + 3600000"));
  assert.ok(rulesCode.includes("function isValidSessionRefresh(incomingData)"));
});

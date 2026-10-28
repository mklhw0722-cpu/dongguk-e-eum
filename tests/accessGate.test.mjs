// 동국e음 접근 제어 테스트 (node --test)
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolveAccessGate,
  resolveRouteView,
  canAccessInternal,
  canAccessAdmin,
  classifyRoute,
} from "../src/lib/accessGate.ts";

const USER = { uid: "u1" };
const ROUTES_INTERNAL = ["/", "/chat", "/notices", "/alumni", "/rooms", "/graduation"];

const gate = (over = {}) =>
  resolveAccessGate({
    authResolved: true,
    firebaseUser: null,
    profileStatus: "idle",
    profile: null,
    ...over,
  });

const view = (state, path, profile = null) =>
  resolveRouteView(state, classifyRoute(path), canAccessAdmin(state, profile));

test("1. 비로그인 사용자가 사이트에 접속하면 로그인 화면이 표시된다", () => {
  const s = gate();
  assert.equal(s, "signed_out");
  assert.equal(view(s, "/auth"), "show_auth_page");
  assert.equal(view(s, "/dongguk-e-eum/auth/"), "show_auth_page");
  assert.equal(view(s, "/"), "redirect_auth");
});

test("2. 비로그인 사용자에게 승인 대기 화면이 나타나지 않는다 (승인 상태보다 로그인 여부를 먼저 확인)", () => {
  // 이전 사용자의 pending 프로필이 남아 있어도 로그인 사용자가 없으면 signed_out
  const s = gate({ profileStatus: "loaded", profile: { approvalStatus: "pending" } });
  assert.equal(s, "signed_out");
  for (const p of [...ROUTES_INTERNAL, "/auth", "/admin"]) {
    assert.notEqual(view(s, p), "gate", p);
  }
});

test("3. 회원가입 직후 pending 사용자는 승인 대기 화면으로 이동한다", () => {
  // 가입 직후: 로그인됨 → 문서 생성 대기(loading) → 문서 생성(pending)
  assert.equal(gate({ firebaseUser: USER, profileStatus: "loading" }), "profile_loading");
  const s = gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "pending" } });
  assert.equal(s, "pending");
  assert.equal(view(s, "/auth"), "gate", "로그인·회원가입 화면으로 잘못 가지 않음");
});

test("4. pending 사용자가 내부 페이지 URL로 직접 접근하면 차단된다", () => {
  const s = gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "pending" } });
  for (const p of [...ROUTES_INTERNAL, "/admin", "/dongguk-e-eum/chat/"]) {
    assert.equal(view(s, p), "gate", p);
  }
  assert.equal(canAccessInternal(s), false);
});

test("5. 관리자가 승인하면 approved 사용자가 홈 화면에 접근할 수 있다 (실시간 반영)", () => {
  const before = gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "pending" } });
  const after = gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "approved", role: "student" } });
  assert.equal(before, "pending");
  assert.equal(after, "approved");
  for (const p of ROUTES_INTERNAL) assert.equal(view(after, p), "content", p);
  assert.equal(view(after, "/auth"), "redirect_home");
});

test("5-1. 승인이 취소되면 내부 서비스 접근이 즉시 제한된다", () => {
  for (const st of ["pending", "rejected", "suspended", "supplement_requested"]) {
    const s = gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: st } });
    assert.equal(s, st);
    assert.equal(view(s, "/chat"), "gate");
  }
});

test("6. approved 사용자는 새로고침·재로그인 후에도 정상 이용할 수 있다", () => {
  // 새로고침 직후: Auth 복원 전 → 로딩, 복원 후 문서 조회 중 → 로딩, 조회 완료 → approved
  const steps = [
    gate({ authResolved: false }),
    gate({ firebaseUser: USER, profileStatus: "loading" }),
    gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "approved" } }),
  ];
  assert.deepEqual(steps, ["auth_loading", "profile_loading", "approved"]);
  assert.equal(view(steps[2], "/"), "content");
});

test("7. 회원 문서가 없거나 조회 오류가 나면 내부 접근이 차단된다 (자동 승인 안 함)", () => {
  const missing = gate({ firebaseUser: USER, profileStatus: "missing" });
  const error = gate({ firebaseUser: USER, profileStatus: "error" });
  const noStatus = gate({ firebaseUser: USER, profileStatus: "loaded", profile: {} });
  const weird = gate({ firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "APPROVED" } });
  assert.equal(missing, "profile_missing");
  assert.equal(error, "profile_error");
  assert.equal(noStatus, "unknown_status");
  assert.equal(weird, "unknown_status");
  for (const s of [missing, error, noStatus, weird]) {
    assert.equal(canAccessInternal(s), false);
    assert.equal(view(s, "/"), "gate");
  }
});

test("8. 로그인·Firestore 조회 중에는 내부 화면이 노출되지 않는다", () => {
  const loadingStates = [
    gate({ authResolved: false }),
    gate({ authResolved: false, firebaseUser: USER, profileStatus: "loaded", profile: { approvalStatus: "approved" } }),
    gate({ firebaseUser: USER, profileStatus: "idle" }),
    gate({ firebaseUser: USER, profileStatus: "loading" }),
  ];
  for (const s of loadingStates) {
    for (const p of [...ROUTES_INTERNAL, "/auth", "/admin"]) {
      assert.equal(view(s, p), "loading", `${s} ${p}`);
    }
  }
});

test("9. 미승인 사용자의 Firestore 내부 데이터 읽기가 차단되고 자가 승인이 금지된다", () => {
  const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  // isApprovedUser 정의가 users/{uid}.approvalStatus == 'approved' 를 검사하는지 확인
  assert.match(rules, /function isApprovedUser\(\)[\s\S]*?\.data\.approvalStatus == 'approved'/);
  // 내부 컬렉션(communityPosts, publicProfiles, chats, graduationRecords)이 모두 isApprovedUser()를 요구하는지 확인
  assert.match(rules, /match \/communityPosts\/\{postId\}[\s\S]*?allow read:\s*if isApprovedUser\(\)/);
  assert.match(rules, /match \/publicProfiles\/\{userId\}[\s\S]*?allow read:\s*if isApprovedUser\(\) \|\| isApprovedAdmin\(\)/);
  assert.match(rules, /match \/chats\/\{chatId\}[\s\S]*?allow read:\s*if isApprovedUser\(\)/);
  assert.match(rules, /match \/graduationRecords\/\{userId\}[\s\S]*?allow read, write:\s*if isApprovedUser\(\)/);
  // 일반 가입은 pending 만 허용하고, 본인 수정 시 approvalStatus 와 role 변경이 차단되는지 확인
  assert.match(rules, /request\.resource\.data\.approvalStatus == 'pending'/);
  assert.match(rules, /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)[\s\S]*?\.hasAny\(\['approvalStatus', 'role'/);
});

test("10. 관리자 및 일반 사용자 권한이 유지된다", () => {
  const studentProfile = { approvalStatus: "approved", role: "student" };
  const adminProfile = { approvalStatus: "approved", role: "admin" };
  const pendingAdmin = { approvalStatus: "pending", role: "admin" };
  const sStudent = gate({ firebaseUser: USER, profileStatus: "loaded", profile: studentProfile });
  const sAdmin = gate({ firebaseUser: USER, profileStatus: "loaded", profile: adminProfile });
  const sPendingAdmin = gate({ firebaseUser: USER, profileStatus: "loaded", profile: pendingAdmin });
  assert.equal(view(sStudent, "/admin", studentProfile), "forbidden");
  assert.equal(view(sAdmin, "/admin", adminProfile), "content");
  assert.equal(view(sPendingAdmin, "/admin", pendingAdmin), "gate", "승인 안 된 admin 역할은 관리자 아님");
  assert.equal(canAccessAdmin(sPendingAdmin, pendingAdmin), false);
});

test("경로 판정: GitHub Pages basePath 와 끝 슬래시를 정확히 처리한다", () => {
  assert.equal(classifyRoute("/dongguk-e-eum/auth/"), "auth");
  assert.equal(classifyRoute("/dongguk-e-eum/admin"), "admin");
  assert.equal(classifyRoute("/dongguk-e-eum"), "internal");
  assert.equal(classifyRoute("/authors"), "internal", "/auth 로 시작하는 다른 주소는 로그인 화면이 아님");
  assert.equal(classifyRoute("/chat/admin-notes"), "internal");
});

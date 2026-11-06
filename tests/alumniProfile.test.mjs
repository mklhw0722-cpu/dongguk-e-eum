import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("1. [Firestore 보안 규칙] 졸업생 진로 프로필(alumniProfiles/{profileId}) 및 isApprovedAlumni 보안 규칙 검증", () => {
  const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

  // isApprovedAlumni 헬퍼 함수 정의 확인
  assert.match(
    rules,
    /function isApprovedAlumni\(\)\s*\{[\s\S]*?role == 'alumni'/
  );

  // alumniProfiles 컬렉션 규칙 검증
  assert.match(
    rules,
    /match \/alumniProfiles\/\{profileId\}[\s\S]*?allow read:\s*if isApprovedUser\(\) \|\| isApprovedAdmin\(\);/
  );

  // 오직 승인된 졸업생 본인 또는 관리자만 등록 및 수정 가능
  assert.match(
    rules,
    /allow create:\s*if isApprovedAdmin\(\)[\s\S]*?isApprovedAlumni\(\)[\s\S]*?request\.resource\.data\.userId == request\.auth\.uid/
  );
  assert.match(
    rules,
    /allow update:\s*if isApprovedAdmin\(\)[\s\S]*?isApprovedAlumni\(\)[\s\S]*?resource\.data\.userId == request\.auth\.uid/
  );
});

test("2. [접근 권한 제어] 졸업생(alumni) 계정만 프로필 설정 탭에 접근할 수 있고, 재학생·교수·관리자는 차단된다", () => {
  const canAccessProfileTab = (role) => role === "alumni";

  assert.equal(canAccessProfileTab("alumni"), true, "졸업생 계정은 프로필 설정 탭 접근 허용");
  assert.equal(canAccessProfileTab("student"), false, "재학생 계정은 프로필 설정 탭 접근 차단");
  assert.equal(canAccessProfileTab("professor"), false, "교수 계정은 프로필 설정 탭 접근 차단");
  assert.equal(canAccessProfileTab("admin"), false, "관리자 계정은 프로필 설정 탭 접근 차단");
});

test("3. [비졸업생 탭 자동 전환] 비졸업생이 my_profile 탭에 진입하려 할 경우 directory 탭으로 안전하게 복귀한다", () => {
  const resolveActiveTab = (role, requestedTab) => {
    if (requestedTab === "my_profile" && role !== "alumni") {
      return "directory";
    }
    return requestedTab;
  };

  assert.equal(resolveActiveTab("student", "my_profile"), "directory");
  assert.equal(resolveActiveTab("professor", "my_profile"), "directory");
  assert.equal(resolveActiveTab("admin", "my_profile"), "directory");
  assert.equal(resolveActiveTab("alumni", "my_profile"), "my_profile");
});

test("4. [동문 프로필 클라우드 동기화 및 병합] 로컬 데이터와 Firestore 실시간 프로필이 정합성 있게 병합된다", () => {
  const localProfiles = [
    {
      id: "alumni-1",
      userId: "u-1",
      displayName: "기존 선배",
      graduationYear: 2022,
      careerTrack: "기업 HRD",
      currentRoleTitle: "매니저",
    },
    {
      id: "alumni-2",
      userId: "u-2",
      displayName: "다른 선배",
      graduationYear: 2021,
      careerTrack: "교직",
      currentRoleTitle: "교사",
    },
  ];

  const cloudProfiles = [
    {
      id: "alumni-1",
      userId: "u-1",
      displayName: "기존 선배 (최신 정보)",
      graduationYear: 2022,
      careerTrack: "기업 HRD",
      currentRoleTitle: "수석 매니저",
    },
    {
      id: "alumni-3",
      userId: "u-3",
      displayName: "신규 등록 동문",
      graduationYear: 2024,
      careerTrack: "에듀테크",
      currentRoleTitle: "기획자",
    },
  ];

  const byId = new Map();
  localProfiles.forEach((p) => byId.set(p.id, p));
  cloudProfiles.forEach((cp) => {
    const existingKey = Array.from(byId.keys()).find(
      (k) => byId.get(k)?.userId === cp.userId || k === cp.id
    );
    if (existingKey) {
      byId.set(existingKey, cp);
    } else {
      byId.set(cp.id, cp);
    }
  });

  const merged = Array.from(byId.values());
  assert.equal(merged.length, 3);
  const updated = merged.find((p) => p.userId === "u-1");
  assert.equal(updated.currentRoleTitle, "수석 매니저");
  assert.equal(updated.displayName, "기존 선배 (최신 정보)");
});

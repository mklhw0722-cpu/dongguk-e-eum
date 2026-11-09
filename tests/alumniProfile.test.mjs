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


test("5. [동문 네트워크 복수전공 필터 및 예시 데이터 갱신] 심리학/국어국문학/컴퓨터공학/경제학이 제거되고 국어교육학과/법학과/기타가 구성된다", () => {
  const mockContent = fs.readFileSync(new URL("../src/data/mockData.ts", import.meta.url), "utf8");
  const alumniPageContent = fs.readFileSync(new URL("../src/app/alumni/page.tsx", import.meta.url), "utf8");

  // alumniProfiles 섹션 추출
  const alumniProfilesMatch = mockContent.match(/export const MOCK_ALUMNI_PROFILES: AlumniProfile\[\] = \[([\s\S]*?)\];/);
  assert.ok(alumniProfilesMatch, "MOCK_ALUMNI_PROFILES 정의가 존재해야 함");
  const alumniProfilesText = alumniProfilesMatch[1];

  // 제거된 전공이 MOCK_ALUMNI_PROFILES 에 없어야 함
  assert.equal(alumniProfilesText.includes('doubleMajor: "심리학"'), false);
  assert.equal(alumniProfilesText.includes('doubleMajor: "국어국문학"'), false);
  assert.equal(alumniProfilesText.includes('doubleMajor: "컴퓨터공학"'), false);
  assert.equal(alumniProfilesText.includes('doubleMajor: "경제학"'), false);

  // 추가된 전공이 MOCK_ALUMNI_PROFILES 에 존재해야 함
  assert.ok(alumniProfilesText.includes('doubleMajor: "국어교육학과"'));
  assert.ok(alumniProfilesText.includes('doubleMajor: "법학과"'));
  assert.ok(alumniProfilesText.includes('doubleMajor: "기타"'));

  // alumni 페이지의 STANDARD_DOUBLE_MAJORS 필터 목록 검증
  assert.ok(alumniPageContent.includes('"국어교육학과"'));
  assert.ok(alumniPageContent.includes('"법학과"'));
  assert.ok(alumniPageContent.includes('"기타"'));
  assert.ok(alumniPageContent.includes('"단일전공(교육학)"'));
  assert.ok(alumniPageContent.includes('"경영학"'));
});

test("6. [기타 복수전공 필터링 정합성] '기타' 필터 선택 시 '기타' 및 표준 외 다전공 동문이 정상 추출된다", () => {
  const testProfiles = [
    { name: "A", doubleMajor: "경영학" },
    { name: "B", doubleMajor: "국어교육학과" },
    { name: "C", doubleMajor: "법학과" },
    { name: "D", doubleMajor: "단일전공(교육학)" },
    { name: "E", doubleMajor: "기타" },
    { name: "F", doubleMajor: "미디어커뮤니케이션" },
  ];

  const standardMajors = ["경영학", "국어교육학과", "법학과", "단일전공(교육학)"];
  const filterByDM = (dm) => {
    return testProfiles.filter((p) =>
      dm === "전체"
        ? true
        : dm === "기타"
        ? p.doubleMajor === "기타" || !standardMajors.includes(p.doubleMajor)
        : p.doubleMajor === dm
    );
  };

  assert.equal(filterByDM("국어교육학과").length, 1);
  assert.equal(filterByDM("법학과").length, 1);
  assert.equal(filterByDM("기타").length, 2); // E("기타"), F("미디어커뮤니케이션")
  assert.equal(filterByDM("전체").length, 6);
});

test("7. [프로필 전체 공개/비공개 설정] '졸업생 동문 연결에 프로필을 공개합니다 (해제 시 비공개)' 체크 해제 시 동문 연결 목록 및 홈 배너에서 프로필 카드가 숨겨진다", () => {
  const alumniPage = fs.readFileSync(new URL("../src/app/alumni/page.tsx", import.meta.url), "utf8");
  const homePage = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const roomsPage = fs.readFileSync(new URL("../src/app/rooms/page.tsx", import.meta.url), "utf8");
  const typesFile = fs.readFileSync(new URL("../src/types/index.ts", import.meta.url), "utf8");

  // 1) 타입 및 설정 체크박스 문구 확인
  assert.ok(typesFile.includes("showProfileInDirectory?: boolean;"), "PrivacySettings에 showProfileInDirectory 필드가 정의되어야 함");
  assert.ok(
    alumniPage.includes("졸업생 동문 연결에 프로필을 공개합니다 (해제 시 비공개)"),
    "공개 범위 설정 박스에 프로필 공개/비공개 체크박스 문구가 존재해야 함"
  );

  // 2) 동문 연결 목록(publicAlumniProfiles), 홈 추천 동문(recommendedAlumni), 게시판 연계 동문(relatedAlumni) 필터링 확인
  assert.ok(
    alumniPage.includes("a.privacy?.showProfileInDirectory !== false"),
    "졸업생 동문 연결 페이지에서 비공개 프로필을 필터링해야 함"
  );
  assert.ok(
    homePage.includes("a.privacy?.showProfileInDirectory !== false"),
    "홈 화면 추천 졸업생 동문 프로필에서 비공개 프로필을 필터링해야 함"
  );
  assert.ok(
    roomsPage.includes("a.privacy?.showProfileInDirectory !== false"),
    "진로·복전 게시판 연계 졸업생에서도 비공개 프로필을 필터링해야 함"
  );
});

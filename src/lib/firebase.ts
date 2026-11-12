import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  deleteField,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import {
  compareBySeq,
  compareChatRoomsByLatestMessage,
  sortConversationsByLatestMessage,
} from "@/lib/chatReadReceipts";
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  User as FirebaseUser,
} from "firebase/auth";
import {
  RegistrationRevisionInput,
  UserDeletionReport,
  UserDeletionStepResult,
  buildUserDeletionReport,
  canEditAndResubmitRegistration,
  validateAndBuildRegistrationUpdate,
} from "@/lib/memberLifecycle";
import {
  User as PlatformUser,
  UserRole,
  ApprovalStatus,
  CommunityPost,
  CommunityComment,
  Notice,
  NoticeSyncMetadata,
  AlumniProfile,
  OfficialGraduationCatalog,
  StudentAcademicProfile,
  StudentProgress,
  ConsultationRequest,
  ConsultationType,
  ConsultationStatus,
  RescheduleHistoryItem,
  CalendarEvent,
  EventCategory,
} from "@/types";
import { MOCK_COMMUNITY_POSTS } from "@/data/mockData";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/**
 * 프로필 사진용 이니셜/텍스트 생성 규칙
 * 1. 관리자(admin) 계정은 프로필 사진에서 텍스트를 제거합니다 (빈 문자열 "").
 * 2. 일반 계정(재학생, 졸업생, 교수진 등)은 성(Surname)을 제외한 이름(Given Name)을 표시합니다.
 *    예: '이혜원' -> '혜원', '김학생' -> '학생', '신나민' -> '나민'
 * 3. 2글자 복성(남궁, 황보, 제갈, 선우 등)은 2글자 성을 제외한 이름을 표시합니다.
 *    예: '남궁혜원' -> '혜원'
 */
export function getAvatarInitials(name?: string, role?: string): string {
  if (role === "admin" || (name && (name.includes("관리자") || name.toLowerCase() === "admin"))) {
    return "";
  }
  if (!name) return "";

  // 직함/수식어 및 괄호 제거 (예: '신나민 교수' -> '신나민', '이혜원(재학생)' -> '이혜원')
  let cleaned = name.replace(/\s*(교수|선생님|멘토|학우|님).*$/, "").trim();
  cleaned = cleaned.replace(/\(.*?\)/g, "").trim();
  if (!cleaned) return "";

  const compoundSurnames = ["남궁", "황보", "제갈", "선우", "독고", "사공", "서문", "동방"];
  for (const compound of compoundSurnames) {
    if (cleaned.startsWith(compound) && cleaned.length > 2) {
      return cleaned.slice(2, 4);
    }
  }

  if (cleaned.length >= 3) {
    return cleaned.slice(1, 3);
  }

  if (cleaned.length === 2) {
    return cleaned.slice(1);
  }

  return cleaned;
}

const CONFIG_STORAGE_KEY = "dongguk_e_eum_firebase_config_v1";
const POSTS_COLLECTION = "communityPosts";
const USERS_COLLECTION = "users";
const SYSTEM_COLLECTION = "system";
const CHATS_COLLECTION = "chats";
const NOTICES_COLLECTION = "notices";
const GRADUATION_CATALOG_COLLECTION = "graduationRulesCatalog";
const GRADUATION_RECORDS_COLLECTION = "graduationRecords";
const CONSULTATIONS_COLLECTION = "consultations";

/**
 * 환경변수 또는 브라우저에 저장된 Firebase 설정을 반환합니다.
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: "AIzaSyBxWc_DQky50aTRIq-ioqxv8CXxMAvxRQU",
  authDomain: "dongguk-e-eum.firebaseapp.com",
  projectId: "dongguk-e-eum",
  storageBucket: "dongguk-e-eum.firebasestorage.app",
  messagingSenderId: "1010816939334",
  appId: "1:1010816939334:web:7f3158b47d6980c7ae6147",
};

export function getActiveFirebaseConfig(): FirebaseWebConfig {
  const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${envProjectId}.firebasestorage.app`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    };
  }

  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FirebaseWebConfig;
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch {
      return DEFAULT_FIREBASE_CONFIG;
    }
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export function parseFirebaseConfigText(rawText: string): FirebaseWebConfig | null {
  const extractField = (key: string): string => {
    const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`);
    const match = rawText.match(regex);
    return match ? match[1].trim() : "";
  };

  const apiKey = extractField("apiKey");
  const projectId = extractField("projectId");

  if (!apiKey || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain: extractField("authDomain") || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: extractField("storageBucket") || `${projectId}.firebasestorage.app`,
    messagingSenderId: extractField("messagingSenderId"),
    appId: extractField("appId"),
  };
}

export function saveFirebaseConfigToLocal(config: FirebaseWebConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseConfigFromLocal(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
}

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedProjectId: string | null = null;

export function getFirebaseInstances(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  config: FirebaseWebConfig | null;
} {
  const config = getActiveFirebaseConfig();
  if (!config) {
    return { app: null, db: null, auth: null, config: null };
  }

  try {
    if (cachedDb && cachedAuth && cachedProjectId === config.projectId) {
      return { app: cachedApp, db: cachedDb, auth: cachedAuth, config };
    }

    const appName = `dongguk-e-eum-${config.projectId}`;
    const existingApp = getApps().find((a) => a.name === appName);
    cachedApp = existingApp ? getApp(appName) : initializeApp(config, appName);
    cachedDb = getFirestore(cachedApp);
    cachedAuth = getAuth(cachedApp);
    cachedProjectId = config.projectId;
    return { app: cachedApp, db: cachedDb, auth: cachedAuth, config };
  } catch {
    return { app: null, db: null, auth: null, config: null };
  }
}

export function getFirestoreInstance(): {
  db: Firestore | null;
  config: FirebaseWebConfig | null;
} {
  const { db, config } = getFirebaseInstances();
  return { db, config };
}

// ==========================================
// 1. Firebase Authentication & 프로필 관리 로직
// ==========================================

export interface UserProfileDoc extends PlatformUser {
  uid?: string;
  verificationNote?: string;
  adminComment?: string;
  revisionFields?: string[];
  resubmittedAt?: string;
  revisionCount?: number;
  lastModifiedAt?: string;
  updatedAt?: string;
  sessionStartedAt?: unknown;
  sessionExpiresAtMs?: number;
}

function buildInitialUserProfileDoc(
  uid: string,
  params: {
    email: string;
    name: string;
    studentIdOrYear: string;
    role: UserRole;
    verificationNote?: string;
    academicProfile?: StudentAcademicProfile;
    doubleMajor?: string;
  }
): UserProfileDoc {
  const safeRole: UserRole = params.role === "admin" ? "student" : params.role;
  const nowIso = new Date().toISOString();
  return {
    id: uid,
    uid,
    name: params.name.trim(),
    email: params.email.trim(),
    role: safeRole,
    studentIdOrYear: params.studentIdOrYear.trim(),
    ...(params.doubleMajor ? { doubleMajor: params.doubleMajor.trim() } : {}),
    ...(params.academicProfile
      ? {
          academicProfile: {
            ...params.academicProfile,
            adminVerifiedSpecialCondition: false,
          },
        }
      : {}),
    bio: (() => {
      const hakbunMatch = (params.studentIdOrYear || "").match(/(\d{2})\s*학번/);
      const cleanHakbun = hakbunMatch ? `${hakbunMatch[1]}학번` : params.studentIdOrYear.trim();
      return safeRole === "professor"
        ? `교육학과 전임교원 ${params.name.trim()}님의 프로필입니다.`
        : `${cleanHakbun} ${params.name.trim()}님의 프로필입니다.`;
    })(),
    avatarInitials: getAvatarInitials(params.name, safeRole),
    approvalStatus: "pending",
    joinedAt: nowIso.slice(0, 10),
    verificationNote: params.verificationNote || "소속 확인 신청",
    revisionCount: 0,
    lastModifiedAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * 이메일·비밀번호 기반 회원가입
 * - Firebase Auth 계정 생성 및 Firestore users/{uid} 문서(pending) 생성
 * - 만약 Auth 계정은 남아있으나 관리자에 의해 Firestore 회원 문서가 삭제된 경우(auth/email-already-in-use),
 *   기존 비밀번호로 본인 확인이 되면 즉시 새 가입 신청서를 users/{uid}에 복구 생성하여 재가입 오류를 해결합니다.
 * - 보완 요청(needs_revision) 또는 반려(rejected) 상태인 회원이 재가입을 시도하면, 중복 계정을 만들지 않고
 *   기존 계정으로 로그인하여 수정·재신청 화면으로 안내합니다.
 */
export async function registerWithEmailAndPassword(params: {
  email: string;
  password: string;
  name: string;
  studentIdOrYear: string;
  role: UserRole;
  verificationNote?: string;
  academicProfile?: StudentAcademicProfile;
  doubleMajor?: string;
}): Promise<PlatformUser> {
  const { auth, db } = getFirebaseInstances();
  if (!auth || !db) {
    throw new Error("Firebase가 초기화되지 않았습니다. 상단에서 설정을 확인해 주세요.");
  }

  try {
    // 1. Firebase Auth 신규 유저 생성 시도
    const credential = await createUserWithEmailAndPassword(
      auth,
      params.email.trim(),
      params.password
    );
    const uid = credential.user.uid;
    const initialProfile = buildInitialUserProfileDoc(uid, params);

    // 2. Firestore users/{uid} 문서 기록
    await setDoc(doc(db, USERS_COLLECTION, uid), initialProfile);
    return initialProfile;
  } catch (err: any) {
    if (err?.code !== "auth/email-already-in-use") {
      throw err;
    }

    // 이메일 중복 발생 시: 입력한 비밀번호로 기존 Auth 계정 본인 확인 시도
    try {
      const existingCred = await signInWithEmailAndPassword(
        auth,
        params.email.trim(),
        params.password
      );
      const existingUid = existingCred.user.uid;
      const existingDocRef = doc(db, USERS_COLLECTION, existingUid);
      const existingSnap = await getDoc(existingDocRef);

      if (!existingSnap.exists()) {
        // 케이스 2: Auth 계정은 존재하지만 Firestore 회원 문서가 없는 경우 (관리자 삭제 후 재가입 또는 가입 중단)
        // -> 새 가입 신청 정보를 기존 UID 문서에 즉시 생성하여 정상 재가입 완료 처리!
        const restoredProfile = buildInitialUserProfileDoc(existingUid, params);
        await setDoc(existingDocRef, restoredProfile);
        return restoredProfile;
      }

      const existingData = existingSnap.data() as UserProfileDoc;
      if (canEditAndResubmitRegistration(existingData.approvalStatus)) {
        // 케이스 4: 가입 보완 요청 또는 반려 상태인 경우 -> 로그인 유지 후 수정 화면으로 즉시 이동
        const redirectErr: any = new Error(
          existingData.approvalStatus === "rejected"
            ? "이전에 제출한 가입 신청이 반려된 상태입니다. 새로 가입할 필요 없이 로그인되었으며, 화면에서 정보를 수정해 다시 승인 요청할 수 있습니다."
            : "가입 정보 보완 요청이 있는 계정입니다. 새로 가입할 필요 없이 로그인되었으며, 화면에서 정보를 수정해 다시 승인 요청할 수 있습니다."
        );
        redirectErr.code = "auth/revision-or-rejected-redirect";
        throw redirectErr;
      }

      // 케이스 1: 이미 승인 대기(pending), 승인 완료(approved), 이용 정지(suspended) 상태인 회원
      await signOut(auth);
      const activeErr: any = new Error(
        "이미 가입 신청이 접수되었거나 활동 중인 회원 계정입니다. 중복 가입 대신 [로그인] 탭에서 기존 계정으로 로그인해 주세요."
      );
      activeErr.code = "auth/active-member-exists";
      throw activeErr;
    } catch (innerErr: any) {
      if (
        innerErr?.code === "auth/revision-or-rejected-redirect" ||
        innerErr?.code === "auth/active-member-exists"
      ) {
        throw innerErr;
      }

      // 비밀번호가 다르거나 본인 확인이 되지 않은 경우 (타인의 계정 상태 노출 방지)
      const dupErr: any = new Error(
        "이미 등록된 이메일 주소입니다. ① 보완 요청·반려 대상이거나 기존 회원이라면 [로그인] 탭에서 로그인하여 정보를 확인·수정해 주세요. ② 과거에 삭제된 계정으로 재가입하려는 경우 이전 비밀번호를 입력하거나 [비밀번호 재설정] 후 로그인하여 재신청할 수 있습니다."
      );
      dupErr.code = "auth/email-already-in-use";
      throw dupErr;
    }
  }
}

/**
 * 보완 요청(needs_revision / supplement_requested) 또는 반려(rejected) 상태인 회원이
 * 본인의 가입 정보를 수정 저장(draft)하거나 다시 승인 요청(resubmit -> pending)합니다.
 */
export async function updateRegistrationByApplicantInFirestore(
  uid: string,
  input: RegistrationRevisionInput,
  mode: "draft" | "resubmit"
): Promise<UserProfileDoc> {
  const { auth, db } = getFirebaseInstances();
  if (!db) throw new Error("Firestore가 연결되어 있지 않습니다.");
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("본인 계정으로 로그인한 상태에서만 가입 정보를 수정할 수 있습니다.");
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error("회원 가입 신청 문서를 찾을 수 없습니다.");
  }

  const currentDoc = {
    ...(snap.data() as UserProfileDoc),
    id: uid,
  };

  const updatePayload = validateAndBuildRegistrationUpdate(currentDoc, input, mode);

  await updateDoc(userRef, {
    name: updatePayload.name,
    role: updatePayload.role,
    studentIdOrYear: updatePayload.studentIdOrYear,
    doubleMajor: updatePayload.doubleMajor || "",
    ...(updatePayload.academicProfile
      ? { academicProfile: updatePayload.academicProfile }
      : {}),
    verificationNote: updatePayload.verificationNote || "가입 정보 수정 및 보완 제출",
    bio: updatePayload.bio,
    avatarInitials: updatePayload.avatarInitials,
    approvalStatus: updatePayload.approvalStatus,
    revisionCount: updatePayload.revisionCount,
    lastModifiedAt: updatePayload.lastModifiedAt,
    updatedAt: updatePayload.updatedAt,
    ...(updatePayload.resubmittedAt
      ? { resubmittedAt: updatePayload.resubmittedAt }
      : {}),
  });

  const updatedSnap = await getDoc(userRef);
  return {
    ...(updatedSnap.data() as UserProfileDoc),
    id: uid,
    uid,
  };
}

/**
 * 관리자에 의해 Firestore 회원 문서가 삭제되었거나 누락된 계정(profile_missing)이
 * 로그인 상태에서 새 가입 신청서를 작성하여 users/{uid} 문서를 복구 생성합니다.
 */
export async function recreateDeletedUserProfileInFirestore(
  input: RegistrationRevisionInput
): Promise<UserProfileDoc> {
  const { auth, db } = getFirebaseInstances();
  if (!auth?.currentUser || !db) {
    throw new Error("로그인 세션 또는 데이터베이스 연결을 확인할 수 없습니다.");
  }

  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email || "";
  const restored = buildInitialUserProfileDoc(uid, {
    email,
    name: input.name,
    studentIdOrYear: input.studentIdOrYear,
    role: input.role,
    verificationNote: input.verificationNote || "재가입 승인 신청",
    academicProfile: input.academicProfile,
    doubleMajor: input.doubleMajor,
  });

  await setDoc(doc(db, USERS_COLLECTION, uid), restored);
  return restored;
}

/**
 * 현재 로그인한 사용자 본인의 Firebase Authentication 계정을 직접 완전 삭제합니다.
 * (관리자 삭제 후 남아있는 Auth 계정을 본인이 완전히 정리하고 싶을 때 사용)
 */
export async function deleteOwnAuthAccountInFirebase(): Promise<void> {
  const { auth } = getFirebaseInstances();
  if (!auth?.currentUser) {
    throw new Error("로그인된 계정이 없습니다.");
  }
  await deleteUser(auth.currentUser);
}

/**
 * 이메일·비밀번호 로그인
 */
export async function loginWithEmailAndPassword(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const { auth } = getFirebaseInstances();
  if (!auth) {
    throw new Error("Firebase 인증 모듈이 연결되지 않았습니다.");
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * 로그아웃
 */
export async function logoutUser(): Promise<void> {
  const { auth } = getFirebaseInstances();
  if (!auth) return;
  await signOut(auth);
}

/**
 * 로그인 성공 또는 '로그인 연장' 클릭 시 서버(Firestore users/{uid})에
 * 서버 타임스탬프(sessionStartedAt: serverTimestamp())와 만료 예정 시각(sessionExpiresAtMs)을 기록합니다.
 * Firestore Security Rules에서 request.time과 대조하여 클라이언트 시각 조작을 방지합니다.
 */
export async function syncUserSessionToFirestore(
  uid: string,
  expiresAtMs: number
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db || !uid) return;
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userDocRef, {
      sessionStartedAt: serverTimestamp(),
      sessionExpiresAtMs: expiresAtMs,
    });
  } catch {
    // 가입 직후이거나 오프라인 등 문서 갱신 실패 시 조용히 무시
  }
}

/**
 * 비밀번호 재설정 이메일 전송
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { auth } = getFirebaseInstances();
  if (!auth) {
    throw new Error("Firebase 인증 모듈이 연결되지 않았습니다.");
  }
  await sendPasswordResetEmail(auth, email);
}

export interface AuthStatusHandlers {
  /** 로그인 사용자가 바뀔 때마다(로그인·로그아웃·새로고침 복원) 회원 문서 조회 전에 먼저 호출 */
  onAuthUserChange: (rawUser: FirebaseUser | null) => void;
  /** 회원 문서가 조회되면 호출 (문서가 없으면 profile === null) */
  onProfileUpdate: (profile: UserProfileDoc | null, rawUser: FirebaseUser) => void;
  /** 회원 문서 조회 실패 (rawUser 가 있으면 로그인은 되어 있으나 문서 조회만 실패한 상태) */
  onProfileError: (err: string, rawUser: FirebaseUser | null) => void;
}

/**
 * 로그인 상태 및 내 Firestore 프로필 실시간 감지
 * - 1단계: onAuthStateChanged 로 로그인 여부를 먼저 확인
 * - 2단계: 로그인한 경우에만 users/{uid} 문서를 실시간 구독
 * - 관리자가 승인(approved)하거나 승인을 취소하면 실시간으로 내 화면에 즉시 반영됨
 */
export function subscribeToAuthStatus(handlers: AuthStatusHandlers): (() => void) | null {
  const { auth, db } = getFirebaseInstances();
  if (!auth || !db) return null;

  let docUnsub: (() => void) | null = null;

  const authUnsub = onAuthStateChanged(
    auth,
    (user) => {
      if (docUnsub) {
        docUnsub();
        docUnsub = null;
      }

      // 회원 문서 조회 전에 로그인 여부를 먼저 알림 (이전 사용자의 프로필이 남지 않도록)
      handlers.onAuthUserChange(user);

      if (!user) {
        return;
      }

      const userDocRef = doc(db, USERS_COLLECTION, user.uid);
      docUnsub = onSnapshot(
        userDocRef,
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            handlers.onProfileUpdate({ id: snap.id, uid: snap.id, ...d } as unknown as UserProfileDoc, user);
          } else {
            // Auth 계정은 있으나 회원 문서가 없음 (가입 직후 생성 지연 또는 문서 누락)
            handlers.onProfileUpdate(null, user);
          }
        },
        (error) => {
          handlers.onProfileError(`프로필 정보 조회 오류: ${error.message}`, user);
        }
      );
    },
    (error) => {
      handlers.onProfileError(`인증 상태 감지 오류: ${error.message}`, null);
    }
  );

  return () => {
    if (docUnsub) docUnsub();
    authUnsub();
  };
}

// ==========================================
// 2. 관리자 승인/거절 및 최초 관리자 생성 절차
// ==========================================

/**
 * 최초 관리자 계정 생성 절차 (Initial Admin Bootstrap)
 * - Firebase Authentication에 로그인된 계정 중, 시스템 초기화 문서(system/admin_bootstrap)가 비어있을 때만
 *   현재 로그인한 계정을 최초 관리자로 승인 등록합니다.
 * - 한 번 등록되면 추가 최초 관리자 등록은 차단됩니다.
 */
export async function claimInitialAdminRole(secretPin?: string): Promise<UserProfileDoc> {
  const { auth, db } = getFirebaseInstances();
  if (!auth || !db || !auth.currentUser) {
    throw new Error("로그인된 사용자가 없습니다. 먼저 계정을 생성하고 로그인해 주세요.");
  }

  const currentUser = auth.currentUser;
  const systemDocRef = doc(db, SYSTEM_COLLECTION, "admin_bootstrap");
  const systemDocSnap = await getDoc(systemDocRef);

  // 이미 관리자가 생성되어 있는지 검증 (보안)
  if (systemDocSnap.exists() && systemDocSnap.data()?.adminUid) {
    const existingAdminUid = systemDocSnap.data()?.adminUid;
    if (existingAdminUid !== currentUser.uid) {
      throw new Error("최초 관리자 계정이 이미 설정되어 있습니다. 기존 관리자에게 승인을 요청해 주세요.");
    }
  }

  const userDocRef = doc(db, USERS_COLLECTION, currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  const now = new Date().toISOString();

  // 1. system 문서에 adminUid 기록 (이미 본인으로 등록되어 있다면 재기록 건너뜀)
  if (systemDocSnap.exists() && systemDocSnap.data()?.adminUid) {
    const existingAdminUid = systemDocSnap.data()?.adminUid;
    if (existingAdminUid !== currentUser.uid) {
      throw new Error("최초 관리자 계정이 이미 설정되어 있습니다. 기존 관리자에게 승인을 요청해 주세요.");
    }
  } else {
    await setDoc(systemDocRef, {
      adminUid: currentUser.uid,
      adminEmail: currentUser.email,
      claimedAt: now,
    });
  }

  // 2. 만약 users 컬렉션에 내 프로필이 아직 없다면, 먼저 기본 프로필(pending)을 생성
  // (이렇게 하면 구글 서버의 allow create 보안 규칙을 100% 안전하게 통과합니다)
  if (!userDocSnap.exists()) {
    await setDoc(userDocRef, {
      uid: currentUser.uid,
      email: currentUser.email || "admin@dongguk.edu",
      name: currentUser.displayName || currentUser.email?.split("@")[0] || "이혜원",
      studentIdOrYear: "",
      role: "student" as UserRole,
      approvalStatus: "pending" as ApprovalStatus,
      verificationNote: "시스템 최초 관리자 개설 계정",
      adminComment: "최초 시스템 관리자로 등록 진행 중",
      joinedAt: now,
      updatedAt: now,
    });
  }

  // 3. 이제 관리자 권한 및 승인 완료로 최종 승격 업데이트 (allow update 보안 규칙 통과)
  await updateDoc(userDocRef, {
    role: "admin" as UserRole,
    approvalStatus: "approved" as ApprovalStatus,
    adminComment: "최초 시스템 관리자로 등록 및 승인 완료",
    updatedAt: now,
  });

  const updatedSnap = await getDoc(userDocRef);
  return updatedSnap.data() as UserProfileDoc;
}

/**
 * 관리자용: 가입 신청 회원 전체 실시간 구독
 */
export function subscribeToAllUsersForAdmin(
  onUsersUpdate: (users: UserProfileDoc[]) => void,
  onError: (err: string) => void
): (() => void) | null {
  const { db } = getFirebaseInstances();
  if (!db) return null;

  const colRef = collection(db, USERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: UserProfileDoc[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        list.push({ id: snap.id, uid: snap.id, ...d } as unknown as UserProfileDoc);
      });
      list.sort((a, b) => (b.joinedAt || "").localeCompare(a.joinedAt || ""));
      onUsersUpdate(list);
    },
    (err) => {
      onError(`회원 목록 조회 권한 오류: ${err.message}`);
    }
  );
}

/**
 * 관리자용: 특정 회원의 가입 승인, 거절, 보완요청 처리
 */
export async function updateUserApprovalStatusByAdmin(params: {
  targetUid: string;
  status: ApprovalStatus;
  adminComment?: string;
  role?: UserRole;
  revisionFields?: string[];
}): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db) throw new Error("Firestore가 연결되어 있지 않습니다.");

  const nowIso = new Date().toISOString();
  const userRef = doc(db, USERS_COLLECTION, params.targetUid);
  const updateData: Record<string, unknown> = {
    approvalStatus: params.status,
    adminComment: params.adminComment || "",
    updatedAt: nowIso,
    lastModifiedAt: nowIso,
  };

  if (
    params.status === "needs_revision" ||
    params.status === "supplement_requested"
  ) {
    updateData.revisionFields = Array.isArray(params.revisionFields)
      ? params.revisionFields
      : [];
  } else if (params.status === "approved") {
    updateData.revisionFields = [];
  }

  if (params.role) {
    updateData.role = params.role;
    // 재학생이 아닌 역할(졸업생, 교수진, 관리자)로 변경될 경우, 지도학생으로 남아있지 않도록 배정 정보 완전 제거
    if (params.role !== "student") {
      updateData.advisorProfessorId = "";
      updateData.advisorAssignedAt = "";
    }
    if (params.role === "admin") {
      updateData.studentIdOrYear = "";
    }
  }

  await updateDoc(userRef, updateData);

  // 채팅용 공개 프로필(publicProfiles) 컬렉션 동기화 (개인정보 보호: 이메일, 학번 등 민감정보 원천 제외)
  const publicRef = doc(db, "publicProfiles", params.targetUid);
  if (params.status === "approved") {
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const u = snap.data();
        await setDoc(
          publicRef,
          {
            id: params.targetUid,
            uid: params.targetUid,
            name: u.name || "구성원",
            role: params.role || u.role || "student",
            avatarInitials:
              getAvatarInitials(u.name, params.role || u.role) || u.avatarInitials || "",
            approvalStatus: "approved",
            careerTrack: u.careerTrack || "",
            doubleMajor: u.doubleMajor || "",
            bio: u.bio || "",
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
    } catch (e) {
      console.warn("공개 프로필 동기화 경고:", e);
    }
  } else {
    try {
      await deleteDoc(publicRef);
    } catch {
      // ignore
    }
  }
}

/**
 * 관리자용: 특정 회원의 데이터 및 인증 계정 삭제 처리 (단계별 결과 리포트 반환)
 * - 브라우저에서는 절대 Firebase Admin SDK를 직접 실행하지 않음
 * - 보안 서버 엔드포인트(NEXT_PUBLIC_ADMIN_DELETE_USER_ENDPOINT)가 설정된 경우:
 *   현재 로그인한 관리자의 ID Token을 전달하여 서버에서 관리자 권한 재검증 후 Firebase Auth 계정 삭제 수행
 * - 정적 호스팅(GitHub Pages / Spark 무료 요금제) 환경인 경우:
 *   Firestore 개인정보 문서들을 단계별로 삭제·정리하고, Auth 계정 상태를 투명하게 안내하며,
 *   삭제된 이메일로 재가입 시 자동 복구(users/{uid} 재생성)가 작동하도록 보장
 */
export async function deleteUserByAdminInFirestore(
  targetUid: string,
  options?: { targetName?: string; targetEmail?: string }
): Promise<UserDeletionReport> {
  const { auth, db } = getFirebaseInstances();
  if (!db) throw new Error("Firestore가 연결되어 있지 않습니다.");

  if (auth?.currentUser && auth.currentUser.uid === targetUid) {
    throw new Error("현재 로그인된 관리자 본인 계정은 삭제할 수 없습니다.");
  }

  const steps: UserDeletionStepResult[] = [];

  // 1. users/{targetUid} 회원 기본 문서 삭제
  try {
    const userRef = doc(db, USERS_COLLECTION, targetUid);
    await deleteDoc(userRef);
    steps.push({
      key: "userDoc",
      label: "Firestore 회원 기본 문서 (users)",
      status: "success",
      detail: `users/${targetUid} 개인정보 문서 삭제 완료`,
    });
  } catch (e: any) {
    steps.push({
      key: "userDoc",
      label: "Firestore 회원 기본 문서 (users)",
      status: "failed",
      detail: e?.message || "회원 문서 삭제 실패",
    });
  }

  // 2. publicProfiles/{targetUid} 공개 프로필 삭제
  try {
    const publicRef = doc(db, "publicProfiles", targetUid);
    await deleteDoc(publicRef);
    steps.push({
      key: "publicProfile",
      label: "공개 프로필 (publicProfiles)",
      status: "success",
      detail: `publicProfiles/${targetUid} 삭제 완료`,
    });
  } catch (e: any) {
    console.warn("공개 프로필 삭제 경고:", e);
    steps.push({
      key: "publicProfile",
      label: "공개 프로필 (publicProfiles)",
      status: "failed",
      detail: e?.message || "공개 프로필 삭제 중 오류",
    });
  }

  // 3. graduationRecords/{targetUid} 개인별 졸업요건 기록 삭제
  try {
    const gradRef = doc(db, "graduationRecords", targetUid);
    await deleteDoc(gradRef);
    steps.push({
      key: "graduationRecord",
      label: "졸업요건 개인 기록 (graduationRecords)",
      status: "success",
      detail: `graduationRecords/${targetUid} 삭제 완료`,
    });
  } catch (e: any) {
    console.warn("졸업요건 문서 삭제 경고:", e);
    steps.push({
      key: "graduationRecord",
      label: "졸업요건 개인 기록 (graduationRecords)",
      status: "failed",
      detail: e?.message || "졸업요건 문서 삭제 중 오류",
    });
  }

  // 4. alumniProfiles/{targetUid} 졸업생 멘토링 프로필 삭제
  try {
    const alumniRef = doc(db, "alumniProfiles", targetUid);
    await deleteDoc(alumniRef);
    steps.push({
      key: "alumniProfile",
      label: "졸업생 네트워크 프로필 (alumniProfiles)",
      status: "success",
      detail: `alumniProfiles/${targetUid} 삭제 완료`,
    });
  } catch (e: any) {
    console.warn("졸업생 프로필 삭제 경고:", e);
    steps.push({
      key: "alumniProfile",
      label: "졸업생 네트워크 프로필 (alumniProfiles)",
      status: "failed",
      detail: e?.message || "졸업생 프로필 삭제 중 오류",
    });
  }

  // 5. 삭제 대상이 교수였을 경우, 배정되어 있던 학생들의 지도교수 필드 안전 초기화
  try {
    const studentsQuery = query(
      collection(db, USERS_COLLECTION),
      where("advisorProfessorId", "==", targetUid)
    );
    const snap = await getDocs(studentsQuery);
    if (!snap.empty) {
      const updates = snap.docs.map((d) =>
        updateDoc(d.ref, {
          advisorProfessorId: "",
          advisorAssignedAt: "",
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(updates);
    }
    steps.push({
      key: "advisorLinks",
      label: "지도학생 배정 참조 정리",
      status: "success",
      affectedCount: snap.size,
      detail:
        snap.size > 0
          ? `배정 학생 ${snap.size}명의 지도교수 연결 참조 초기화 완료`
          : "연결된 지도학생 참조 없음 (정상)",
    });
  } catch (e: any) {
    console.warn("지도학생 배정 해제 연동 경고:", e);
    steps.push({
      key: "advisorLinks",
      label: "지도학생 배정 참조 정리",
      status: "failed",
      detail: e?.message || "지도학생 배정 초기화 실패",
    });
  }

  // 6. 개인별 캘린더 일정 (서브컬렉션 + 루트 컬렉션) 일괄 삭제
  try {
    let deletedCalCount = 0;
    const calendarEventsRef = collection(db, USERS_COLLECTION, targetUid, "calendarEvents");
    const calSnap = await getDocs(calendarEventsRef);
    if (!calSnap.empty) {
      await Promise.all(calSnap.docs.map((d) => deleteDoc(d.ref)));
      deletedCalCount += calSnap.size;
    }

    const rootCalQuery = query(
      collection(db, "calendarEvents"),
      where("userId", "==", targetUid)
    );
    const rootCalSnap = await getDocs(rootCalQuery);
    if (!rootCalSnap.empty) {
      await Promise.all(rootCalSnap.docs.map((d) => deleteDoc(d.ref)));
      deletedCalCount += rootCalSnap.size;
    }

    steps.push({
      key: "calendarEvents",
      label: "개인 캘린더 일정 (calendarEvents)",
      status: "success",
      affectedCount: deletedCalCount,
      detail: `개인 일정 ${deletedCalCount}건 삭제 완료`,
    });
  } catch (e: any) {
    console.warn("캘린더 일정 삭제 경고:", e);
    steps.push({
      key: "calendarEvents",
      label: "개인 캘린더 일정 (calendarEvents)",
      status: "failed",
      detail: e?.message || "개인 일정 삭제 실패",
    });
  }

  // 7. 상담 신청 내역 삭제 (학생 또는 교수로 연관된 모든 상담 문서 삭제)
  try {
    const colRef = collection(db, CONSULTATIONS_COLLECTION);
    const [snapStudent, snapProf] = await Promise.all([
      getDocs(query(colRef, where("studentId", "==", targetUid))),
      getDocs(query(colRef, where("professorId", "==", targetUid))),
    ]);
    const consultDocs = [...snapStudent.docs, ...snapProf.docs];
    const seenIds = new Set<string>();
    const uniqueDocs = consultDocs.filter((d) => {
      if (seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });
    if (uniqueDocs.length > 0) {
      await Promise.all(uniqueDocs.map((d) => deleteDoc(d.ref)));
    }
    steps.push({
      key: "consultations",
      label: "상담 신청 기록 (consultations)",
      status: "success",
      affectedCount: uniqueDocs.length,
      detail: `관련 상담 기록 ${uniqueDocs.length}건 정리 완료`,
    });
  } catch (e: any) {
    console.warn("상담 내역 삭제 연동 경고:", e);
    steps.push({
      key: "consultations",
      label: "상담 신청 기록 (consultations)",
      status: "failed",
      detail: e?.message || "상담 내역 정리 실패",
    });
  }

  // 8. 대화방(채팅방) 정리:
  // - 단체 대화방: participants 및 participantDetails에서 대상 사용자만 제거하여 다른 회원의 대화 기록 보존
  // - 1:1 대화방: 정리 처리
  try {
    const chatsQuery = query(
      collection(db, CHATS_COLLECTION),
      where("participants", "array-contains", targetUid)
    );
    const chatsSnap = await getDocs(chatsQuery);
    for (const chatDoc of chatsSnap.docs) {
      const chatData = chatDoc.data() as FirestoreChatRoom;
      const isDirect = !chatData.isGroup || (chatData.participants && chatData.participants.length <= 2);
      if (isDirect) {
        await deleteDoc(chatDoc.ref);
      } else {
        const remaining = (chatData.participants || []).filter((id) => id !== targetUid);
        if (remaining.length === 0) {
          await deleteDoc(chatDoc.ref);
        } else {
          const updatePayload: Record<string, any> = {
            participants: arrayRemove(targetUid),
          };
          if (chatData.participantDetails && chatData.participantDetails[targetUid]) {
            updatePayload[`participantDetails.${targetUid}`] = deleteField();
          }
          await updateDoc(chatDoc.ref, updatePayload);
        }
      }
    }
    steps.push({
      key: "chatRooms",
      label: "채팅방 참여자 정리 (타 회원 단체 대화 보존)",
      status: "success",
      affectedCount: chatsSnap.size,
      detail: `참여 채팅방 ${chatsSnap.size}건 정리 완료`,
    });
  } catch (e: any) {
    console.warn("대화방 데이터 정리 연동 경고:", e);
    steps.push({
      key: "chatRooms",
      label: "채팅방 참여자 정리 (타 회원 단체 대화 보존)",
      status: "failed",
      detail: e?.message || "채팅방 참여 정보 정리 실패",
    });
  }

  // 9. 공동 게시판(communityPosts) 보존 명시
  steps.push({
    key: "communityPosts",
    label: "진로·복수전공 공동 게시글 및 댓글",
    status: "skipped",
    detail: "공동 게시판 맥락 및 타 회원 댓글 보호 정책에 따라 원글·댓글 보존",
  });

  // 10. 서버 측 Firebase Authentication 계정 삭제 요청 (엔드포인트 설정 시 호출)
  const adminDeleteEndpoint =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_ADMIN_DELETE_USER_ENDPOINT
      : undefined;

  let authDeletedOnServer = false;
  if (adminDeleteEndpoint && auth?.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(adminDeleteEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUid }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`서버 응답 오류 (${res.status}): ${errBody}`);
      }
      authDeletedOnServer = true;
      steps.push({
        key: "authAccount",
        label: "Firebase Authentication 계정 삭제 (서버 검증)",
        status: "success",
        detail: "서버 Admin SDK를 통해 Firebase Auth 계정이 완전히 삭제되었습니다.",
      });
    } catch (e: any) {
      steps.push({
        key: "authAccount",
        label: "Firebase Authentication 계정 삭제 (서버 검증)",
        status: "failed",
        detail: e?.message || "서버 측 Auth 계정 삭제 호출 실패",
      });
    }
  } else {
    // 정적 호스팅(GitHub Pages) 환경: 허위로 삭제 완료라 표시하지 않고 정확한 상태와 재가입 자동 복구 안내 제공
    steps.push({
      key: "authAccount",
      label: "Firebase Authentication 계정 (정적 호스팅 모드)",
      status: "manual_or_rejoin_ready",
      detail:
        "GitHub Pages 정적 호스팅 환경에서는 브라우저에서 Admin SDK를 실행하지 않습니다. 단, 해당 사용자가 동일 이메일로 다시 가입 신청하거나 로그인하면 '이미 가입된 회원' 오류 없이 새 가입 신청서로 자동 복구됩니다.",
    });
  }

  return buildUserDeletionReport({
    targetUid,
    targetName: options?.targetName,
    targetEmail: options?.targetEmail,
    steps,
    authDeletedOnServer,
  });
}

/**
 * 관리자용: 과거에 삭제된 계정의 잔여 데이터(상담 신청서, 단체방 유령 참여자, 1:1 대화방 등)를
 * Firestore에서 일괄 감지하여 안전하게 영구 정리합니다.
 */
export async function cleanupOrphanedUserDataInFirestore(): Promise<{
  deletedConsultations: number;
  cleanedChats: number;
}> {
  const { db } = getFirebaseInstances();
  if (!db) throw new Error("Firestore가 연결되어 있지 않습니다.");

  let deletedConsultations = 0;
  let cleanedChats = 0;

  try {
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const validUids = new Set(usersSnap.docs.map((d) => d.id));

    // 1. 상담 내역 검사: 신청 학생이나 담당 교수가 users 컬렉션에 없는 경우 영구 삭제
    const consultSnap = await getDocs(collection(db, CONSULTATIONS_COLLECTION));
    const orphanConsults = consultSnap.docs.filter((d) => {
      const data = d.data();
      return !validUids.has(data.studentId) || !validUids.has(data.professorId);
    });

    if (orphanConsults.length > 0) {
      await Promise.all(orphanConsults.map((d) => deleteDoc(d.ref)));
      deletedConsultations = orphanConsults.length;
    }

    // 2. 대화방 검사: 존재하지 않는 참여자 정리
    const chatsSnap = await getDocs(collection(db, CHATS_COLLECTION));
    for (const chatDoc of chatsSnap.docs) {
      const chatData = chatDoc.data() as FirestoreChatRoom;
      const participants = chatData.participants || [];
      const invalidMembers = participants.filter((uid) => !validUids.has(uid));

      if (invalidMembers.length > 0) {
        const remaining = participants.filter((uid) => validUids.has(uid));
        if (!chatData.isGroup || remaining.length <= 1) {
          if (!chatData.isGroup || remaining.length === 0) {
            await deleteDoc(chatDoc.ref);
            cleanedChats++;
            continue;
          }
        }

        const updatePayload: Record<string, any> = {
          participants: remaining,
        };
        for (const badUid of invalidMembers) {
          if (chatData.participantDetails && chatData.participantDetails[badUid]) {
            updatePayload[`participantDetails.${badUid}`] = deleteField();
          }
        }
        await updateDoc(chatDoc.ref, updatePayload);
        cleanedChats++;
      }
    }
  } catch (err) {
    console.warn("잔여 데이터 일괄 정리 경고:", err);
  }

  return { deletedConsultations, cleanedChats };
}


/**
 * 사용자(관리자 포함)의 표시 이름 및 프로필 이니셜 변경
 */
export async function updateUserDisplayName(
  uid: string,
  newName: string
): Promise<void> {
  const { auth, db } = getFirebaseInstances();
  if (!db) throw new Error("Firestore가 연결되어 있지 않습니다.");

  const trimmed = newName.trim();
  if (!trimmed) throw new Error("이름을 공백으로 설정할 수 없습니다.");

  const avatarInitials = getAvatarInitials(trimmed);
  const userRef = doc(db, USERS_COLLECTION, uid);

  await updateDoc(userRef, {
    name: trimmed,
    avatarInitials,
    updatedAt: new Date().toISOString(),
  });

  try {
    const publicRef = doc(db, "publicProfiles", uid);
    await setDoc(
      publicRef,
      {
        name: trimmed,
        avatarInitials,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // ignore
  }

  if (auth?.currentUser && auth.currentUser.uid === uid) {
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    } catch {
      // ignore
    }
  }
}

// ==========================================
// 3. Firestore 공유방 게시글 실시간 연동
// ==========================================

export function subscribeToCommunityPosts(
  onUpdate: (posts: CommunityPost[]) => void,
  onError: (errMessage: string) => void
): (() => void) | null {
  const { db } = getFirestoreInstance();
  if (!db) return null;

  const colRef = collection(db, POSTS_COLLECTION);
  let seeded = false;

  const unsubscribe = onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && !seeded) {
        seeded = true;
        try {
          const checkSnap = await getDocs(colRef);
          if (checkSnap.empty) {
            const batch = writeBatch(db);
            MOCK_COMMUNITY_POSTS.forEach((post) => {
              const postRef = doc(db, POSTS_COLLECTION, post.id);
              batch.set(postRef, post);
            });
            await batch.commit();
            return;
          }
        } catch (err) {
          onError(
            err instanceof Error
              ? err.message
              : "초기 예시 게시글을 Firestore에 등록하는 중 권한 오류가 발생했습니다."
          );
        }
      }

      const loadedPosts: CommunityPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CommunityPost;
        const likedUserIds = Array.isArray(data.likedUserIds) ? data.likedUserIds : [];
        loadedPosts.push({
          ...data,
          id: docSnap.id,
          comments: Array.isArray(data.comments) ? data.comments : [],
          likedUserIds,
          likes: typeof data.likes === "number" ? data.likes : likedUserIds.length,
        });
      });

      loadedPosts.sort((a, b) => {
        const dateCmp = b.createdAt.localeCompare(a.createdAt);
        if (dateCmp !== 0) return dateCmp;
        return b.id.localeCompare(a.id);
      });

      onUpdate(loadedPosts);
    },
    (error) => {
      onError(
        `Firestore 실시간 동기화 오류: ${error.message} (Firebase 콘솔에서 Firestore 데이터베이스 생성 및 규칙 게시 여부를 확인해 주세요.)`
      );
    }
  );

  return unsubscribe;
}

export async function createPostInFirestore(post: CommunityPost): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, post.id);
  await setDoc(postRef, post);
}

export async function updatePostInFirestore(
  postId: string,
  updatedPost: CommunityPost
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await updateDoc(postRef, {
    category: updatedPost.category,
    title: updatedPost.title,
    content: updatedPost.content,
  });
}

export async function deletePostInFirestore(postId: string): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await deleteDoc(postRef);
}

export async function addCommentInFirestore(
  postId: string,
  updatedComments: CommunityComment[]
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await updateDoc(postRef, { comments: updatedComments });
}

export async function toggleLikeInFirestore(
  postId: string,
  newLikesCount: number,
  likedUserIds: string[]
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await updateDoc(postRef, {
    likes: newLikesCount,
    likedUserIds: likedUserIds,
  });
}

export async function incrementLikeInFirestore(
  postId: string,
  newLikesCount: number
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await updateDoc(postRef, { likes: newLikesCount });
}

// ==========================================
// 4. 실시간 채팅(1:1 & 단체) Firestore 통신 로직
// ==========================================

export interface FirestoreChatParticipantInfo {
  uid: string;
  name: string;
  role: UserRole;
  studentIdOrYear?: string;
  avatarInitials: string;
}

export interface FirestoreChatRoom {
  id: string;
  title: string;
  isGroup: boolean;
  categoryTag?: string;
  participants: string[];
  participantDetails?: Record<string, FirestoreChatParticipantInfo>;
  lastMessageText: string;
  lastMessageAt: string;
  /** 마지막 메시지 전송 시각 밀리초 (최신 메시지순 정렬용) */
  lastMessageTimestamp?: number;
  /** 마지막 메시지 전송 시각 ISO 8601 문자열 */
  lastMessageIso?: string;
  /** 대화방 생성 시각 밀리초 */
  createdAtTimestamp?: number;
  lastSenderId?: string;
  createdBy: string;
  createdAt: string;
  /** 대화방 내 일반 메시지 마지막 순번 (읽음 표시 커서 계산용) */
  msgSeq?: number;
  /** 참여자별 마지막으로 읽은 메시지 순번 */
  readSeq?: Record<string, number>;
  /** 참여자별 대화방 입장 시점의 메시지 순번 (초대 이전 메시지 안읽음 제외용) */
  joinSeq?: Record<string, number>;
}

export interface FirestoreChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  createdAt: string;
  timestamp?: any;
  isSystemMessage?: boolean;
  /** 대화방 내 일반 메시지 순번 (1부터 단조 증가) */
  seq?: number;
}

/**
 * 채팅 상대 검색 및 초대용 공개 프로필 모델
 * 개인정보 보호를 위해 이메일, 학번, 관리자 코멘트 등 비공개 정보는 원천 배제합니다.
 */
export interface PublicChatUser {
  id: string;
  uid: string;
  name: string;
  role: UserRole;
  avatarInitials: string;
  approvalStatus: "approved";
  careerTrack?: string;
  doubleMajor?: string;
  bio?: string;
  specialty?: string;
  consultationAvailable?: boolean;
  studentIdOrYear?: string;
  photoUrl?: string;
  advisorProfessorId?: string;
}

/**
 * 관리자가 로드한 승인 회원들을 publicProfiles 컬렉션으로 자동 동기화
 * (과거에 승인된 회원도 누락 없이 즉시 공개 프로필로 연동)
 */
export async function syncApprovedUsersToPublicProfiles(
  users: UserProfileDoc[]
): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !Array.isArray(users) || users.length === 0) return;

  const approvedUsers = users.filter((u) => {
    const st = (u.approvalStatus || "").toString().trim().toLowerCase();
    return st === "approved";
  });

  for (const u of approvedUsers) {
    const uid = u.id || u.uid;
    if (!uid) continue;
    try {
      const publicRef = doc(db, "publicProfiles", uid);
      await setDoc(
        publicRef,
        {
          id: uid,
          uid,
          name: u.name || "구성원",
          role: u.role || "student",
          avatarInitials:
            getAvatarInitials(u.name, u.role) || u.avatarInitials || "",
          approvalStatus: "approved",
          careerTrack: u.careerTrack || "",
          doubleMajor: u.doubleMajor || "",
          bio: u.bio || "",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // 권한 제한 등으로 실패 시 무시
    }
  }
}

/**
 * 대화 상대 검색용: 관리자 승인을 받은 정회원 목록을 실시간 구독합니다.
 * - users 컬렉션 및 publicProfiles 컬렉션을 이중으로 관찰하여 과거 승인 회원 및 규칙 변경 지연 시에도 100% 안전하게 동기화합니다.
 * - approvalStatus == 'approved' 인 회원만 필터링합니다.
 * - 개인정보 보호 원칙에 따라 이메일, 학번 등 민감 정보는 원천 배제합니다.
 */
export function subscribeToApprovedUsers(
  excludeUid: string | undefined,
  onUpdate: (users: PublicChatUser[]) => void,
  onError: (errMessage: string) => void
): () => void {
  const { db } = getFirebaseInstances();
  if (!db) return () => {};

  const usersMap = new Map<string, PublicChatUser>();
  const publicMap = new Map<string, PublicChatUser>();

  const emitMerged = () => {
    const combined = new Map<string, PublicChatUser>();
    publicMap.forEach((val, key) => combined.set(key, val));
    usersMap.forEach((val, key) => combined.set(key, val));

    const list: PublicChatUser[] = [];
    combined.forEach((u, docId) => {
      if (!excludeUid || docId !== excludeUid) {
        list.push(u);
      }
    });

    list.sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
    onUpdate(list);
  };

  // 1. users 컬렉션 승인 회원 구독
  let unsubUsers: (() => void) | null = null;
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where("approvalStatus", "==", "approved")
    );

    unsubUsers = onSnapshot(
      q,
      (snapshot) => {
        usersMap.clear();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const st = (d.approvalStatus || d.status || "").toString().trim().toLowerCase();
          if (st === "approved") {
            const docId = docSnap.id;
            usersMap.set(docId, {
              id: docId,
              uid: docId,
              name: d.name || "구성원",
              role: (d.role as UserRole) || "student",
              avatarInitials:
                getAvatarInitials(d.name, d.role) || d.avatarInitials || "",
              approvalStatus: "approved",
              careerTrack: d.careerTrack || "",
              doubleMajor: d.doubleMajor || "",
              bio: d.bio || "",
              specialty: d.specialty || "",
              consultationAvailable: d.consultationAvailable !== false,
              studentIdOrYear: d.studentIdOrYear || "",
              photoUrl: d.photoUrl || "",
              advisorProfessorId: d.advisorProfessorId || "",
            });
          }
        });
        emitMerged();
      },
      (err) => {
        console.warn("users 컬렉션 승인 회원 구독 경고:", err);
      }
    );
  } catch (e) {
    console.warn("users 쿼리 생성 실패:", e);
  }

  // 2. publicProfiles 컬렉션 구독 (과거 승인자 및 보안 규칙 간소화 보완)
  let unsubPublic: (() => void) | null = null;
  try {
    const colPublic = collection(db, "publicProfiles");
    unsubPublic = onSnapshot(
      colPublic,
      (snapshot) => {
        publicMap.clear();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const docId = docSnap.id;
          publicMap.set(docId, {
            id: docId,
            uid: docId,
            name: d.name || "구성원",
            role: (d.role as UserRole) || "student",
            avatarInitials:
              getAvatarInitials(d.name, d.role) || d.avatarInitials || "",
            approvalStatus: "approved",
            careerTrack: d.careerTrack || "",
            doubleMajor: d.doubleMajor || "",
            bio: d.bio || "",
            specialty: d.specialty || "",
            consultationAvailable: d.consultationAvailable !== false,
            studentIdOrYear: d.studentIdOrYear || "",
            photoUrl: d.photoUrl || "",
            advisorProfessorId: d.advisorProfessorId || "",
          });
        });
        emitMerged();
      },
      (err) => {
        console.warn("publicProfiles 구독 경고:", err);
        if (usersMap.size === 0) {
          onError(err.message || "승인 회원 목록을 불러오는 중 오류가 발생했습니다.");
        }
      }
    );
  } catch (e) {
    console.warn("publicProfiles 구독 실패:", e);
  }

  return () => {
    if (unsubUsers) unsubUsers();
    if (unsubPublic) unsubPublic();
  };
}

/**
 * 대화 상대 1회성 검색 함수
 */
export async function searchApprovedUsersInFirestore(
  excludeUid?: string
): Promise<PublicChatUser[]> {
  const { db } = getFirestoreInstance();
  if (!db) return [];

  const map = new Map<string, PublicChatUser>();

  // 1. users 시도
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where("approvalStatus", "==", "approved")
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data();
      const st = (data.approvalStatus || data.status || "").toString().trim().toLowerCase();
      if (st === "approved" && (!excludeUid || d.id !== excludeUid)) {
        map.set(d.id, {
          id: d.id,
          uid: d.id,
          name: data.name || "구성원",
          role: (data.role as UserRole) || "student",
          avatarInitials:
            data.avatarInitials ||
            getAvatarInitials(data.name, data.role) || data.avatarInitials || "",
          approvalStatus: "approved",
          careerTrack: data.careerTrack || "",
          doubleMajor: data.doubleMajor || "",
          bio: data.bio || "",
        });
      }
    });
  } catch (err) {
    console.warn("users 검색 쿼리 경고:", err);
  }

  // 2. publicProfiles 보완
  try {
    const snap = await getDocs(collection(db, "publicProfiles"));
    snap.forEach((d) => {
      const data = d.data();
      if (!excludeUid || d.id !== excludeUid) {
        if (!map.has(d.id)) {
          map.set(d.id, {
            id: d.id,
            uid: d.id,
            name: data.name || "구성원",
            role: (data.role as UserRole) || "student",
            avatarInitials:
              data.avatarInitials ||
              getAvatarInitials(data.name, data.role) || data.avatarInitials || "",
            approvalStatus: "approved",
            careerTrack: data.careerTrack || "",
            doubleMajor: data.doubleMajor || "",
            bio: data.bio || "",
          });
        }
      }
    });
  } catch (err) {
    console.warn("publicProfiles 검색 쿼리 경고:", err);
  }

  const list = Array.from(map.values());
  list.sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  return list;
}

/**
 * 로그인한 사용자가 참여 중인 대화방 목록을 실시간 구독합니다.
 */
export function subscribeToUserChats(
  currentUid: string,
  onUpdate: (chats: FirestoreChatRoom[]) => void,
  onError: (err: string) => void
): () => void {
  const { db } = getFirestoreInstance();
  if (!db) {
    return () => {};
  }

  const q = query(
    collection(db, CHATS_COLLECTION),
    where("participants", "array-contains", currentUid)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: FirestoreChatRoom[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });

      list.sort(compareChatRoomsByLatestMessage);

      onUpdate(list);
    },
    (err) => {
      onError(`대화방 목록 동기화 오류: ${err.message}`);
    }
  );

  return unsubscribe;
}

/**
 * 특정 대화방의 메시지 내역을 실시간 구독합니다. (최근 50개 제한으로 Firestore 비용 절약)
 */
export function subscribeToChatMessages(
  chatId: string,
  limitCount = 50,
  onUpdate: (messages: FirestoreChatMessage[]) => void,
  onError: (err: string) => void
): () => void {
  const { db } = getFirestoreInstance();
  if (!db || !chatId) {
    return () => {};
  }

  const msgsRef = collection(db, CHATS_COLLECTION, chatId, "messages");
  const q = query(msgsRef, orderBy("timestamp", "desc"), limit(limitCount));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const msgs: FirestoreChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...(d.data() as any) });
      });

      // 오래된 메시지부터 최신 메시지 순서로 정렬 (순번 seq가 둘 다 있으면 seq 우선)
      msgs.sort((a, b) => {
        const seqCmp = compareBySeq(a, b);
        if (seqCmp !== 0) return seqCmp;
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        if (tA && tB && tA !== tB) return tA - tB;
        return (
          (a.createdAt || "").localeCompare(b.createdAt || "") ||
          a.id.localeCompare(b.id)
        );
      });

      onUpdate(msgs);
    },
    (err) => {
      onError(`메시지 동기화 오류: ${err.message}`);
    }
  );

  return unsubscribe;
}

/**
 * 1:1 대화방을 조회하거나 없으면 새로 생성합니다.
 * 두 사용자의 UID를 조합한 고유 ID(direct_UID1_UID2)를 부여하여 중복 생성을 방지합니다.
 */
export async function getOrCreateDirectChatInFirestore(
  currentUser: PlatformUser,
  targetUser: { id: string; name: string; role: UserRole; avatarInitials?: string; studentIdOrYear?: string },
  categoryTag?: string
): Promise<string> {
  const { db } = getFirestoreInstance();
  if (!db) throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");

  const [uid1, uid2] = [currentUser.id, targetUser.id].sort();
  const chatId = `direct_${uid1}_${uid2}`;
  const chatDocRef = doc(db, CHATS_COLLECTION, chatId);

  try {
    const snap = await getDoc(chatDocRef);
    if (snap.exists()) {
      return chatId;
    }
  } catch (readErr) {
    // Firestore 보안 규칙 상 아직 존재하지 않는 대화방(resource == null)에 getDoc을 시도하면
    // permission-denied (Missing or insufficient permissions)가 반환될 수 있습니다.
    // 이는 정상적인 신규 대화방 생성 흐름이므로 예외를 무시하고 생성을 계속 진행합니다.
    console.info("기존 대화방 문서 없음 또는 조회 권한 예외(신규 대화방 개설 진행):", readErr);
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nowTime = new Date(nowMs).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nowDate = nowIso.slice(0, 10);

  const newChat: FirestoreChatRoom = {
    id: chatId,
    title: targetUser.name,
    isGroup: false,
    categoryTag:
      categoryTag ||
      (currentUser.role === "professor" ? "교수-학생 면담" : "1:1 대화"),
    participants: [currentUser.id, targetUser.id],
    participantDetails: {
      [currentUser.id]: {
        uid: currentUser.id,
        name: currentUser.name || "사용자",
        role: currentUser.role || "student",
        avatarInitials:
          currentUser.avatarInitials ||
          getAvatarInitials(currentUser.name, currentUser.role) || currentUser.avatarInitials || "",
      },
      [targetUser.id]: {
        uid: targetUser.id,
        name: targetUser.name || "상대방",
        role: targetUser.role || "student",
        avatarInitials:
          targetUser.avatarInitials ||
          getAvatarInitials(targetUser.name, targetUser.role) || targetUser.avatarInitials || "",
      },
    },
    lastMessageText: "대화가 시작되었습니다. 첫 인사를 건네보세요!",
    lastMessageAt: nowTime,
    lastMessageTimestamp: nowMs,
    lastMessageIso: nowIso,
    createdAtTimestamp: nowMs,
    lastSenderId: currentUser.id,
    createdBy: currentUser.id,
    createdAt: nowDate,
    msgSeq: 0,
    readSeq: {
      [currentUser.id]: 0,
      [targetUser.id]: 0,
    },
    joinSeq: {
      [currentUser.id]: 0,
      [targetUser.id]: 0,
    },
  };

  await setDoc(chatDocRef, newChat);

  // 초기 시스템 안내 메시지 생성 (실패하더라도 방 개설은 보장)
  try {
    const initMsgRef = doc(collection(db, CHATS_COLLECTION, chatId, "messages"));
    await setDoc(initMsgRef, {
      id: initMsgRef.id,
      chatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      content: `${currentUser.name}님이 ${targetUser.name}님과의 대화를 시작했습니다.`,
      createdAt: nowTime,
      timestamp: serverTimestamp(),
      isSystemMessage: true,
    });
  } catch (msgErr) {
    console.warn("초기 시스템 안내 메시지 등록 경고(대화방은 정상 개설됨):", msgErr);
  }

  return chatId;
}

/**
 * 여러 명을 초대하여 새로운 단체 대화방을 생성합니다.
 */
export async function createGroupChatInFirestore(
  currentUser: PlatformUser,
  title: string,
  invitedUsers: { id: string; name: string; role: UserRole; avatarInitials?: string }[],
  categoryTag = "단체 대화방"
): Promise<string> {
  const { db } = getFirestoreInstance();
  if (!db) throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");

  const chatId = `group_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const chatDocRef = doc(db, CHATS_COLLECTION, chatId);

  const allUsers = [
    {
      uid: currentUser.id,
      name: currentUser.name || "사용자",
      role: currentUser.role || "student",
      avatarInitials:
        currentUser.avatarInitials ||
        getAvatarInitials(currentUser.name, currentUser.role) || currentUser.avatarInitials || "",
    },
    ...invitedUsers.map((u) => ({
      uid: u.id,
      name: u.name,
      role: u.role,
      avatarInitials:
        getAvatarInitials(u.name, u.role) || u.avatarInitials || "",
    })),
  ];

  const participants = Array.from(new Set(allUsers.map((u) => u.uid)));
  const participantDetails: Record<string, FirestoreChatParticipantInfo> = {};
  allUsers.forEach((u) => {
    participantDetails[u.uid] = u;
  });

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nowTime = new Date(nowMs).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nowDate = nowIso.slice(0, 10);

  const initialCursorMap: Record<string, number> = {};
  participants.forEach((uid) => {
    initialCursorMap[uid] = 0;
  });

  const newChat: FirestoreChatRoom = {
    id: chatId,
    title: title.trim() || "새 단체 대화방",
    isGroup: true,
    categoryTag,
    participants,
    participantDetails,
    lastMessageText: `${currentUser.name}님이 방을 개설했습니다.`,
    lastMessageAt: nowTime,
    lastMessageTimestamp: nowMs,
    lastMessageIso: nowIso,
    createdAtTimestamp: nowMs,
    lastSenderId: currentUser.id,
    createdBy: currentUser.id,
    createdAt: nowDate,
    msgSeq: 0,
    readSeq: { ...initialCursorMap },
    joinSeq: { ...initialCursorMap },
  };

  await setDoc(chatDocRef, newChat);

  try {
    const initMsgRef = doc(collection(db, CHATS_COLLECTION, chatId, "messages"));
    await setDoc(initMsgRef, {
      id: initMsgRef.id,
      chatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      content: `${currentUser.name}님이 '${newChat.title}' 대화방을 만들었습니다.`,
      createdAt: nowTime,
      timestamp: serverTimestamp(),
      isSystemMessage: true,
    });
  } catch (msgErr) {
    console.warn("단체방 초기 안내 메시지 등록 경고(대화방은 정상 개설됨):", msgErr);
  }

  return chatId;
}

/**
 * 대화방에 새 메시지를 전송하고 방의 마지막 메시지 정보 및 순번(msgSeq, 발신자 readSeq)을 원자적으로 갱신합니다.
 * - 동시에 여러 명이 메시지를 보내도 순번이 꼬이지 않도록 Firestore 트랜잭션을 사용합니다.
 * - 메시지를 보낸 본인은 그 순번까지 자동으로 읽은 것으로 처리됩니다.
 */
export async function sendChatMessageInFirestore(
  chatId: string,
  currentUser: PlatformUser,
  content: string
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");

  const trimmed = content.trim();
  if (!trimmed) return;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nowTime = new Date(nowMs).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const msgRef = doc(collection(db, CHATS_COLLECTION, chatId, "messages"));

  await runTransaction(db, async (tx) => {
    const chatSnap = await tx.get(chatRef);
    if (!chatSnap.exists()) {
      throw new Error("존재하지 않는 대화방입니다.");
    }
    const chatData = chatSnap.data() as FirestoreChatRoom;
    const prevSeq =
      typeof chatData.msgSeq === "number" && Number.isFinite(chatData.msgSeq)
        ? Math.max(0, Math.floor(chatData.msgSeq))
        : 0;
    const nextSeq = prevSeq + 1;

    // 동시 전송이나 기기 시계 오차로 인한 타임스탬프 역행 방지 (단조 증가 보장)
    const prevTs =
      typeof chatData.lastMessageTimestamp === "number" && Number.isFinite(chatData.lastMessageTimestamp)
        ? chatData.lastMessageTimestamp
        : 0;
    const effectiveTimestamp = Math.max(nowMs, prevTs + 1);

    tx.set(msgRef, {
      id: msgRef.id,
      chatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      content: trimmed,
      createdAt: nowTime,
      timestamp: serverTimestamp(),
      isSystemMessage: false,
      seq: nextSeq,
    });

    tx.update(chatRef, {
      msgSeq: nextSeq,
      [`readSeq.${currentUser.id}`]: nextSeq,
      lastMessageText: trimmed,
      lastMessageAt: nowTime,
      lastMessageTimestamp: effectiveTimestamp,
      lastMessageIso: nowIso,
      lastSenderId: currentUser.id,
    });
  });
}

/**
 * 사용자가 채팅방을 열어 메시지를 확인했을 때 본인의 읽은 위치(readSeq[userId])만 단조 증가로 갱신합니다.
 * - 여러 메시지를 한꺼번에 읽어도 마지막 순번(targetSeq) 1번만 기록하여 Firestore 쓰기 비용을 아낍니다.
 * - 여러 기기에서 동시 접속해도 이미 더 큰 순번을 읽었다면 역행하지 않습니다.
 */
export async function markChatReadInFirestore(
  chatId: string,
  userId: string,
  targetSeq: number
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db || !chatId || !userId) return;
  const safeTarget =
    typeof targetSeq === "number" && Number.isFinite(targetSeq)
      ? Math.floor(targetSeq)
      : 0;
  if (safeTarget <= 0) return;

  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  await runTransaction(db, async (tx) => {
    const chatSnap = await tx.get(chatRef);
    if (!chatSnap.exists()) return;
    const data = chatSnap.data() as FirestoreChatRoom;
    if (!Array.isArray(data.participants) || !data.participants.includes(userId)) {
      return;
    }
    const roomMaxSeq =
      typeof data.msgSeq === "number" && Number.isFinite(data.msgSeq)
        ? Math.floor(data.msgSeq)
        : safeTarget;
    const clampedTarget = Math.min(safeTarget, Math.max(roomMaxSeq, safeTarget));
    const currentRead =
      typeof data.readSeq?.[userId] === "number" ? data.readSeq[userId] : 0;
    const currentJoin =
      typeof data.joinSeq?.[userId] === "number" ? data.joinSeq[userId] : 0;
    if (clampedTarget <= Math.max(currentRead, currentJoin)) {
      return; // 이미 같거나 더 최신 위치까지 읽었으므로 쓰기 생략
    }
    tx.update(chatRef, {
      [`readSeq.${userId}`]: clampedTarget,
    });
  });
}

/**
 * 기존 대화방에 새로운 사용자를 초대합니다.
 * - 새로 초대된 사용자는 초대 시점의 방 순번(msgSeq)을 joinSeq와 readSeq로 부여받아,
 *   초대되기 전에 오간 메시지의 읽음 계산에 잘못 포함되지 않습니다.
 */
export async function inviteUsersToChatInFirestore(
  chatId: string,
  currentUser: PlatformUser,
  newUsers: { id: string; name: string; role: UserRole; avatarInitials?: string; studentIdOrYear?: string }[]
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;

  const newUids = newUsers.map((u) => u.id);
  if (newUids.length === 0) return;

  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  await runTransaction(db, async (tx) => {
    const chatSnap = await tx.get(chatRef);
    if (!chatSnap.exists()) return;
    const chatData = chatSnap.data() as FirestoreChatRoom;
    const currentMsgSeq =
      typeof chatData.msgSeq === "number" && Number.isFinite(chatData.msgSeq)
        ? Math.max(0, Math.floor(chatData.msgSeq))
        : 0;

    const detailsUpdate: Record<string, any> = {
      participants: arrayUnion(...newUids),
    };
    newUsers.forEach((u) => {
      detailsUpdate[`participantDetails.${u.id}`] = {
        uid: u.id,
        name: u.name,
        role: u.role,
        avatarInitials:
          getAvatarInitials(u.name, u.role) || u.avatarInitials || "",
      };
      // 초대 시점 순번을 joinSeq 및 초기 readSeq에 기록 (초대 이전 메시지 안읽음 제외)
      if (typeof chatData.joinSeq?.[u.id] !== "number") {
        detailsUpdate[`joinSeq.${u.id}`] = currentMsgSeq;
      }
      if (typeof chatData.readSeq?.[u.id] !== "number" || chatData.readSeq[u.id] < currentMsgSeq) {
        detailsUpdate[`readSeq.${u.id}`] = currentMsgSeq;
      }
    });

    tx.update(chatRef, detailsUpdate);
  });

  const nowTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const names = newUsers.map((u) => u.name).join(", ");
  const sysMsgRef = doc(collection(db, CHATS_COLLECTION, chatId, "messages"));
  await setDoc(sysMsgRef, {
    id: sysMsgRef.id,
    chatId,
    senderId: currentUser.id,
    senderName: currentUser.name,
    senderRole: currentUser.role,
    content: `${currentUser.name}님이 ${names}님을 초대했습니다.`,
    createdAt: nowTime,
    timestamp: serverTimestamp(),
    isSystemMessage: true,
  });
}

/**
 * 사용자가 대화방을 나갑니다.
 */
export async function leaveChatInFirestore(
  chatId: string,
  currentUser: PlatformUser
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;

  const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
  const sysMsgRef = doc(collection(db, CHATS_COLLECTION, chatId, "messages"));
  const nowTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  try {
    const batch = writeBatch(db);
    // 1) 시스템 메시지 생성 (작성 시점에 아직 참여자 상태여야 Firestore 보안 규칙 통과)
    batch.set(sysMsgRef, {
      id: sysMsgRef.id,
      chatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      content: `${currentUser.name}님이 대화방을 나갔습니다.`,
      createdAt: nowTime,
      timestamp: serverTimestamp(),
      isSystemMessage: true,
    });
    // 2) 참여자 목록에서 본인 제거
    batch.update(chatDocRef, {
      participants: arrayRemove(currentUser.id),
    });
    await batch.commit();
  } catch (batchErr) {
    // 혹시 모를 배치 쓰기 예외 시에도 최소한 본인이 대화방에서 정상 퇴장되도록 폴백 처리
    console.warn("대화방 퇴장 시스템 메시지 기록 실패, 참여자 제거 단독 수행:", batchErr);
    await updateDoc(chatDocRef, {
      participants: arrayRemove(currentUser.id),
    });
  }
}

// ==========================================
// 5. 학교·교육학과·사범대학 공식 공지 Firestore 연동
// ==========================================

function stripUndefinedFields<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * 승인된 정회원용: Firestore notices 컬렉션 실시간 구독
 * - 공식 홈페이지 연동 공지(isOfficialSynced: true)와 관리자가 직접 작성한 공지(isOfficialSynced: false)를 모두 수신합니다.
 */
export function subscribeToNoticesInFirestore(
  onUpdate: (notices: Notice[]) => void,
  onError: (errMessage: string) => void
): (() => void) | null {
  const { db } = getFirestoreInstance();
  if (!db) return null;

  const colRef = collection(db, NOTICES_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const list: Notice[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as Notice;
        list.push({
          ...d,
          id: docSnap.id,
        });
      });
      onUpdate(list);
    },
    (err) => {
      onError(err.message);
    }
  );

  return unsubscribe;
}

/**
 * 관리자 전용: 단일 공지사항(관리자 직접 작성 또는 캘린더 일정 확정 수정)을 Firestore에 저장/업데이트합니다.
 */
export async function upsertNoticeInFirestore(notice: Notice): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");

  const noticeRef = doc(db, NOTICES_COLLECTION, notice.id);
  await setDoc(
    noticeRef,
    {
      ...stripUndefinedFields(notice),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * 관리자 전용: 자동 수집된 공식 홈페이지 공지 전체를 Firestore notices 컬렉션과 system/notice_sync_status 문서에 일괄 동기화합니다.
 */
export async function syncOfficialNoticesToFirestore(
  notices: Notice[],
  syncMeta: NoticeSyncMetadata
): Promise<number> {
  const { db } = getFirestoreInstance();
  if (!db) throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");

  const batch = writeBatch(db);
  const officialItems = notices.filter((n) => n.isOfficialSynced);

  officialItems.forEach((item) => {
    const ref = doc(db, NOTICES_COLLECTION, item.id);
    batch.set(
      ref,
      {
        ...stripUndefinedFields(item),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });

  const statusRef = doc(db, SYSTEM_COLLECTION, "notice_sync_status");
  batch.set(
    statusRef,
    {
      lastAttemptAt: syncMeta.lastAttemptAt,
      lastSuccessAt: syncMeta.lastSuccessAt,
      scheduleNote: syncMeta.scheduleNote,
      totalSyncedCount: officialItems.length,
      sources: syncMeta.sources.map((s) => stripUndefinedFields(s)),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await batch.commit();
  return officialItems.length;
}

// ==========================================
// 6. 졸업요건 공통 카탈로그 및 학생별 이수기록 Firestore 연동
// ==========================================

/**
 * 승인된 정회원용: 공통 졸업요건 카탈로그(graduationRulesCatalog/current) 실시간 구독
 */
export function subscribeToGraduationCatalogInFirestore(
  onUpdate: (catalog: OfficialGraduationCatalog | null) => void,
  onError: (errMessage: string) => void
): (() => void) | null {
  const { db } = getFirestoreInstance();
  if (!db) return null;

  const docRef = doc(db, GRADUATION_CATALOG_COLLECTION, "current");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as OfficialGraduationCatalog);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      onError(err.message);
    }
  );
}

/**
 * 관리자 전용: 공통 졸업요건 카탈로그(graduationRulesCatalog/current) 등록/수정
 */
export async function saveGraduationCatalogInFirestore(
  catalog: OfficialGraduationCatalog
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");

  const docRef = doc(db, GRADUATION_CATALOG_COLLECTION, "current");
  await setDoc(
    docRef,
    {
      ...JSON.parse(JSON.stringify(catalog)),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * 학생 본인(또는 관리자)용: 개인별 졸업요건·강좌·체크리스트 기록(graduationRecords/{uid}) 실시간 구독
 */
export function subscribeToStudentGraduationRecordInFirestore(
  uid: string,
  onUpdate: (record: Partial<StudentProgress> | null) => void,
  onError: (errMessage: string) => void
): (() => void) | null {
  const { db } = getFirestoreInstance();
  if (!db || !uid) return null;

  const docRef = doc(db, GRADUATION_RECORDS_COLLECTION, uid);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate({ userId: snap.id, ...(snap.data() as Partial<StudentProgress>) });
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      onError(err.message);
    }
  );
}

/**
 * 학생 본인용: 개인별 졸업요건·이수 강좌·체크리스트 기록(graduationRecords/{uid}) 저장
 * - 보안 원칙: 학생이 직접 저장할 때 officialAdminVerified 필드는 false로 고정하여 공식 인정 사칭을 방지합니다.
 */
export async function saveStudentGraduationRecordInFirestore(
  uid: string,
  progress: StudentProgress
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) {
    throw new Error("Firestore 데이터베이스에 연결되어 있지 않습니다.");
  }
  const cleanUid = (uid || "").trim();
  if (!cleanUid) {
    throw new Error("유효한 사용자 식별자(UID)가 없어 저장할 수 없습니다.");
  }

  const docRef = doc(db, GRADUATION_RECORDS_COLLECTION, cleanUid);
  const nowIso = new Date().toISOString();
  const safePayload = JSON.parse(
    JSON.stringify({
      ...progress,
      userId: cleanUid,
      officialAdminVerified: false,
      clientRevision:
        typeof progress.clientRevision === "number" && Number.isFinite(progress.clientRevision)
          ? Math.max(0, Math.floor(progress.clientRevision))
          : 0,
      updatedAt: progress.updatedAt || nowIso,
    })
  );

  await setDoc(docRef, safePayload, { merge: true });
}

/**
 * 학생 본인용: users/{uid} 프로필 내 학사정보(academicProfile, doubleMajor, studentIdOrYear) 동기화
 * - 승인 상태(approvalStatus), 역할(role) 등 보호 필드는 절대 건드리지 않습니다.
 */
export async function updateUserAcademicProfileInFirestore(
  uid: string,
  academicProfile: StudentAcademicProfile
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db || !uid) return;

  const userRef = doc(db, USERS_COLLECTION, uid);
  const safeProfile: StudentAcademicProfile = {
    ...academicProfile,
    adminVerifiedSpecialCondition: false,
    updatedAt: new Date().toISOString().slice(0, 10),
  };

  await updateDoc(userRef, {
    academicProfile: JSON.parse(JSON.stringify(safeProfile)),
    doubleMajor: safeProfile.hasDoubleMajor
      ? safeProfile.doubleMajorDepartment || "복수전공"
      : "단일전공(교육학)",
    studentIdOrYear: safeProfile.admissionYearLabel,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * 관리자 전용: 학생별 지도교수 지정 또는 변경
 * - 관리자 권한으로 Firestore users/{studentUid} 문서의 advisorProfessorId를 업데이트합니다.
 * - advisorProfessorId가 null이거나 빈 문자열이면 지도교수 배정을 해제합니다.
 */
export async function assignStudentAdvisorInFirestore(params: {
  studentUid: string;
  advisorProfessorId: string | null;
}): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db) {
    throw new Error("Firestore 데이터베이스가 연결되어 있지 않습니다.");
  }

  const studentRef = doc(db, USERS_COLLECTION, params.studentUid);
  const nowIso = new Date().toISOString();

  // 지도교수 배정 시 대상 계정이 재학생(student)인지 검증 (졸업생, 교수진, 관리자 배정 원천 방지)
  if (params.advisorProfessorId) {
    try {
      const snap = await getDoc(studentRef);
      if (snap.exists()) {
        const udata = snap.data();
        if (udata.role && udata.role !== "student") {
          throw new Error("재학생만 지도교수를 배정받을 수 있습니다. (졸업생, 교수진, 관리자는 지도학생이 될 수 없습니다)");
        }
      }
    } catch (checkErr: any) {
      if (checkErr?.message?.includes("재학생만 지도교수")) {
        throw checkErr;
      }
      console.warn("지도학생 대상 권한 검증 경고:", checkErr);
    }
  }

  await updateDoc(studentRef, {
    advisorProfessorId: params.advisorProfessorId || "",
    advisorAssignedAt: params.advisorProfessorId ? nowIso : "",
    updatedAt: nowIso,
  });
}

// ==========================================
// 8. 교수 상담 신청 시스템 (Consultations)
// ==========================================

/**
 * 학생: 교수 상담 신청서 작성 및 Firestore 저장
 * - 초기 상태는 'pending(신청 대기)'으로 등록됩니다.
 */
export async function createConsultationInFirestore(payload: {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentIdOrYear?: string;
  professorId: string;
  professorName: string;
  consultationType: ConsultationType;
  preferredDate: string;
  preferredTime: string;
  purpose: string;
}): Promise<ConsultationRequest> {
  const { db } = getFirebaseInstances();
  if (!db) {
    throw new Error("Firestore 데이터베이스가 연결되어 있지 않습니다.");
  }

  const colRef = collection(db, CONSULTATIONS_COLLECTION);
  const nowIso = new Date().toISOString();
  const newDocRef = doc(colRef);

  const docData: ConsultationRequest = {
    id: newDocRef.id,
    studentId: payload.studentId,
    studentName: payload.studentName,
    studentEmail: payload.studentEmail || "",
    studentIdOrYear: payload.studentIdOrYear || "",
    professorId: payload.professorId,
    professorName: payload.professorName,
    consultationType: payload.consultationType,
    preferredDate: payload.preferredDate,
    preferredTime: payload.preferredTime,
    purpose: payload.purpose,
    status: "pending",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(newDocRef, docData);
  return docData;
}

/**
 * 사용자별 상담 신청 목록 실시간 구독
 * - 학생: 자신이 신청한 상담 목록
 * - 교수: 자신에게 접수된 상담 목록
 * - 관리자: 전체 상담 목록
 */
export function subscribeToConsultationsInFirestore(
  userId: string,
  userRole: UserRole,
  onUpdate: (consultations: ConsultationRequest[]) => void,
  onError: (err: string) => void
): (() => void) | null {
  const { db } = getFirebaseInstances();
  if (!db || !userId) return null;

  try {
    const colRef = collection(db, CONSULTATIONS_COLLECTION);
    let q;
    if (userRole === "admin") {
      q = query(colRef);
    } else if (userRole === "professor") {
      q = query(colRef, where("professorId", "==", userId));
    } else {
      q = query(colRef, where("studentId", "==", userId));
    }

    return onSnapshot(
      q,
      (snap) => {
        const list: ConsultationRequest[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        onUpdate(list);
      },
      (err) => {
        onError(`상담 목록 조회 오류: ${err.message}`);
      }
    );
  } catch (err: any) {
    onError(`상담 구독 생성 실패: ${err?.message || err}`);
    return null;
  }
}

/**
 * 교수의 상담 상태 갱신 (수락, 일정 조정 요청, 거절, 완료, 취소)
 */
export async function updateConsultationStatusInFirestore(params: {
  consultationId: string;
  status: ConsultationStatus;
  rescheduleNote?: string;
  conversationId?: string;
  consultationMethod?: "대면" | "채팅";
  professorId?: string;
  cancelReason?: string;
  cancelledBy?: "student" | "professor";
  cancelledByUid?: string;
  cancelledAt?: string;
}): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db) {
    throw new Error("Firestore 데이터베이스가 연결되어 있지 않습니다.");
  }

  const docRef = doc(db, CONSULTATIONS_COLLECTION, params.consultationId);
  const nowIso = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status: params.status,
    updatedAt: nowIso,
  };
  if (params.rescheduleNote !== undefined) {
    updateData.rescheduleNote = params.rescheduleNote;
  }
  if (params.conversationId !== undefined) {
    updateData.conversationId = params.conversationId;
  }
  if (params.consultationMethod !== undefined) {
    updateData.consultationMethod = params.consultationMethod;
  }
  if (params.professorId !== undefined) {
    updateData.professorId = params.professorId;
  }
  if (params.cancelReason !== undefined) {
    updateData.cancelReason = params.cancelReason;
  }
  if (params.cancelledBy !== undefined) {
    updateData.cancelledBy = params.cancelledBy;
  }
  if (params.cancelledByUid !== undefined) {
    updateData.cancelledByUid = params.cancelledByUid;
  }
  if (params.cancelledAt !== undefined) {
    updateData.cancelledAt = params.cancelledAt;
  }

  await updateDoc(docRef, updateData);
}

/**
 * 상담 신청 취소 (사유, 취소 주체 및 시각 보존)
 */
export async function cancelConsultationInFirestore(
  params:
    | {
        consultationId: string;
        cancelReason?: string;
        cancelledBy?: "student" | "professor";
        cancelledByUid?: string;
      }
    | string
): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db) {
    throw new Error("Firestore 데이터베이스가 연결되어 있지 않습니다.");
  }

  const consultationId = typeof params === "string" ? params : params.consultationId;
  const cancelReason = typeof params === "string" ? "" : params.cancelReason || "";
  const cancelledBy = typeof params === "string" ? undefined : params.cancelledBy;
  const cancelledByUid = typeof params === "string" ? undefined : params.cancelledByUid;

  const docRef = doc(db, CONSULTATIONS_COLLECTION, consultationId);
  const nowIso = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status: "cancelled",
    updatedAt: nowIso,
    cancelledAt: nowIso,
  };
  if (cancelReason) {
    updateData.cancelReason = cancelReason;
  }
  if (cancelledBy) {
    updateData.cancelledBy = cancelledBy;
  }
  if (cancelledByUid) {
    updateData.cancelledByUid = cancelledByUid;
  }

  await updateDoc(docRef, updateData);
}

/**
 * 교수의 확정 상담 일정 변경 (변경 이력 기록 및 날짜·시간 갱신)
 */
export async function rescheduleConsultationInFirestore(params: {
  consultationId: string;
  newDate: string;
  newTime: string;
  previousDate: string;
  previousTime: string;
  reason?: string;
  professorId?: string;
  existingHistory?: RescheduleHistoryItem[];
}): Promise<RescheduleHistoryItem> {
  const { db } = getFirebaseInstances();
  if (!db) {
    throw new Error("Firestore 데이터베이스가 연결되어 있지 않습니다.");
  }

  const docRef = doc(db, CONSULTATIONS_COLLECTION, params.consultationId);
  const nowIso = new Date().toISOString();

  const historyItem: RescheduleHistoryItem = {
    previousDate: params.previousDate,
    previousTime: params.previousTime,
    newDate: params.newDate,
    newTime: params.newTime,
    changedAt: nowIso,
    reason: params.reason || "",
  };

  const nextHistory = [...(params.existingHistory || []), historyItem];

  const updateData: Record<string, unknown> = {
    preferredDate: params.newDate,
    preferredTime: params.newTime,
    updatedAt: nowIso,
    rescheduledAt: nowIso,
    rescheduleHistory: nextHistory,
  };

  if (params.professorId) {
    updateData.professorId = params.professorId;
  }

  await updateDoc(docRef, updateData);
  return historyItem;
}

/**
 * ==============================================================
 * 캘린더 개인 일정 Firestore 실시간 동기화 시스템
 * ==============================================================
 */

/**
 * 사용자별 개인 캘린더 일정 실시간 구독 (Firestore onSnapshot)
 * 스마트폰, PC 등 어떤 기기에서든 동일한 계정으로 로그인하면 실시간 양방향 동기화
 */
export function subscribeToUserCalendarEvents(
  userId: string,
  onUpdate: (events: CalendarEvent[]) => void,
  onError?: (err: any) => void
): () => void {
  const { db } = getFirebaseInstances();
  if (!db || !userId) return () => {};

  const colRef = collection(db, "users", userId, "calendarEvents");
  return onSnapshot(
    colRef,
    (snapshot) => {
      const events: CalendarEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        events.push({
          id: docSnap.id,
          userId,
          title: data.title || "",
          date: data.date || "",
          endDate: data.endDate || undefined,
          time: data.time || undefined,
          isAllDay: data.isAllDay !== false,
          category: (data.category as EventCategory) || "assignment",
          location: data.location || undefined,
          memo: data.memo || undefined,
          isOfficial: data.isOfficial || false,
          createdAt: data.createdAt || undefined,
          updatedAt: data.updatedAt || undefined,
        });
      });
      // 날짜순, 시간순 정렬 (종일 일정 우선)
      events.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return (a.time || "").localeCompare(b.time || "");
      });
      onUpdate(events);
    },
    (err) => {
      console.warn("캘린더 일정 실시간 구독 경고:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * 캘린더 일정을 파이어베이스에 추가 또는 수정 (setDoc)
 */
export async function saveUserCalendarEventToFirestore(
  userId: string,
  event: CalendarEvent
): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !userId) return;

  const eventDocRef = doc(db, "users", userId, "calendarEvents", event.id);
  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    id: event.id,
    userId,
    title: event.title.trim(),
    date: event.date,
    category: event.category,
    isAllDay: event.isAllDay !== false,
    updatedAt: nowIso,
  };
  if (event.endDate) payload.endDate = event.endDate;
  if (event.time) payload.time = event.time;
  if (event.location) payload.location = event.location.trim();
  if (event.memo) payload.memo = event.memo.trim();
  if (event.isOfficial !== undefined) payload.isOfficial = event.isOfficial;
  if (!event.createdAt) payload.createdAt = nowIso;

  await setDoc(eventDocRef, payload, { merge: true });
}

/**
 * 캘린더 일정을 파이어베이스에서 삭제 (deleteDoc)
 */
export async function deleteUserCalendarEventFromFirestore(
  userId: string,
  eventId: string
): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !userId || !eventId) return;

  const eventDocRef = doc(db, "users", userId, "calendarEvents", eventId);
  await deleteDoc(eventDocRef);
}

export const ALUMNI_PROFILES_COLLECTION = "alumniProfiles";

/**
 * Firestore 동문(졸업생) 프로필 실시간 구독
 */
export function subscribeToAlumniProfilesInFirestore(
  onUpdate: (profiles: AlumniProfile[]) => void,
  onError?: (errMessage: string) => void
): (() => void) | null {
  const { db } = getFirestoreInstance();
  if (!db) return null;

  const colRef = collection(db, ALUMNI_PROFILES_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const list: AlumniProfile[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: d.userId || docSnap.id,
          displayName: d.displayName || "",
          graduationYear: Number(d.graduationYear) || 2023,
          admissionYear: Number(d.admissionYear) || 2018,
          doubleMajor: d.doubleMajor || "",
          careerTrack: d.careerTrack || "기타",
          currentRoleTitle: d.currentRoleTitle || "",
          organization: d.organization || "",
          bio: d.bio || "",
          experienceSummary: d.experienceSummary || "",
          mentoringAvailable: d.mentoringAvailable !== false,
          interests: Array.isArray(d.interests) ? d.interests : [],
          privacy: {
            showProfileInDirectory: d.privacy?.showProfileInDirectory !== false,
            showOrganization: d.privacy?.showOrganization !== false,
            showEmail: !!d.privacy?.showEmail,
            allowDirectChat: d.privacy?.allowDirectChat !== false,
          },
        });
      });
      onUpdate(list);
    },
    (err) => {
      console.warn("동문 프로필 실시간 구독 오류:", err);
      if (onError) onError(err.message);
    }
  );

  return unsubscribe;
}

/**
 * 졸업생 본인의 진로 프로필 및 공개 설정을 Firestore에 저장/동기화합니다.
 */
export async function saveAlumniProfileInFirestore(
  profile: AlumniProfile
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;

  const docId = profile.id || profile.userId;
  const profileRef = doc(db, ALUMNI_PROFILES_COLLECTION, docId);
  const nowIso = new Date().toISOString();

  const payload: Record<string, any> = {
    id: docId,
    userId: profile.userId,
    displayName: (profile.displayName || "").trim(),
    graduationYear: Number(profile.graduationYear) || 2023,
    admissionYear: Number(profile.admissionYear) || 2018,
    doubleMajor: (profile.doubleMajor || "").trim(),
    careerTrack: profile.careerTrack,
    currentRoleTitle: (profile.currentRoleTitle || "").trim(),
    organization: (profile.organization || "").trim(),
    bio: (profile.bio || "").trim(),
    experienceSummary: (profile.experienceSummary || "").trim(),
    mentoringAvailable: profile.mentoringAvailable !== false,
    interests: profile.interests || [],
    privacy: {
      showProfileInDirectory: profile.privacy?.showProfileInDirectory !== false,
      showOrganization: profile.privacy?.showOrganization !== false,
      showEmail: !!profile.privacy?.showEmail,
      allowDirectChat: profile.privacy?.allowDirectChat !== false,
    },
    updatedAt: nowIso,
  };

  await setDoc(profileRef, payload, { merge: true });

  // 사용자의 users 문서 및 publicProfiles 문서에도 최신 프로필 정보 반영
  try {
    if (profile.userId) {
      const userDocRef = doc(db, "users", profile.userId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        await updateDoc(userDocRef, {
          bio: (profile.bio || "").trim(),
          doubleMajor: (profile.doubleMajor || "").trim(),
          careerTrack: profile.careerTrack,
        });
      }

      const publicDocRef = doc(db, "publicProfiles", profile.userId);
      const publicSnap = await getDoc(publicDocRef);
      if (publicSnap.exists()) {
        await updateDoc(publicDocRef, {
          bio: (profile.bio || "").trim(),
          doubleMajor: (profile.doubleMajor || "").trim(),
          careerTrack: profile.careerTrack,
        });
      }
    }
  } catch (syncErr) {
    console.warn("동문 프로필 기본 유저 정보 동기화 경고:", syncErr);
  }
}

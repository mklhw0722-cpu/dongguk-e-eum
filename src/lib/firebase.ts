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
} from "firebase/firestore";
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  User as PlatformUser,
  UserRole,
  ApprovalStatus,
  CommunityPost,
  CommunityComment,
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

const CONFIG_STORAGE_KEY = "dongguk_e_eum_firebase_config_v1";
const POSTS_COLLECTION = "communityPosts";
const USERS_COLLECTION = "users";
const SYSTEM_COLLECTION = "system";

/**
 * 환경변수 또는 브라우저에 저장된 Firebase 설정을 반환합니다.
 */
export function getActiveFirebaseConfig(): FirebaseWebConfig | null {
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
      return null;
    }
  }

  return null;
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
  verificationNote?: string;
  adminComment?: string;
  updatedAt?: string;
}

/**
 * 이메일·비밀번호 기반 회원가입
 * - Firebase Auth 계정 생성
 * - Firestore users/{uid} 문서에 기본 pending 상태로 저장
 * - 보안 원칙: 클라이언트가 임의로 approved나 admin 권한을 가질 수 없도록 무조건 pending 강제
 */
export async function registerWithEmailAndPassword(params: {
  email: string;
  password: string;
  name: string;
  studentIdOrYear: string;
  role: UserRole;
  verificationNote?: string;
}): Promise<PlatformUser> {
  const { auth, db } = getFirebaseInstances();
  if (!auth || !db) {
    throw new Error("Firebase가 초기화되지 않았습니다. 상단에서 설정을 확인해 주세요.");
  }

  // 1. Firebase Auth 유저 생성
  const credential = await createUserWithEmailAndPassword(auth, params.email, params.password);
  const uid = credential.user.uid;

  // 2. 초기 프로필 구성 (일반 가입은 무조건 pending)
  const initialProfile: UserProfileDoc = {
    id: uid,
    name: params.name.trim(),
    email: params.email.trim(),
    role: params.role === "admin" ? "student" : params.role, // 가입 시 임의 admin 방지
    studentIdOrYear: params.studentIdOrYear.trim(),
    bio: `${params.studentIdOrYear.trim()} ${params.name.trim()}님의 프로필입니다.`,
    avatarInitials: params.name.trim().slice(0, 2),
    approvalStatus: "pending",
    joinedAt: new Date().toISOString().slice(0, 10),
    verificationNote: params.verificationNote || "소속 확인 신청",
  };

  // 3. Firestore users/{uid} 문서 기록
  await setDoc(doc(db, USERS_COLLECTION, uid), initialProfile);

  return initialProfile;
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
 * 비밀번호 재설정 이메일 전송
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { auth } = getFirebaseInstances();
  if (!auth) {
    throw new Error("Firebase 인증 모듈이 연결되지 않았습니다.");
  }
  await sendPasswordResetEmail(auth, email);
}

/**
 * 로그인 상태 및 내 Firestore 프로필 실시간 감지
 * - 관리자가 승인(approved)하면 실시간으로 내 화면에 즉시 반영됨
 */
export function subscribeToAuthStatus(
  onProfileUpdate: (profile: UserProfileDoc | null, rawUser: FirebaseUser | null) => void,
  onError: (err: string) => void
): (() => void) | null {
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

      if (!user) {
        onProfileUpdate(null, null);
        return;
      }

      const userDocRef = doc(db, USERS_COLLECTION, user.uid);
      docUnsub = onSnapshot(
        userDocRef,
        (snap) => {
          if (snap.exists()) {
            onProfileUpdate(snap.data() as UserProfileDoc, user);
          } else {
            // Auth 계정은 있으나 아직 Firestore 프로필 생성이 지연 중인 경우
            onProfileUpdate(null, user);
          }
        },
        (error) => {
          onError(`프로필 정보 조회 오류: ${error.message}`);
        }
      );
    },
    (error) => {
      onError(`인증 상태 감지 오류: ${error.message}`);
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
      name: currentUser.displayName || currentUser.email?.split("@")[0] || "시스템 관리자",
      studentIdOrYear: "최고 관리자",
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
        list.push({ ...snap.data() } as UserProfileDoc);
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
}): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db) throw new Error("Firestore가 연결되어 있지 않습니다.");

  const userRef = doc(db, USERS_COLLECTION, params.targetUid);
  const updateData: Record<string, unknown> = {
    approvalStatus: params.status,
    adminComment: params.adminComment || "",
    updatedAt: new Date().toISOString(),
  };

  if (params.role) {
    updateData.role = params.role;
  }

  await updateDoc(userRef, updateData);
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
        loadedPosts.push({
          ...data,
          id: docSnap.id,
          comments: Array.isArray(data.comments) ? data.comments : [],
          likes: typeof data.likes === "number" ? data.likes : 0,
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

export async function incrementLikeInFirestore(
  postId: string,
  newLikesCount: number
): Promise<void> {
  const { db } = getFirestoreInstance();
  if (!db) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await updateDoc(postRef, { likes: newLikesCount });
}

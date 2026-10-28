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
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { compareBySeq } from "@/lib/chatReadReceipts";
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import {
  User as PlatformUser,
  UserRole,
  ApprovalStatus,
  CommunityPost,
  CommunityComment,
  Notice,
  NoticeSyncMetadata,
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
const CHATS_COLLECTION = "chats";
const NOTICES_COLLECTION = "notices";

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
              u.avatarInitials || (u.name ? u.name.slice(0, 2) : "학"),
            approvalStatus: "approved",
            careerTrack: u.careerTrack || "",
            doubleMajor: u.doubleMajor || "",
            bio: u.bio || "",
            updatedAt: new Date().toISOString(),
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

  const avatarInitials = trimmed.slice(0, 2);
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
            u.avatarInitials || (u.name ? u.name.slice(0, 2) : "학"),
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
                d.avatarInitials || (d.name ? d.name.slice(0, 2) : "학"),
              approvalStatus: "approved",
              careerTrack: d.careerTrack || "",
              doubleMajor: d.doubleMajor || "",
              bio: d.bio || "",
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
              d.avatarInitials || (d.name ? d.name.slice(0, 2) : "학"),
            approvalStatus: "approved",
            careerTrack: d.careerTrack || "",
            doubleMajor: d.doubleMajor || "",
            bio: d.bio || "",
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
            (data.name ? data.name.slice(0, 2) : "학"),
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
              (data.name ? data.name.slice(0, 2) : "학"),
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

      list.sort((a, b) => {
        const timeA = a.lastMessageAt || a.createdAt || "";
        const timeB = b.lastMessageAt || b.createdAt || "";
        return timeB.localeCompare(timeA);
      });

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

  const snap = await getDoc(chatDocRef);
  if (snap.exists()) {
    return chatId;
  }

  const nowTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nowDate = new Date().toISOString().slice(0, 10);

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
          (currentUser.name ? currentUser.name.slice(0, 2) : "학"),
      },
      [targetUser.id]: {
        uid: targetUser.id,
        name: targetUser.name || "상대방",
        role: targetUser.role || "student",
        avatarInitials:
          targetUser.avatarInitials ||
          (targetUser.name ? targetUser.name.slice(0, 2) : "학"),
      },
    },
    lastMessageText: "대화가 시작되었습니다. 첫 인사를 건네보세요!",
    lastMessageAt: nowTime,
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

  // 초기 시스템 안내 메시지 생성
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
        (currentUser.name ? currentUser.name.slice(0, 2) : "학"),
    },
    ...invitedUsers.map((u) => ({
      uid: u.id,
      name: u.name,
      role: u.role,
      avatarInitials:
        u.avatarInitials || (u.name ? u.name.slice(0, 2) : "학"),
    })),
  ];

  const participants = Array.from(new Set(allUsers.map((u) => u.uid)));
  const participantDetails: Record<string, FirestoreChatParticipantInfo> = {};
  allUsers.forEach((u) => {
    participantDetails[u.uid] = u;
  });

  const nowTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nowDate = new Date().toISOString().slice(0, 10);

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
    lastSenderId: currentUser.id,
    createdBy: currentUser.id,
    createdAt: nowDate,
    msgSeq: 0,
    readSeq: { ...initialCursorMap },
    joinSeq: { ...initialCursorMap },
  };

  await setDoc(chatDocRef, newChat);

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

  const nowTime = new Date().toLocaleTimeString("ko-KR", {
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
          u.avatarInitials || (u.name ? u.name.slice(0, 2) : "학"),
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

  await updateDoc(doc(db, CHATS_COLLECTION, chatId), {
    participants: arrayRemove(currentUser.id),
  });

  const nowTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sysMsgRef = doc(collection(db, CHATS_COLLECTION, chatId, "messages"));
  await setDoc(sysMsgRef, {
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

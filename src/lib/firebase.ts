import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { CommunityPost, CommunityComment } from "@/types";
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

/**
 * 환경변수(.env.local) 또는 브라우저 설정창에 입력된 Firebase 설정값을 불러옵니다.
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

/**
 * 사용자가 Firebase 콘솔에서 복사한 코드 덩어리(const firebaseConfig = { ... })에서
 * apiKey, projectId 등을 자동으로 추출해 주는 도우미 함수입니다.
 */
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
let cachedProjectId: string | null = null;

export function getFirestoreInstance(): {
  db: Firestore | null;
  config: FirebaseWebConfig | null;
} {
  const config = getActiveFirebaseConfig();
  if (!config) {
    return { db: null, config: null };
  }

  try {
    if (cachedDb && cachedProjectId === config.projectId) {
      return { db: cachedDb, config };
    }

    const appName = `dongguk-e-eum-${config.projectId}`;
    const existingApp = getApps().find((a) => a.name === appName);
    cachedApp = existingApp ? getApp(appName) : initializeApp(config, appName);
    cachedDb = getFirestore(cachedApp);
    cachedProjectId = config.projectId;
    return { db: cachedDb, config };
  } catch {
    return { db: null, config: null };
  }
}

/**
 * Firestore의 communityPosts 컬렉션을 실시간(onSnapshot)으로 구독합니다.
 * 처음 연결했을 때 컬렉션이 비어 있으면 기본 예시 게시글 5건을 자동으로 넣어줍니다.
 */
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

      // 최신 작성일 및 ID 역순 정렬
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

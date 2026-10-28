"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { parseFirebaseConfigText } from "@/lib/firebase";
import {
  Database,
  CheckCircle2,
  Copy,
  X,
  ShieldCheck,
  Share2,
  AlertCircle,
  Trash2,
} from "lucide-react";

export const FIRESTORE_RULES_TEXT = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isApprovedUser() {
      return isAuthenticated()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approvalStatus == 'approved';
    }

    function isApprovedAdmin() {
      return isAuthenticated()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approvalStatus == 'approved'
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // 1. 회원 프로필 및 가입 신청
    match /users/{userId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == userId
        || isApprovedAdmin()
        || (isApprovedUser() && resource.data.approvalStatus == 'approved')
      );
      allow create: if isAuthenticated()
                    && request.auth.uid == userId
                    && (
                      (
                        request.resource.data.approvalStatus == 'pending'
                        && request.resource.data.role in ['student', 'alumni', 'professor']
                      )
                      || (
                        !exists(/databases/$(database)/documents/system/admin_bootstrap)
                        || (
                          exists(/databases/$(database)/documents/system/admin_bootstrap)
                          && get(/databases/$(database)/documents/system/admin_bootstrap).data.adminUid == request.auth.uid
                        )
                      )
                    );
      allow update: if isAuthenticated() && (
        isApprovedAdmin()
        || (
          request.auth.uid == userId
          && (
            !exists(/databases/$(database)/documents/system/admin_bootstrap)
            || (
              exists(/databases/$(database)/documents/system/admin_bootstrap)
              && get(/databases/$(database)/documents/system/admin_bootstrap).data.adminUid == request.auth.uid
            )
          )
        )
        || (
          request.auth.uid == userId
          && !request.resource.data.diff(resource.data).affectedKeys()
                .hasAny(['approvalStatus', 'role', 'uid', 'id', 'email', 'adminComment'])
        )
      );
      allow delete: if isAuthenticated() && (request.auth.uid == userId || isApprovedAdmin());
    }

    // 1-1. 채팅용 공개 프로필 (개인정보 최소화)
    match /publicProfiles/{userId} {
      allow read: if isApprovedUser() || isApprovedAdmin();
      allow write: if isApprovedAdmin()
                   || (isApprovedUser() && request.auth.uid == userId);
    }

    // 2. 최초 관리자 안전 생성
    match /system/admin_bootstrap {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && !exists(/databases/$(database)/documents/system/admin_bootstrap);
      allow update: if isAuthenticated() && resource.data.adminUid == request.auth.uid;
      allow delete: if false;
    }

    // 3. 학우들이 쓴 글 (승인된 정회원만 조회/작성 가능)
    match /communityPosts/{postId} {
      allow read: if isApprovedUser();
      allow create: if isApprovedUser()
                    && request.resource.data.authorId == request.auth.uid
                    && request.resource.data.title is string
                    && request.resource.data.title.size() >= 1
                    && request.resource.data.title.size() <= 120
                    && request.resource.data.content is string
                    && request.resource.data.content.size() >= 1
                    && request.resource.data.content.size() <= 5000;
      allow update: if isApprovedUser()
                    && request.resource.data.title == resource.data.title
                    && request.resource.data.content == resource.data.content
                    && request.resource.data.authorId == resource.data.authorId;
      allow delete: if isApprovedUser() && (
        resource.data.authorId == request.auth.uid
        || isApprovedAdmin()
      );
    }

    // 4. 대화창 (chats 컬렉션 - 참여자 전용 보호)
    match /chats/{chatId} {
      allow read: if isApprovedUser() && (
        request.auth.uid in resource.data.participants
        || isApprovedAdmin()
      );
      allow create: if isApprovedUser() && request.auth.uid in request.resource.data.participants;
      allow update: if isApprovedUser() && (
        request.auth.uid in resource.data.participants
        || isApprovedAdmin()
      );

      match /messages/{messageId} {
        allow read: if isApprovedUser() && (
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants
          || isApprovedAdmin()
        );
        allow create: if isApprovedUser()
                      && request.resource.data.senderId == request.auth.uid
                      && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow update, delete: if isApprovedUser() && (
          resource.data.senderId == request.auth.uid
          || isApprovedAdmin()
        );
      }
    }

    // 5. 개인별 졸업요건 기록 (graduationRecords 컬렉션 - 개인정보 보호)
    match /graduationRecords/{userId} {
      allow read, write: if isApprovedUser() && (
        request.auth.uid == userId
        || isApprovedAdmin()
      );
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

export function FirebaseSetupModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    isFirestoreConnected,
    firebaseProjectId,
    firestoreError,
    applyFirebaseConfig,
    disconnectFirebaseConfig,
  } = useApp();

  const [rawSnippet, setRawSnippet] = useState("");
  const [manualApiKey, setManualApiKey] = useState("");
  const [manualProjectId, setManualProjectId] = useState(
    firebaseProjectId || ""
  );
  const [copiedRules, setCopiedRules] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [parseFeedback, setParseFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSnippetChange = (text: string) => {
    setRawSnippet(text);
    const parsed = parseFirebaseConfigText(text);
    if (parsed) {
      setManualApiKey(parsed.apiKey);
      setManualProjectId(parsed.projectId);
      setParseFeedback(
        `자동 추출 성공! 프로젝트 ID: ${parsed.projectId}`
      );
    } else {
      setParseFeedback(null);
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFirebaseConfigText(rawSnippet);
    if (parsed) {
      applyFirebaseConfig(parsed);
      onClose();
      return;
    }
    if (manualApiKey.trim() && manualProjectId.trim()) {
      applyFirebaseConfig({
        apiKey: manualApiKey.trim(),
        projectId: manualProjectId.trim(),
        authDomain: `${manualProjectId.trim()}.firebaseapp.com`,
      });
      onClose();
    }
  };

  const handleCopyRules = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_TEXT);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    const savedRaw = window.localStorage.getItem(
      "dongguk_e_eum_firebase_config_v1"
    );
    let apiKey = manualApiKey.trim();
    let projectId = firebaseProjectId || manualProjectId.trim();
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        apiKey = parsed.apiKey || apiKey;
        projectId = parsed.projectId || projectId;
      } catch {
        // ignore
      }
    }
    if (!apiKey || !projectId) return;

    const url = new URL(window.location.href);
    url.searchParams.set("fbProjectId", projectId);
    url.searchParams.set("fbApiKey", apiKey);
    navigator.clipboard.writeText(url.toString());
    setCopiedShareUrl(true);
    setTimeout(() => setCopiedShareUrl(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl text-slate-900 dark:text-slate-100">
        {/* 상단 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">
                Firebase Firestore 실시간 공유 연결 설정 (무료 Spark 요금제)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                결제 수단 등록 없이 [학우들이 쓴 글]을 모든 컴퓨터와 스마트폰에서 실시간으로 함께 볼 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 현재 연결 상태 배너 */}
        {isFirestoreConnected ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                현재 Firebase Firestore와 실시간 연결되어 있습니다! (프로젝트:{" "}
                <code>{firebaseProjectId}</code>)
              </span>
              <button
                type="button"
                onClick={disconnectFirebaseConfig}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 text-rose-600 font-semibold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> 연결 해제
              </button>
            </div>
            <p className="text-emerald-800 dark:text-emerald-300">
              이제 [진로·복전 공유방]에서 글을 쓰거나 댓글·공감을 누르면 다른 컴퓨터에서도 똑같이 보입니다.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                {copiedShareUrl
                  ? "✔ 다른 컴퓨터 확인용 자동 연결 링크가 복사되었습니다!"
                  : "다른 컴퓨터/팀원 폰 확인용 자동 연결 링크 복사하기"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
            현재는 <strong>로컬 데모 모드</strong>입니다. 아래에 Firebase 웹 앱 설정(`firebaseConfig`)을 붙여넣으면 즉시 클라우드 실시간 모드로 전환됩니다.
          </div>
        )}

        {firestoreError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{firestoreError}</span>
          </div>
        )}

        {/* Step 1: Firebase 설정 붙여넣기 폼 */}
        <form onSubmit={handleConnect} className="space-y-3 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <label className="block font-extrabold">
              1단계. Firebase 콘솔에서 복사한 <code>firebaseConfig</code> 코드 통째로 붙여넣기
            </label>
            <textarea
              rows={4}
              value={rawSnippet}
              onChange={(e) => handleSnippetChange(e.target.value)}
              placeholder={`예시) Firebase 콘솔에서 복사한 코드를 그대로 붙여넣으세요:\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "dongguk-e-eum"\n};`}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"
            />
            {parseFeedback && (
              <p className="text-xs font-bold text-emerald-600">
                ✔ {parseFeedback}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-xs">
                API Key (<code>apiKey</code>)
              </label>
              <input
                type="text"
                required
                value={manualApiKey}
                onChange={(e) => setManualApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-xs">
                프로젝트 ID (<code>projectId</code>)
              </label>
              <input
                type="text"
                required
                value={manualProjectId}
                onChange={(e) => setManualProjectId(e.target.value)}
                placeholder="예: dongguk-e-eum-12345"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm"
            >
              Firestore 연결 저장 및 실시간 동기화 시작
            </button>
          </div>
        </form>

        {/* Step 2: 보안 규칙 복사 박스 */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              <h3 className="text-xs sm:text-sm font-extrabold">
                2단계. Firestore 보안 규칙 (누가 읽고·쓰고·지울 수 있는지 정의)
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCopyRules}
              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedRules ? "규칙 복사 완료!" : "보안 규칙 복사하기"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Firebase 콘솔의 <strong>[Firestore Database] → [규칙(Rules)]</strong> 탭에 아래 내용을 붙여넣고 <strong>[게시(Publish)]</strong>를 누르세요. 프로젝트 폴더의 <code>firestore.rules</code> 파일에도 동일하게 저장되어 있습니다.
          </p>
          <pre className="p-3.5 rounded-2xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-44">
            {FIRESTORE_RULES_TEXT}
          </pre>
        </div>
      </div>
    </div>
  );
}

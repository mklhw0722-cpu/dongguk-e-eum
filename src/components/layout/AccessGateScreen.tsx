"use client";

import React from "react";
import { AccessGateState } from "@/lib/accessGate";
import {
  Clock,
  ShieldAlert,
  XCircle,
  FileWarning,
  Ban,
  AlertTriangle,
  RefreshCw,
  LogOut,
} from "lucide-react";

interface AccessGateScreenProps {
  state: AccessGateState;
  name: string;
  email: string;
  roleLabel: string;
  studentIdOrYear?: string;
  adminComment?: string;
  errorMessage?: string | null;
  onLogout: () => void;
}

/**
 * 로그인은 했지만 내부 서비스를 이용할 수 없는 사용자에게 보여주는 상태별 안내 화면
 * (승인 대기 · 보완 요청 · 거절 · 정지 · 회원 문서 누락 · 조회 오류 · 알 수 없는 상태)
 *
 * 로그인·회원가입 화면으로 보내지 않고, 로그아웃만 할 수 있게 합니다.
 */
export function AccessGateScreen({
  state,
  name,
  email,
  roleLabel,
  studentIdOrYear,
  adminComment,
  errorMessage,
  onLogout,
}: AccessGateScreenProps) {
  const reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
    >
      <LogOut className="w-3.5 h-3.5" /> 로그아웃
    </button>
  );

  const retryButton = (
    <button
      type="button"
      onClick={reload}
      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
    >
      <RefreshCw className="w-3.5 h-3.5" /> 다시 확인하기
    </button>
  );

  if (state === "pending") {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-800 p-8 text-center space-y-4 shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          관리자 승인 대기 중입니다
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          <strong>{name}</strong>님, 회원가입은 정상적으로 완료되었습니다.
          동국대학교 교육학과 폐쇄형 플랫폼 보안 정책에 따라 학과 관리자의 소속 승인 전까지는 내부 콘텐츠 이용이 제한됩니다.
        </p>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-left text-xs space-y-1.5 border border-amber-200 dark:border-amber-900/50">
          <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> 승인 처리 상태 안내
          </p>
          <p className="text-amber-800 dark:text-amber-300">
            - 등록 이메일: <strong>{email}</strong><br />
            - 신청 신분: <strong>{roleLabel}</strong> ({studentIdOrYear || "학번 미기재"})<br />
            - 현재 승인 상태: <strong>승인 대기중 (pending)</strong>
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t border-amber-200 dark:border-amber-900/60">
            ※ 관리자가 승인을 완료하면 새로고침 없이도 즉시 플랫폼의 모든 게시판과 대화창이 열립니다.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5 pt-2">{logoutButton}</div>
      </div>
    );
  }

  if (state === "supplement_requested") {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white dark:bg-slate-900 rounded-3xl border border-blue-300 dark:border-blue-900/60 p-8 text-center space-y-4 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
          <FileWarning className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          소속 확인 정보 보완이 필요합니다
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          관리자가 학번 또는 재학/졸업 증빙의 보완을 요청했습니다. 학과 관리자에게 보완 자료를 전달해 주세요.
        </p>
        {adminComment && (
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-left text-xs border border-blue-200 dark:border-blue-900/60 space-y-1">
            <p className="font-bold text-blue-900 dark:text-blue-200">관리자 요청 사항:</p>
            <p className="text-blue-800 dark:text-blue-300">{adminComment}</p>
          </div>
        )}
        <div className="pt-2 flex flex-wrap justify-center gap-2.5">{logoutButton}</div>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white dark:bg-slate-900 rounded-3xl border border-rose-300 dark:border-rose-900/60 p-8 text-center space-y-4 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          가입 승인이 거절되었습니다
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          제출하신 정보의 교육학과 소속 여부가 확인되지 않아 관리자에 의해 가입 승인이 반려되었습니다.
        </p>
        {adminComment && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-left text-xs border border-rose-200 dark:border-rose-900/60 space-y-1">
            <p className="font-bold text-rose-900 dark:text-rose-200">관리자 안내 사유:</p>
            <p className="text-rose-800 dark:text-rose-300">{adminComment}</p>
          </div>
        )}
        <div className="pt-2 flex flex-wrap justify-center gap-2.5">{logoutButton}</div>
      </div>
    );
  }

  if (state === "suspended") {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-700 p-8 text-center space-y-4 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center mx-auto">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          이용이 정지된 계정입니다
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          관리자에 의해 동국e음 이용이 일시 정지되었습니다. 자세한 내용은 학과 관리자에게 문의해 주세요.
        </p>
        {adminComment && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-left text-xs border border-slate-200 dark:border-slate-700 space-y-1">
            <p className="font-bold text-slate-900 dark:text-slate-200">관리자 안내 사유:</p>
            <p className="text-slate-700 dark:text-slate-300">{adminComment}</p>
          </div>
        )}
        <div className="pt-2 flex flex-wrap justify-center gap-2.5">{logoutButton}</div>
      </div>
    );
  }

  // profile_missing · profile_error · unknown_status: 자동 승인하지 않고 접근 제한
  const title =
    state === "profile_missing"
      ? "회원 정보를 찾을 수 없습니다"
      : state === "profile_error"
      ? "회원 정보를 불러오지 못했습니다"
      : "회원 승인 상태를 확인할 수 없습니다";
  const description =
    state === "profile_missing"
      ? "로그인은 되었지만 동국e음 회원 가입 정보가 없습니다. 가입 과정이 중간에 끊겼을 수 있으니 학과 관리자에게 문의해 주세요."
      : state === "profile_error"
      ? "인터넷 연결이나 서버 문제로 회원 정보를 확인하지 못했습니다. 보안을 위해 확인이 끝날 때까지 내부 서비스 이용이 제한됩니다."
      : "회원 정보에 올바른 승인 상태가 기록되어 있지 않습니다. 보안을 위해 내부 서비스 이용이 제한되니 학과 관리자에게 문의해 주세요.";

  return (
    <div className="max-w-xl mx-auto my-14 bg-white dark:bg-slate-900 rounded-3xl border border-orange-300 dark:border-orange-900/60 p-8 text-center space-y-4 shadow-md">
      <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white">{title}</h2>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
        {description}
      </p>
      <p className="text-[11px] text-slate-500">로그인 계정: {email || "확인 불가"}</p>
      {state === "profile_error" && errorMessage && (
        <p className="text-[11px] text-rose-600 break-all">{errorMessage}</p>
      )}
      <div className="pt-2 flex flex-wrap justify-center gap-2.5">
        {retryButton}
        {logoutButton}
      </div>
    </div>
  );
}

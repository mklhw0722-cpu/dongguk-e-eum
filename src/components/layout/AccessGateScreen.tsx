"use client";

import React, { useState, useEffect } from "react";
import { AccessGateState } from "@/lib/accessGate";
import {
  MajorPlanType,
  StudentAcademicProfile,
  TeachingTrackStatus,
  UserRole,
} from "@/types";
import { UserProfileDoc } from "@/lib/firebase";
import {
  REVISION_FIELD_OPTIONS,
  RegistrationRevisionInput,
} from "@/lib/memberLifecycle";
import { formatAdmissionYearLabel } from "@/lib/graduationCurriculum";
import { ROLE_LABELS } from "@/components/common/Cards";
import {
  Clock,
  XCircle,
  FileWarning,
  Ban,
  AlertTriangle,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Save,
  Send,
  Edit3,
  Trash2,
  UserPlus,
} from "lucide-react";

interface AccessGateScreenProps {
  state: AccessGateState;
  name: string;
  email: string;
  roleLabel: string;
  studentIdOrYear?: string;
  adminComment?: string;
  errorMessage?: string | null;
  profile?: UserProfileDoc | null;
  onLogout: () => void;
  onUpdateRegistration?: (
    input: RegistrationRevisionInput,
    mode: "draft" | "resubmit"
  ) => Promise<UserProfileDoc>;
  onRecreateProfile?: (
    input: RegistrationRevisionInput
  ) => Promise<UserProfileDoc>;
  onDeleteOwnAuth?: () => Promise<void>;
}

/**
 * 로그인은 했지만 내부 서비스를 이용할 수 없는 사용자에게 보여주는 상태별 안내 및 재신청 화면
 * - pending: 관리자 승인 대기
 * - needs_revision / supplement_requested: 가입정보 보완 요청 ("회원가입 정보의 보완이 필요합니다." + 정보 수정 저장 + 다시 승인 요청하기)
 * - rejected: 가입 신청 반려 (반려 사유 확인 + 기존 계정으로 정보 수정 및 재신청 가능)
 * - suspended: 이용 정지
 * - profile_missing: 삭제된 계정 또는 가입 중단 계정 (즉시 재가입 신청서 제출 또는 인증 계정 완전 삭제 지원)
 */
export function AccessGateScreen({
  state,
  name,
  email,
  roleLabel,
  studentIdOrYear,
  adminComment,
  errorMessage,
  profile,
  onLogout,
  onUpdateRegistration,
  onRecreateProfile,
  onDeleteOwnAuth,
}: AccessGateScreenProps) {
  const isRevisionState =
    state === "needs_revision" || state === "supplement_requested";
  const isRejectedState = state === "rejected";

  // 수정 폼 입력 상태
  const [editRole, setEditRole] = useState<UserRole>(
    profile?.role && profile.role !== "admin" ? profile.role : "student"
  );
  const [editName, setEditName] = useState(profile?.name || name || "");
  const [editAdmissionYear, setEditAdmissionYear] = useState<number>(
    profile?.academicProfile?.admissionYearNumber || 2024
  );
  const [editStudentIdOrYear, setEditStudentIdOrYear] = useState(
    profile?.studentIdOrYear || studentIdOrYear || ""
  );
  const [editMajorPlanType, setEditMajorPlanType] = useState<MajorPlanType>(
    profile?.academicProfile?.majorPlanType || "single"
  );
  const [editDoubleMajorDept, setEditDoubleMajorDept] = useState(
    profile?.academicProfile?.doubleMajorDepartment ||
      profile?.doubleMajor ||
      ""
  );
  const [editTeachingTrack, setEditTeachingTrack] =
    useState<TeachingTrackStatus>(
      profile?.academicProfile?.teachingTrackStatus || "educational_major"
    );
  const [editIsEnglishTrack, setEditIsEnglishTrack] = useState<boolean>(
    Boolean(profile?.academicProfile?.isEnglishTrack)
  );
  const [editVerificationNote, setEditVerificationNote] = useState(
    profile?.verificationNote || ""
  );

  // 반려 상태에서 수정 폼 열기 토글
  const [showRejectedEditForm, setShowRejectedEditForm] = useState(false);

  // 처리 상태 및 피드백 메시지
  const [submittingMode, setSubmittingMode] = useState<
    "idle" | "draft" | "resubmit" | "recreate" | "delete_auth"
  >("idle");
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.role && profile.role !== "admin") {
      setEditRole(profile.role);
    }
    if (profile.name) setEditName(profile.name);
    if (profile.studentIdOrYear) setEditStudentIdOrYear(profile.studentIdOrYear);
    if (profile.academicProfile) {
      setEditAdmissionYear(
        profile.academicProfile.admissionYearNumber || 2024
      );
      setEditMajorPlanType(profile.academicProfile.majorPlanType || "single");
      setEditDoubleMajorDept(
        profile.academicProfile.doubleMajorDepartment ||
          profile.doubleMajor ||
          ""
      );
      setEditTeachingTrack(
        profile.academicProfile.teachingTrackStatus || "educational_major"
      );
      setEditIsEnglishTrack(Boolean(profile.academicProfile.isEnglishTrack));
    } else if (profile.doubleMajor) {
      setEditDoubleMajorDept(profile.doubleMajor);
    }
    if (profile.verificationNote !== undefined) {
      setEditVerificationNote(profile.verificationNote);
    }
  }, [profile]);

  const reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
    >
      <LogOut className="w-3.5 h-3.5" /> 로그아웃
    </button>
  );

  const retryButton = (
    <button
      type="button"
      onClick={reload}
      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
    >
      <RefreshCw className="w-3.5 h-3.5" /> 상태 다시 확인
    </button>
  );

  const buildRevisionInput = (): RegistrationRevisionInput => {
    const resolvedStudentIdOrYear =
      editRole === "student"
        ? formatAdmissionYearLabel(editAdmissionYear)
        : editRole === "professor"
        ? editStudentIdOrYear.trim() || "교육학과 전임교원"
        : editStudentIdOrYear.trim();

    let academicProfile: StudentAcademicProfile | undefined;
    if (editRole === "student") {
      const hasDoubleMajor = editMajorPlanType !== "single";
      academicProfile = {
        admissionYearNumber: editAdmissionYear,
        admissionYearLabel: formatAdmissionYearLabel(editAdmissionYear),
        majorPlanType: editMajorPlanType,
        hasDoubleMajor,
        doubleMajorDepartment: hasDoubleMajor
          ? editDoubleMajorDept.trim()
          : "",
        teachingTrackStatus: editTeachingTrack,
        isEnglishTrack: editIsEnglishTrack,
        adminVerifiedSpecialCondition: false,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
    }

    const resolvedDoubleMajor =
      editRole === "student"
        ? editMajorPlanType !== "single"
          ? editDoubleMajorDept.trim()
          : undefined
        : editRole === "alumni" && editDoubleMajorDept.trim()
        ? editDoubleMajorDept.trim()
        : undefined;

    return {
      name: editName.trim(),
      role: editRole,
      studentIdOrYear: resolvedStudentIdOrYear,
      doubleMajor: resolvedDoubleMajor,
      academicProfile,
      verificationNote:
        editVerificationNote.trim() || "가입 정보 수정 및 보완 제출",
    };
  };

  const handleSaveOrResubmit = async (mode: "draft" | "resubmit") => {
    if (!onUpdateRegistration) return;
    setFeedbackBanner(null);

    if (!editName.trim()) {
      setFeedbackBanner({
        type: "error",
        text: "이름(실명)을 입력해 주세요.",
      });
      return;
    }

    if (editRole === "alumni" && !editStudentIdOrYear.trim()) {
      setFeedbackBanner({
        type: "error",
        text: "졸업 학번(예: 18학번 졸업)을 입력해 주세요.",
      });
      return;
    }

    if (
      editRole === "student" &&
      editMajorPlanType !== "single" &&
      !editDoubleMajorDept.trim()
    ) {
      setFeedbackBanner({
        type: "error",
        text: "복수전공을 선택하신 경우 복수전공 학과명을 입력해 주세요.",
      });
      return;
    }

    setSubmittingMode(mode);
    try {
      const payload = buildRevisionInput();
      await onUpdateRegistration(payload, mode);
      if (mode === "draft") {
        setFeedbackBanner({
          type: "success",
          text: "수정한 가입 정보가 저장되었습니다. 확인 후 아래 [다시 승인 요청하기] 버튼을 누르면 관리자에게 재심사가 접수됩니다.",
        });
      } else {
        setFeedbackBanner({
          type: "success",
          text: "다시 승인 요청이 완료되었습니다! 상태가 '승인 대기중(pending)'으로 변경되었습니다.",
        });
      }
    } catch (err: any) {
      setFeedbackBanner({
        type: "error",
        text:
          err?.message ||
          "가입 정보 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSubmittingMode("idle");
    }
  };

  const handleRecreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRecreateProfile) return;
    setFeedbackBanner(null);

    if (!editName.trim()) {
      setFeedbackBanner({
        type: "error",
        text: "이름(실명)을 입력해 주세요.",
      });
      return;
    }
    if (editRole === "alumni" && !editStudentIdOrYear.trim()) {
      setFeedbackBanner({
        type: "error",
        text: "졸업 학번(예: 18학번 졸업)을 입력해 주세요.",
      });
      return;
    }

    setSubmittingMode("recreate");
    try {
      const payload = buildRevisionInput();
      await onRecreateProfile(payload);
      setFeedbackBanner({
        type: "success",
        text: "가입 신청서가 정상적으로 다시 제출되어 '승인 대기(pending)' 상태로 전환되었습니다.",
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: "error",
        text:
          err?.message ||
          "가입 신청서 재생성 중 오류가 발생했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setSubmittingMode("idle");
    }
  };

  const handleSelfDeleteAuth = async () => {
    if (!onDeleteOwnAuth) return;
    setFeedbackBanner(null);
    setSubmittingMode("delete_auth");
    try {
      await onDeleteOwnAuth();
    } catch (err: any) {
      const msg =
        err?.code === "auth/requires-recent-login"
          ? "보안을 위해 방금 로그인한 세션에서만 계정 완전 삭제가 가능합니다. 로그아웃 후 다시 로그인한 뒤 즉시 버튼을 눌러주세요."
          : err?.message || "인증 계정 삭제 중 오류가 발생했습니다.";
      setFeedbackBanner({
        type: "error",
        text: msg,
      });
    } finally {
      setSubmittingMode("idle");
    }
  };

  // 공통 가입정보 수정 폼 렌더링
  const renderRegistrationEditForm = (isResubmitContext: boolean) => (
    <div className="text-left bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
          <Edit3 className="w-4 h-4 text-orange-600" />
          회원가입 정보 수정
        </h3>
        <span className="text-[11px] text-slate-500">
          기존 계정(UID) 유지 · 중복 계정 미생성
        </span>
      </div>

      {/* 신청 구분 */}
      <div>
        <label className="block text-xs font-bold text-slate-800 mb-1.5">
          신청 구분 (소속 역할)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["student", "alumni", "professor"] as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setEditRole(r)}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                editRole === r
                  ? "border-orange-600 bg-orange-50 text-orange-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* 이름 및 이메일(고정) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            이름 (실명) *
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="예: 김동국"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            가입 이메일 (변경 불가)
          </label>
          <input
            type="email"
            disabled
            value={email}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs sm:text-sm text-slate-500 cursor-not-allowed"
          />
        </div>
      </div>

      {/* 역할별 학번 / 입학연도 / 전공 트랙 수정 */}
      {editRole === "student" ? (
        <div className="p-3.5 rounded-xl bg-white border border-orange-200 space-y-3">
          <p className="text-xs font-extrabold text-orange-800">
            재학생 학번(입학연도) 및 전공·교직 이수 정보
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                신입학 연도 (학번) *
              </label>
              <select
                value={editAdmissionYear}
                onChange={(e) => setEditAdmissionYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
              >
                {[
                  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017,
                  2016, 2015, 2014,
                ].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}학년도 신입학 ({String(yr).slice(2)}학번)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                전공 이수 형태 *
              </label>
              <select
                value={editMajorPlanType}
                onChange={(e) =>
                  setEditMajorPlanType(e.target.value as MajorPlanType)
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
              >
                <option value="single">단일전공 (교육학과 심화)</option>
                <option value="double_edu">
                  복수전공 — 사범대학 내 타 학과
                </option>
                <option value="double_general">
                  복수전공 — 일반대학(비사범대) 학과
                </option>
              </select>
            </div>
          </div>

          {editMajorPlanType !== "single" && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                복수전공 학과명 *
              </label>
              <input
                type="text"
                value={editDoubleMajorDept}
                onChange={(e) => setEditDoubleMajorDept(e.target.value)}
                placeholder="예: 국어교육과, 심리학과, 컴퓨터공학과"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                교직 이수 상태
              </label>
              <select
                value={editTeachingTrack}
                onChange={(e) =>
                  setEditTeachingTrack(e.target.value as TeachingTrackStatus)
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
              >
                <option value="educational_major">
                  교육학과 주전공 교직 이수
                </option>
                <option value="double_teaching">
                  주전공 + 복수전공 교직 병행
                </option>
                <option value="non_teaching">교직 미이수 (일반 학사)</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsEnglishTrack}
                  onChange={(e) => setEditIsEnglishTrack(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span>영어트랙 대상자 여부</span>
              </label>
            </div>
          </div>
        </div>
      ) : editRole === "alumni" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              학번 *
            </label>
            <select
              value={
                editStudentIdOrYear && editStudentIdOrYear.includes("학번 졸업")
                  ? editStudentIdOrYear
                  : "19학번 졸업"
              }
              onChange={(e) => setEditStudentIdOrYear(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
            >
              {Array.from({ length: 23 }, (_, i) => {
                const num = 22 - i;
                const prefix = num < 10 ? `0${num}` : `${num}`;
                return (
                  <option key={prefix} value={`${prefix}학번 졸업`}>
                    {prefix}학번 졸업
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              복수전공 또는 현직 분야 (선택)
            </label>
            <input
              type="text"
              value={editDoubleMajorDept}
              onChange={(e) => setEditDoubleMajorDept(e.target.value)}
              placeholder="예: 심리학 복수전공 / 에듀테크 재직"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            직함 *
          </label>
          <select
            value={editStudentIdOrYear || "교육학과 전임교원"}
            onChange={(e) => setEditStudentIdOrYear(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
          >
            <option value="교육학과 전임교원">교육학과 전임교원</option>
          </select>
        </div>
      )}

      {/* 소속 확인 메모 및 보완 답변 */}
      <div>
        <label className="block text-xs font-bold text-slate-800 mb-1">
          소속 확인 메모 및 보완 설명
        </label>
        <textarea
          rows={2}
          value={editVerificationNote}
          onChange={(e) => setEditVerificationNote(e.target.value)}
          placeholder="관리자가 요청한 보완 내용(예: 정확한 학번, 재학/졸업 확인 메모 등)을 적어주세요."
          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* 피드백 배너 */}
      {feedbackBanner && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
            feedbackBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {feedbackBanner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{feedbackBanner.text}</span>
        </div>
      )}

      {/* 저장 및 다시 승인 요청하기 버튼 */}
      {isResubmitContext && (
        <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={submittingMode !== "idle"}
            onClick={() => handleSaveOrResubmit("draft")}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {submittingMode === "draft" ? "저장 중..." : "수정한 내용 저장"}
          </button>
          <button
            type="button"
            disabled={submittingMode !== "idle"}
            onClick={() => handleSaveOrResubmit("resubmit")}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            {submittingMode === "resubmit"
              ? "재신청 접수 중..."
              : "다시 승인 요청하기"}
          </button>
        </div>
      )}
    </div>
  );

  // 1. 승인 대기중 (pending)
  if (state === "pending") {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white rounded-3xl border border-amber-300 p-8 text-center space-y-5 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
              관리자 승인 대기중 (pending)
            </span>
            {(profile?.revisionCount ?? 0) > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                보완·재신청 제출 완료 ({profile?.revisionCount}회)
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            관리자 승인 후 동국e음을 이용할 수 있습니다
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            <strong>{profile?.name || name}</strong>님의 가입 신청서가 정상적으로
            접수되었습니다. 학과 관리자가 동국대학교 교육학과 구성원 여부를 확인한
            뒤 승인하면 모든 메뉴가 자동으로 열립니다.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
          <p className="font-bold text-slate-800">제출된 가입 신청 정보</p>
          <p className="text-slate-600">• 이름: {profile?.name || name}</p>
          <p className="text-slate-600">• 이메일: {email || "확인 중"}</p>
          <p className="text-slate-600">
            • 신청 구분: {ROLE_LABELS[profile?.role || "student"] || roleLabel}{" "}
            {profile?.studentIdOrYear || studentIdOrYear
              ? `(${profile?.studentIdOrYear || studentIdOrYear})`
              : ""}
          </p>
          {profile?.doubleMajor && (
            <p className="text-slate-600">• 복수전공: {profile.doubleMajor}</p>
          )}
          {profile?.verificationNote && (
            <p className="text-slate-600">
              • 소속 확인 메모: {profile.verificationNote}
            </p>
          )}
          {profile?.resubmittedAt && (
            <p className="text-blue-700 font-semibold">
              • 최근 재신청 일시: {profile.resubmittedAt.slice(0, 16).replace("T", " ")}
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-wrap justify-center gap-2.5">
          {retryButton}
          {logoutButton}
        </div>
      </div>
    );
  }

  // 2. 가입정보 보완 요청 (needs_revision / supplement_requested)
  if (isRevisionState) {
    const requestedFields = profile?.revisionFields || [];
    return (
      <div className="max-w-2xl mx-auto my-10 bg-white rounded-3xl border border-blue-300 p-6 sm:p-8 text-center space-y-5 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
          <FileWarning className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            가입정보 보완 요청 (needs_revision)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            회원가입 정보의 보완이 필요합니다.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            학과 관리자가 가입 신청 정보를 검토한 결과, 아래 항목의 확인·보완이
            필요합니다. 기존 계정을 그대로 유지한 채 잘못 입력한 정보를 수정하고{" "}
            <strong>[다시 승인 요청하기]</strong>를 눌러주세요.
          </p>
        </div>

        {/* 1) 관리자가 작성한 보완 요청 사유 및 항목 확인 */}
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-left text-xs space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-extrabold text-blue-950">
              관리자 보완 요청 사유 (본인에게만 비공개 표시)
            </p>
            {requestedFields.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {requestedFields.map((fieldKey) => {
                  const found = REVISION_FIELD_OPTIONS.find(
                    (o) => o.key === fieldKey
                  );
                  return (
                    <span
                      key={fieldKey}
                      className="px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-900 text-[11px] font-bold"
                    >
                      보완 항목: {found ? found.label : fieldKey}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-blue-900 font-medium leading-relaxed">
            {adminComment ||
              profile?.adminComment ||
              "학번(입학연도) 또는 교육학과 소속 확인 정보가 부족합니다. 아래에서 정보를 정확히 수정한 뒤 다시 승인 요청해 주세요."}
          </p>
        </div>

        {/* 2) 기존에 입력한 회원가입 정보 요약 확인 */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1">
          <p className="font-bold text-slate-800 mb-1">
            현재 저장된 회원가입 정보
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600">
            <p>• 이름: {profile?.name || name}</p>
            <p>• 이메일: {email}</p>
            <p>
              • 신청 구분: {ROLE_LABELS[profile?.role || "student"] || roleLabel}
            </p>
            <p>
              • 학번/연도:{" "}
              {profile?.studentIdOrYear || studentIdOrYear || "미입력"}
            </p>
            {profile?.doubleMajor && (
              <p>• 복수전공: {profile.doubleMajor}</p>
            )}
            {profile?.verificationNote && (
              <p className="sm:col-span-2">
                • 소속 확인 메모: {profile.verificationNote}
              </p>
            )}
          </div>
        </div>

        {/* 3~5) 항목 수정 폼 + '수정한 내용 저장' + '다시 승인 요청하기' */}
        {renderRegistrationEditForm(true)}

        <div className="pt-2 flex flex-wrap justify-center gap-2.5 border-t border-slate-100">
          {retryButton}
          {logoutButton}
        </div>
      </div>
    );
  }

  // 3. 가입 신청 반려 (rejected) - 보완 요청과 명확히 구분된 문구 + 재신청 기능 제공
  if (isRejectedState) {
    return (
      <div className="max-w-2xl mx-auto my-10 bg-white rounded-3xl border border-rose-300 p-6 sm:p-8 text-center space-y-5 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
            가입 신청 반려됨 (rejected)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            회원가입 신청이 반려되었습니다
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            동국대학교 교육학과 구성원 자격이 확인되지 않아 가입 신청이
            반려되었습니다. 만약 가입 시 이름·학번·소속 정보를 잘못 입력하셨다면,
            새 계정을 만들지 않고 아래에서 정보를 수정하여 다시 승인 신청할 수
            있습니다.
          </p>
        </div>

        {/* 관리자 반려 사유 표시 (본인에게만 공개) */}
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left text-xs space-y-1.5">
          <p className="font-extrabold text-rose-900">
            관리자 반려 사유 (본인에게만 비공개 표시)
          </p>
          <p className="text-rose-800 font-medium leading-relaxed">
            {adminComment ||
              profile?.adminComment ||
              "동국대학교 교육학과 구성원(재학생·졸업생·교수진) 자격이 확인되지 않았습니다."}
          </p>
        </div>

        {/* 반려 상태에서 정보 수정 후 재신청 토글 */}
        <div className="space-y-3">
          {!showRejectedEditForm ? (
            <button
              type="button"
              onClick={() => setShowRejectedEditForm(true)}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              가입 정보 수정 후 다시 승인 신청하기
            </button>
          ) : (
            renderRegistrationEditForm(true)
          )}
        </div>

        <div className="pt-2 flex flex-wrap justify-center gap-2.5 border-t border-slate-100">
          {retryButton}
          {logoutButton}
        </div>
      </div>
    );
  }

  // 4. 이용 정지 (suspended)
  if (state === "suspended") {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white rounded-3xl border border-slate-300 p-8 text-center space-y-4 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center mx-auto">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">
          계정 이용이 일시 정지되었습니다
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          커뮤니티 운영 정책에 따라 현재 계정의 내부 서비스 접근이 제한되어
          있습니다. 문의 사항은 학과 관리자에게 연락해 주세요.
        </p>
        {adminComment && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-left text-xs space-y-1">
            <p className="font-bold text-slate-800">정지 사유</p>
            <p className="text-slate-700">{adminComment}</p>
          </div>
        )}
        <div className="pt-2 flex flex-wrap justify-center gap-2.5">
          {logoutButton}
        </div>
      </div>
    );
  }

  // 5. 회원 문서 누락 (profile_missing): 관리자가 회원을 삭제했거나 가입이 중단된 계정
  if (state === "profile_missing") {
    return (
      <div className="max-w-2xl mx-auto my-10 bg-white rounded-3xl border border-orange-300 p-6 sm:p-8 text-center space-y-5 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
          <UserPlus className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
            회원 프로필 미등록 · 재가입 가능 계정
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            이전에 삭제되었거나 가입이 완료되지 않은 계정입니다
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            현재 로그인하신 이메일(<strong>{email}</strong>)은 인증 계정만 남아있고
            동국e음 회원 정보가 없는 상태입니다. 아래에서{" "}
            <strong>새 가입 신청서를 바로 제출</strong>하거나,{" "}
            <strong>인증 계정을 완전히 삭제(초기화)</strong>할 수 있습니다.
          </p>
        </div>

        <form onSubmit={handleRecreateSubmit} className="space-y-4">
          {renderRegistrationEditForm(false)}

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
            {onDeleteOwnAuth && (
              <button
                type="button"
                disabled={submittingMode !== "idle"}
                onClick={handleSelfDeleteAuth}
                className="px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {submittingMode === "delete_auth"
                  ? "인증 계정 삭제 중..."
                  : "이 이메일 인증 계정 완전 삭제하기"}
              </button>
            )}
            <button
              type="submit"
              disabled={submittingMode !== "idle"}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <Send className="w-3.5 h-3.5" />
              {submittingMode === "recreate"
                ? "가입 신청서 등록 중..."
                : "가입 신청서 다시 제출하기 (승인 요청)"}
            </button>
          </div>
        </form>

        <div className="pt-2 flex flex-wrap justify-center gap-2.5 border-t border-slate-100">
          {retryButton}
          {logoutButton}
        </div>
      </div>
    );
  }

  // 6. profile_error · unknown_status: 자동 승인하지 않고 접근 제한
  const title =
    state === "profile_error"
      ? "회원 정보를 불러오지 못했습니다"
      : "회원 승인 상태를 확인할 수 없습니다";
  const description =
    state === "profile_error"
      ? "인터넷 연결이나 서버 문제로 회원 정보를 확인하지 못했습니다. 보안을 위해 확인이 끝날 때까지 내부 서비스 이용이 제한됩니다."
      : "회원 정보에 올바른 승인 상태가 기록되어 있지 않습니다. 보안을 위해 내부 서비스 이용이 제한되니 학과 관리자에게 문의해 주세요.";

  return (
    <div className="max-w-xl mx-auto my-14 bg-white rounded-3xl border border-orange-300 p-8 text-center space-y-4 shadow-md">
      <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
        {description}
      </p>
      <p className="text-[11px] text-slate-500">
        로그인 계정: {email || "확인 불가"}
      </p>
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

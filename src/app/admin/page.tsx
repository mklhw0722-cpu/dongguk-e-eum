"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  ApprovalStatus,
  CohortBandId,
  OfficialCohortRuleSet,
  RuleReviewStatus,
  UserRole,
} from "@/types";
import { OFFICIAL_GRADUATION_CATALOG } from "@/lib/graduationCurriculum";
import { ROLE_LABELS, DemoInfoBanner } from "@/components/common/Cards";
import {
  ShieldCheck,
  UserCheck,
  Users,
  Compass,
  Flag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldAlert,
  Trash2,
  Plus,
  Database,
  GraduationCap,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

const STATUS_LABELS: Record<ApprovalStatus, { label: string; style: string }> = {
  pending: {
    label: "승인 대기중",
    style: "bg-amber-100 text-amber-800",
  },
  approved: {
    label: "승인 완료",
    style: "bg-emerald-100 text-emerald-800",
  },
  supplement_requested: {
    label: "보완 요청됨",
    style: "bg-blue-100 text-blue-800",
  },
  rejected: {
    label: "승인 거절됨",
    style: "bg-rose-100 text-rose-800",
  },
  suspended: {
    label: "이용 정지",
    style: "bg-slate-200 text-slate-800",
  },
};

export default function AdminPage() {
  const {
    approvalRequests,
    updateApprovalStatus,
    users,
    updateUserRoleByAdmin,
    communityRooms,
    createCommunityRoom,
    updateCommunityRoomName,
    communityPosts,
    deleteCommunityPost,
    reports,
    resolveReport,
    realUsersForAdmin,
    handleAdminUpdateApproval,
    handleUpdateUserName,
    isFirestoreConnected,
    authUserProfile,
    graduationCatalog,
    updateGraduationCatalogByAdmin,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    "approvals" | "users" | "rooms_posts" | "reports" | "graduation_rules"
  >("approvals");

  // 공통 졸업요건 관리자 편집 상태
  const [selectedCohortId, setSelectedCohortId] =
    useState<CohortBandId>("2024-2025");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogFeedback, setCatalogFeedback] = useState<string | null>(null);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {}
  );
  const [roleSelects, setRoleSelects] = useState<Record<string, UserRole>>({});
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleUpdateRole = async (
    targetUserId: string,
    newRole: UserRole,
    currentStatus?: ApprovalStatus,
    comment?: string
  ) => {
    setUpdatingUserId(targetUserId);
    try {
      if (realUsersForAdmin.some((u) => u.id === targetUserId)) {
        await handleAdminUpdateApproval(
          targetUserId,
          currentStatus || "approved",
          comment || "관리자가 회원 역할을 변경했습니다.",
          newRole
        );
      } else {
        updateUserRoleByAdmin(targetUserId, newRole);
      }
    } catch (err: any) {
      alert(`역할 변경 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // 복수전공 공유방 추가 폼
  const [newMajorName, setNewMajorName] = useState("");
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  // 공유방 수정 상태
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [isEditingAdminName, setIsEditingAdminName] = useState(false);
  const [adminNameInput, setAdminNameInput] = useState(authUserProfile?.name || "이혜원");
  const [isAdminNameSaving, setIsAdminNameSaving] = useState(false);

  const handleSaveAdminName = async (nameToSave: string) => {
    const trimmed = nameToSave.trim();
    if (!trimmed || isAdminNameSaving) return;
    setIsAdminNameSaving(true);
    try {
      await handleUpdateUserName(trimmed);
      setIsEditingAdminName(false);
      alert(`관리자 이름이 '${trimmed}'(으)로 성공적으로 변경되었습니다.`);
    } catch (err: any) {
      alert(`이름 변경 실패: ${err?.message || err}`);
    } finally {
      setIsAdminNameSaving(false);
    }
  };
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomCat, setEditRoomCat] = useState("");
  const [editRoomDesc, setEditRoomDesc] = useState("");

  const handleAddDoubleMajorRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMajorName.trim() || !newRoomTitle.trim()) return;
    createCommunityRoom({
      name: newRoomTitle.trim(),
      type: "double_major",
      categoryName: newMajorName.trim(),
      description:
        newRoomDesc.trim() ||
        `${newMajorName.trim()} 복수전공 이수 학우와 졸업생을 위한 정보 공유방입니다.`,
    });
    setNewMajorName("");
    setNewRoomTitle("");
    setNewRoomDesc("");
  };

  const startEditRoom = (room: (typeof communityRooms)[0]) => {
    setEditingRoomId(room.id);
    setEditRoomName(room.name);
    setEditRoomCat(room.categoryName);
    setEditRoomDesc(room.description);
  };

  const handleSaveEditRoom = (roomId: string) => {
    if (!editRoomName.trim() || !editRoomCat.trim()) return;
    updateCommunityRoomName(
      roomId,
      editRoomName.trim(),
      editRoomCat.trim(),
      editRoomDesc.trim()
    );
    setEditingRoomId(null);
  };

  // 실제 Firestore 가입 승인 처리
  const onProcessRealUser = async (targetUid: string, status: ApprovalStatus) => {
    const comment = commentInputs[targetUid] || (status === "approved" ? "소속 확인 완료 (정회원 승인)" : "관리자 검토 처리");
    const role = roleSelects[targetUid];
    await handleAdminUpdateApproval(targetUid, status, comment, role);
    setCommentInputs((prev) => ({ ...prev, [targetUid]: "" }));
  };

  // 2차 방어: 관리자 권한이 없거나 미승인 사용자인 경우 관리자 콘솔 렌더링 차단
  if (!authUserProfile || authUserProfile.role !== "admin" || authUserProfile.approvalStatus !== "approved") {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-rose-300 dark:border-rose-900/60 text-center space-y-4 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          관리자 전용 구역 접근 제한 (403 Forbidden)
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          이 페이지는 동국e음 최고 관리자(Admin) 권한으로 승인된 사용자만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              동국e음 관리자 센터 (회원 승인 및 운영)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Firebase Firestore 실제 가입 신청자 승인·거절, 사용자 권한 관리, 공유방 및 신고 내역을 관리합니다.
          </p>
        </div>
      </div>

            <DemoInfoBanner
        title="관리자 권한 및 승인 통제 원칙"
        description="관리자 승인(approved)을 받은 계정만 내부 커뮤니티 데이터에 접근할 수 있으며, 일반 사용자는 자신의 권한이나 승인 상태를 스스로 변경할 수 없습니다."
      />

      {/* 접속 중인 관리자 프로필 및 이름 변경 섹션 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shrink-0">
            {authUserProfile.avatarInitials || (authUserProfile.name ? authUserProfile.name.slice(0, 2) : "관리")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                {authUserProfile.name || "시스템 관리자"}
              </span>
              <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[10px] font-bold">
                최고 관리자
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{authUserProfile.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditingAdminName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveAdminName(adminNameInput);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={adminNameInput}
                onChange={(e) => setAdminNameInput(e.target.value)}
                placeholder="새 관리자 이름 (예: 이혜원)"
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-orange-600"
                autoFocus
              />
              <button
                type="submit"
                disabled={!adminNameInput.trim() || isAdminNameSaving}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isAdminNameSaving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingAdminName(false)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 font-semibold"
              >
                취소
              </button>
            </form>
          ) : (
            <>
              {authUserProfile.name !== "이혜원" && (
                <button
                  type="button"
                  disabled={isAdminNameSaving}
                  onClick={() => handleSaveAdminName("이혜원")}
                  className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
                >
                  이름을 &apos;이혜원&apos;으로 변경
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAdminNameInput(authUserProfile.name || "이혜원");
                  setIsEditingAdminName(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
              >
                직접 수정
              </button>
            </>
          )}
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "approvals"
              ? "bg-orange-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" /> 가입 승인 관리 (
          {realUsersForAdmin.length > 0 ? realUsersForAdmin.length : approvalRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "users"
              ? "bg-orange-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4" /> 전체 회원 관리 (
          {realUsersForAdmin.length > 0 ? realUsersForAdmin.length : users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("graduation_rules")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "graduation_rules"
              ? "bg-orange-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" /> 공통 졸업요건 관리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rooms_posts")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "rooms_posts"
              ? "bg-orange-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Compass className="w-4 h-4" /> 공유방·게시글 관리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "reports"
              ? "bg-orange-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Flag className="w-4 h-4" /> 신고 내역 관리 ({reports.length})
        </button>
      </div>

      {/* 탭 1: 가입 신청 승인 및 거절 */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          {/* 실제 Firestore 실시간 가입 회원 섹션 */}
          {realUsersForAdmin.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Firebase 실제 가입 신청자 실시간 목록 ({realUsersForAdmin.length}명)
              </h2>

              {realUsersForAdmin.map((userDoc) => {
                const st = STATUS_LABELS[userDoc.approvalStatus] || STATUS_LABELS.pending;
                return (
                  <div
                    key={userDoc.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.style}`}
                        >
                          {st.label}
                        </span>
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          {userDoc.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                          신청 역할: {ROLE_LABELS[userDoc.role]} ({userDoc.studentIdOrYear})
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        가입일: {userDoc.joinedAt}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl">
                      <p>
                        <strong>이메일:</strong> {userDoc.email}
                      </p>
                      <p>
                        <strong>UID:</strong> <code className="text-[11px]">{userDoc.id}</code>
                      </p>
                      {userDoc.verificationNote && (
                        <p className="sm:col-span-2">
                          <strong>가입 신청 메모:</strong> {userDoc.verificationNote}
                        </p>
                      )}
                      {userDoc.adminComment && (
                        <p className="sm:col-span-2 text-orange-700 dark:text-orange-300 font-semibold">
                          <strong>관리자 메시지:</strong> {userDoc.adminComment}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <select
                        value={roleSelects[userDoc.id] || userDoc.role}
                        onChange={(e) =>
                          setRoleSelects((prev) => ({
                            ...prev,
                            [userDoc.id]: e.target.value as UserRole,
                          }))
                        }
                        className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                      >
                        <option value="student">재학생</option>
                        <option value="alumni">졸업생</option>
                        <option value="professor">교수</option>
                        <option value="admin">관리자</option>
                      </select>

                      <input
                        type="text"
                        value={commentInputs[userDoc.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [userDoc.id]: e.target.value,
                          }))
                        }
                        placeholder="승인/보완/거절 메시지 입력..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                      />

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onProcessRealUser(userDoc.id, "approved")}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                        </button>
                        <button
                          type="button"
                          onClick={() => onProcessRealUser(userDoc.id, "supplement_requested")}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> 보완 요청
                        </button>
                        <button
                          type="button"
                          onClick={() => onProcessRealUser(userDoc.id, "rejected")}
                          className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" /> 거절
                        </button>
                        <button
                          type="button"
                          onClick={() => onProcessRealUser(userDoc.id, "suspended")}
                          className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          이용 정지
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 데모 신청자 목록 (로컬 시연용) */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-bold text-slate-500">
              {realUsersForAdmin.length > 0 ? "데모 신청 내역 (로컬)" : "가입 신청 목록"}
            </h2>

            {approvalRequests.map((req) => {
              const st = STATUS_LABELS[req.status];
              return (
                <div
                  key={req.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.style}`}
                      >
                        {st.label}
                      </span>
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        {req.applicantName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                        신청 역할: {ROLE_LABELS[req.requestedRole]}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      신청일시: {req.submittedAt}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl">
                    <p>
                      <strong>이메일:</strong> {req.applicantEmail}
                    </p>
                    <p>
                      <strong>학번/연도:</strong> {req.studentIdOrYear}
                    </p>
                    <p className="sm:col-span-2">
                      <strong>인증 방식:</strong> {req.verificationMethod}
                    </p>
                    <p className="sm:col-span-2">
                      <strong>신청 메모:</strong> {req.note}
                    </p>
                    {req.adminComment && (
                      <p className="sm:col-span-2 text-orange-700 dark:text-orange-300 font-semibold">
                        <strong>관리자 처리 사유:</strong> {req.adminComment}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      value={commentInputs[req.id] || ""}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({
                          ...prev,
                          [req.id]: e.target.value,
                        }))
                      }
                      placeholder="승인/보완요청/거절 안내 사유 메모 입력 (선택)..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateApprovalStatus(
                            req.id,
                            "approved",
                            commentInputs[req.id] || "교육학과 소속 확인 완료 (승인)"
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateApprovalStatus(
                            req.id,
                            "supplement_requested",
                            commentInputs[req.id] ||
                              "학번 및 소속 확인 정보를 보완해 주세요."
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> 보완 요청
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateApprovalStatus(
                            req.id,
                            "rejected",
                            commentInputs[req.id] || "교육학과 구성원 확인 불가"
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 거절
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 2: 사용자 역할 관리 */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* 역할별 필터 탭 (전체, 재학생, 졸업생, 교수진, 관리자) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: "all", label: "전체 회원" },
              { key: "student", label: "재학생" },
              { key: "alumni", label: "졸업생" },
              { key: "professor", label: "교수진" },
              { key: "admin", label: "관리자" },
            ].map((tab) => {
              const count = (realUsersForAdmin.length > 0 ? realUsersForAdmin : users).filter(
                (u) => tab.key === "all" || u.role === tab.key
              ).length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setUserRoleFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    userRoleFilter === tab.key
                      ? "bg-orange-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      userRoleFilter === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {/* 상단 안내 바 */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-orange-600" />
                {realUsersForAdmin.length > 0
                  ? `Firebase 실제 등록 회원 목록 (${realUsersForAdmin.length}명)`
                  : `예시 회원 목록 (${users.length}명)`}
              </span>
              <span className="text-slate-400">
                역할 버튼 클릭 시 권한이 즉시 변경됩니다.
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(() => {
                const targetList = realUsersForAdmin.length > 0 ? realUsersForAdmin : users;
                const filtered = targetList.filter(
                  (u) => userRoleFilter === "all" || u.role === userRoleFilter
                );

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                      <Users className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        선택한 역할({ROLE_LABELS[userRoleFilter as UserRole] || userRoleFilter})의 회원이 없습니다.
                      </p>
                      <p className="text-[11px]">
                        다른 필터 탭을 선택하거나 신규 회원이 가입하면 표시됩니다.
                      </p>
                    </div>
                  );
                }

                return filtered.map((u) => {
                  const isUpdating = updatingUserId === u.id;
                  const st = STATUS_LABELS[u.approvalStatus];
                  return (
                    <div
                      key={u.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            {u.name}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-xs font-bold">
                            {ROLE_LABELS[u.role] || "구성원"}
                          </span>
                          {st && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.style}`}>
                              {st.label}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {u.studentIdOrYear}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>{u.email}</span>
                          <span>·</span>
                          <span className="text-[11px] text-slate-400">UID: {u.id}</span>
                          {u.joinedAt && (
                            <>
                              <span>·</span>
                              <span className="text-[11px] text-slate-400">가입일: {u.joinedAt}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap shrink-0 pt-1 lg:pt-0">
                        <span className="text-xs text-slate-400 mr-1 font-semibold">역할 변경:</span>
                        {(["student", "alumni", "professor", "admin"] as UserRole[]).map(
                          (roleOption) => (
                            <button
                              key={roleOption}
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdateRole(
                                  u.id,
                                  roleOption,
                                  u.approvalStatus,
                                  (u as any).adminComment
                                )
                              }
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
                                u.role === roleOption
                                  ? "bg-orange-600 text-white shadow-xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                            >
                              {ROLE_LABELS[roleOption]}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 탭 3: 공유방 및 게시글 관리 */}
      {activeTab === "rooms_posts" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              복수전공 공유방 확장·수정 관리
            </h2>
            <form
              onSubmit={handleAddDoubleMajorRoom}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-2 text-xs"
            >
              <p className="font-bold text-slate-700 dark:text-slate-200">
                + 새 복수전공 공유방 추가
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newMajorName}
                  onChange={(e) => setNewMajorName(e.target.value)}
                  placeholder="전공명 (예: 사회학, 통계학)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  required
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="공유방 제목 (예: 사회학 복수전공 공유방)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="공유방 설명 입력..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-orange-600 text-white font-bold shrink-0 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 추가
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {communityRooms
                .filter((r) => r.type === "double_major")
                .map((room) => (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                  >
                    {editingRoomId === room.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editRoomCat}
                            onChange={(e) => setEditRoomCat(e.target.value)}
                            className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                          <input
                            type="text"
                            value={editRoomName}
                            onChange={(e) => setEditRoomName(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <input
                          type="text"
                          value={editRoomDesc}
                          onChange={(e) => setEditRoomDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingRoomId(null)}
                            className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditRoom(room.id)}
                            className="px-2.5 py-1 rounded bg-orange-600 text-white font-bold"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-orange-600">
                            [{room.categoryName}]
                          </span>{" "}
                          <span className="font-bold text-slate-900 dark:text-white">
                            {room.name}
                          </span>
                          <p className="text-slate-500 mt-0.5">
                            {room.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditRoom(room)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              공유방 게시글 관리 ({communityPosts.length}건)
            </h2>
            <div className="space-y-2.5 max-h-96 overflow-y-auto">
              {communityPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="text-orange-600 font-bold">
                      [{post.roomName}]
                    </span>{" "}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {post.title}
                    </span>
                    <p className="text-slate-400 mt-0.5">
                      작성자: {post.authorName} · {post.createdAt}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCommunityPost(post.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                    title="게시글 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 탭 4: 신고 내역 관리 */}
      {activeTab === "reports" && (
        <div className="space-y-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
            >
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      rep.status === "처리완료"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {rep.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                    대상: {rep.targetType}
                  </span>
                  <span className="text-xs text-slate-400">{rep.createdAt}</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">
                  {rep.targetTitle}
                </p>
                <p className="text-xs text-slate-500">
                  신고 사유: {rep.reason} (신고자: {rep.reporterName})
                </p>
              </div>

              <button
                type="button"
                onClick={() => resolveReport(rep.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 ${
                  rep.status === "접수됨"
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {rep.status === "접수됨" ? "검토 및 처리완료 전환" : "접수됨으로 되돌리기"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 탭 5: 공통 졸업요건 관리 (관리자 전용 설정, 학생 직접 수정 불가) */}
      {activeTab === "graduation_rules" && (() => {
        const currentCohortRule: OfficialCohortRuleSet =
          graduationCatalog.cohorts[selectedCohortId] ||
          OFFICIAL_GRADUATION_CATALOG.cohorts["2024-2025"];

        const updateCurrentCohortField = async (
          patch: Partial<OfficialCohortRuleSet>
        ) => {
          setCatalogSaving(true);
          setCatalogFeedback(null);
          try {
            const today = new Date().toISOString().slice(0, 10);
            const nextCohort: OfficialCohortRuleSet = {
              ...currentCohortRule,
              ...patch,
              lastVerifiedAt: patch.lastVerifiedAt || today,
            };
            await updateGraduationCatalogByAdmin({
              ...graduationCatalog,
              lastVerifiedAt: today,
              cohorts: {
                ...graduationCatalog.cohorts,
                [selectedCohortId]: nextCohort,
              },
            });
            setCatalogFeedback(
              `✔ [${nextCohort.cohortLabel}] 공통 졸업요건 기준이 저장 및 동기화되었습니다.`
            );
          } catch (err: any) {
            setCatalogFeedback(`오류: ${err?.message || err}`);
          } finally {
            setCatalogSaving(false);
          }
        };

        const handleResetToOfficialPage619 = async () => {
          setCatalogSaving(true);
          setCatalogFeedback(null);
          try {
            await updateGraduationCatalogByAdmin(OFFICIAL_GRADUATION_CATALOG);
            setCatalogFeedback(
              "✔ 공식 학업이수 가이드(https://edu.dongguk.edu/page/619) 초기 기준값으로 복원되었습니다."
            );
          } catch (err: any) {
            setCatalogFeedback(`오류: ${err?.message || err}`);
          } finally {
            setCatalogSaving(false);
          }
        };

        return (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-orange-600" />
                    동국대학교 교육학과 공통 졸업요건 관리 (신입학 재학생 기준)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    공통요건은 학생이 직접 수정할 수 없으며(Firestore 보안 규칙 차단), 관리자가 공식 학업이수 가이드(
                    <a
                      href={graduationCatalog.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-600 font-bold underline inline-flex items-center gap-0.5"
                    >
                      {graduationCatalog.sourceUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                    )를 근거로 관리합니다.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={catalogSaving}
                  onClick={handleResetToOfficialPage619}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 self-start"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 공식 기준(page/619) 초기값 복원
                </button>
              </div>

              {/* 카탈로그 메타데이터 요약 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <div>
                  <span className="text-slate-400 block">기준 버전</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {currentCohortRule.version}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">최종 확인일</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {currentCohortRule.lastVerifiedAt}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">관리자 검토 상태</span>
                  <span
                    className={`font-bold ${
                      currentCohortRule.reviewStatus === "confirmed"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {currentCohortRule.reviewStatus === "confirmed"
                      ? "공식 기준 확인 완료"
                      : "관리자 확인 필요"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">공식 출처 URL</span>
                  <a
                    href={currentCohortRule.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-orange-600 hover:underline truncate block"
                  >
                    {currentCohortRule.sourceUrl}
                  </a>
                </div>
              </div>

              {catalogFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {catalogFeedback}
                </div>
              )}

              {/* 입학 연도 구간 선택 탭 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  입학 연도 구간(적용 교육과정) 선택
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "2014-2015",
                      "2016-2020",
                      "2021-2022",
                      "2023",
                      "2024-2025",
                      "2026",
                    ] as CohortBandId[]
                  ).map((cid) => {
                    const c = graduationCatalog.cohorts[cid];
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => setSelectedCohortId(cid)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                          selectedCohortId === cid
                            ? "bg-orange-600 text-white border-orange-600"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {c?.cohortLabel || cid}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 선택된 입학연도 구간 상세 설정 폼 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-extrabold text-slate-900 dark:text-white block">
                    1. 졸업·전공 이수학점 기준
                  </span>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      총 졸업학점 (신입학)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.totalGraduationCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          totalGraduationCredits: Number(e.target.value) || 130,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      교육학과 단일전공 기준 (사범대 일반 {currentCohortRule.generalSingleMajorCredits} + 대체 12)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.eduSingleMajorCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          eduSingleMajorCredits: Number(e.target.value) || 66,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      교육학과 복수전공 주전공 기준 (사범대 일반 {currentCohortRule.generalDoublePrimaryCredits} + 대체 12)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.eduDoublePrimaryCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          eduDoublePrimaryCredits: Number(e.target.value) || 62,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      사범대 내 타 학과 복수전공 학점
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.eduDoublePartnerCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          eduDoublePartnerCredits: Number(e.target.value) || 50,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-extrabold text-slate-900 dark:text-white block">
                    2. 교양·학문기초·교직·실습 기준
                  </span>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      공통교양(기초교양) 표시 기준 ({currentCohortRule.commonLiberalArtsRangeLabel})
                    </label>
                    <select
                      value={currentCohortRule.commonLiberalArtsStatus}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          commonLiberalArtsStatus: e.target.value as RuleReviewStatus,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    >
                      <option value="confirmed">공식 단일 수치 확정 (confirmed)</option>
                      <option value="needs_admin_review">
                        관리자/요람 확인 필요 (needs_admin_review)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      교육학과 학문기초(외국어영역) 학점
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.academicFoundationCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          academicFoundationCredits: Number(e.target.value) || 6,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      교직 총 이수학점 (이론12 + 소양6 + 실습4~6)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.teachingTotalCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          teachingTotalCredits: Number(e.target.value) || 22,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      교육봉사 기준 시간 (교육봉사1·2 합산)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.volunteeringHours}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          volunteeringHours: Number(e.target.value) || 60,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-extrabold text-slate-900 dark:text-white block">
                    3. 검사·교육·평점 및 메타데이터
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5">
                        인성검사(회)
                      </label>
                      <input
                        type="number"
                        value={currentCohortRule.personalityTestMinCount}
                        onChange={(e) =>
                          updateCurrentCohortField({
                            personalityTestMinCount: Number(e.target.value) || 2,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">
                        심폐소생(회)
                      </label>
                      <input
                        type="number"
                        value={currentCohortRule.cprMinCount}
                        onChange={(e) =>
                          updateCurrentCohortField({
                            cprMinCount: Number(e.target.value) || 2,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">
                        성인지(회)
                      </label>
                      <input
                        type="number"
                        value={currentCohortRule.genderSensitivityMinCount}
                        onChange={(e) =>
                          updateCurrentCohortField({
                            genderSensitivityMinCount: Number(e.target.value) || 2,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5">
                        전공 최저평점
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentCohortRule.majorGpaMin}
                        onChange={(e) =>
                          updateCurrentCohortField({
                            majorGpaMin: Number(e.target.value) || 2.31,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">
                        교직 최저평점
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentCohortRule.teachingGpaMin}
                        onChange={(e) =>
                          updateCurrentCohortField({
                            teachingGpaMin: Number(e.target.value) || 2.75,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      관리자 검토 상태
                    </label>
                    <select
                      value={currentCohortRule.reviewStatus}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          reviewStatus: e.target.value as RuleReviewStatus,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    >
                      <option value="confirmed">공식 기준 확인 완료 (confirmed)</option>
                      <option value="needs_admin_review">
                        관리자 확인 필요 (needs_admin_review)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">
                      관리자 검토 메모
                    </label>
                    <input
                      type="text"
                      value={currentCohortRule.adminMemo}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          adminMemo: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

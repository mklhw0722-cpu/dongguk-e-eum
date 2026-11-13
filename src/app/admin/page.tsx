"use client";

import React, {useState, useMemo } from "react";
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
import { cn, Badge, CountBadge } from "@/components/ui";
import { ADMIN_PROFILE_LOGO_DATA_URL } from "@/lib/adminSymbol";
import {
  REVISION_FIELD_OPTIONS,
  USER_DELETION_DATA_POLICY,
  UserDeletionReport,
  AdminUserRoleCategory,
  AdminUserApprovalFilter,
  filterAndSortAdminUsers,
  sortAdminUsers,
  isRegistrationPendingStatus,
  isFullMemberStatus,
} from "@/lib/memberLifecycle";
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
  Search,
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
  needs_revision: {
    label: "보완 요청됨 (needs_revision)",
    style: "bg-blue-100 text-blue-800",
  },
  supplement_requested: {
    label: "보완 요청됨",
    style: "bg-blue-100 text-blue-800",
  },
  rejected: {
    label: "승인 반려됨",
    style: "bg-rose-100 text-rose-800",
  },
  suspended: {
    label: "이용 정지",
    style: "bg-slate-200 text-ink",
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
    isRealAuthActive,
    authUserProfile,
    graduationCatalog,
    updateGraduationCatalogByAdmin,
    approvedProfessors,
    handleAdminAssignAdvisor,
    handleAdminDeleteUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    "approvals" | "users" | "rooms_posts" | "reports" | "graduation_rules"
  >("approvals");

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // 가입 승인 대상 목록 (승인 대기, 보완 요청, 가입 반려 상태의 신청서만 포함)
  const pendingRealUsers = useMemo(
    () =>
      realUsersForAdmin.filter((u) => isRegistrationPendingStatus(u.approvalStatus)),
    [realUsersForAdmin]
  );
  const pendingApprovalRequests = useMemo(
    () =>
      approvalRequests.filter((r) => isRegistrationPendingStatus(r.status)),
    [approvalRequests]
  );

  // 전체 회원 관리 대상 목록 (가입 승인 완료 회원 및 이용 정지 회원만 포함)
  const fullMembersList = useMemo(() => {
    const rawList = realUsersForAdmin.length > 0 ? realUsersForAdmin : users;
    return rawList.filter((u) => isFullMemberStatus(u.approvalStatus));
  }, [realUsersForAdmin, users]);

  // 회원 삭제 확인 및 단계별 결과 리포트 모달 상태
  const [deleteModalTarget, setDeleteModalTarget] = useState<{
    id: string;
    name: string;
    email?: string;
    role: UserRole;
    approvalStatus?: ApprovalStatus;
  } | null>(null);
  const [deleteModalReport, setDeleteModalReport] =
    useState<UserDeletionReport | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  const handleDeleteUser = (targetUser: {
    id: string;
    name: string;
    email?: string;
    role: UserRole;
    approvalStatus?: ApprovalStatus;
  }) => {
    // 1. 현재 로그인 중인 관리자 본인 계정 삭제 차단
    if (
      authUserProfile?.id === targetUser.id ||
      authUserProfile?.uid === targetUser.id
    ) {
      alert("현재 로그인 중인 관리자 본인 계정은 삭제할 수 없습니다.");
      return;
    }

    // 2. 삭제 확인 및 데이터 처리 범위 안내 모달 열기
    setDeleteModalTarget(targetUser);
    setDeleteModalReport(null);
    setDeleteModalError(null);
  };

  const executeConfirmedDeleteUser = async () => {
    if (!deleteModalTarget) return;
    setDeleteModalError(null);
    setDeletingUserId(deleteModalTarget.id);
    try {
      const report = await handleAdminDeleteUser(deleteModalTarget.id, {
        targetName: deleteModalTarget.name,
        targetEmail: deleteModalTarget.email,
      });
      setDeleteModalReport(report);
      setAdvisorFeedback(
        `'${deleteModalTarget.name}' 회원 삭제 처리가 완료되었습니다. (${report.summaryMessage})`
      );
      setTimeout(() => setAdvisorFeedback(null), 5000);
    } catch (e: any) {
      setDeleteModalError(
        `회원 삭제 처리 중 오류가 발생했습니다: ${e?.message || e}`
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  const [updatingAdvisorStudentId, setUpdatingAdvisorStudentId] = useState<string | null>(null);
  const [advisorFeedback, setAdvisorFeedback] = useState<string | null>(null);

  const handleAssignAdvisor = async (studentId: string, professorId: string | null) => {
    try {
      const target = (realUsersForAdmin.length > 0 ? realUsersForAdmin : users).find(
        (u) => u.id === studentId
      );
      if (professorId && target && target.role !== "student") {
        alert("재학생만 지도교수를 배정받을 수 있습니다. 졸업생, 교수진, 관리자는 지도학생으로 배정될 수 없습니다.");
        return;
      }
      setUpdatingAdvisorStudentId(studentId);
      await handleAdminAssignAdvisor(studentId, professorId);
      setAdvisorFeedback("지도교수-지도학생 배정 정보가 성공적으로 반영되었습니다.");
      setTimeout(() => setAdvisorFeedback(null), 3000);
    } catch (e: any) {
      alert(`지도교수 변경 중 오류가 발생했습니다: ${e?.message || e}`);
    } finally {
      setUpdatingAdvisorStudentId(null);
    }
  };

  // 공통 졸업요건 관리자 편집 상태
  const [selectedCohortId, setSelectedCohortId] =
    useState<CohortBandId>("2024-2025");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogFeedback, setCatalogFeedback] = useState<string | null>(null);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {}
  );
  const [revisionFieldSelects, setRevisionFieldSelects] = useState<
    Record<string, string[]>
  >({});
  const [roleSelects, setRoleSelects] = useState<Record<string, UserRole>>({});
  const [userRoleFilter, setUserRoleFilter] = useState<AdminUserRoleCategory>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<AdminUserApprovalFilter>("all");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
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

      // 재학생이 아닌 역할(졸업생, 교수, 관리자)로 변경될 경우 기존 지도학생 배정 정보 자동 해제
      if (newRole !== "student") {
        const target = (realUsersForAdmin.length > 0 ? realUsersForAdmin : users).find(
          (u) => u.id === targetUserId
        );
        if (target && target.advisorProfessorId) {
          try {
            await handleAdminAssignAdvisor(targetUserId, null);
          } catch (e) {
            console.warn("역할 변경 시 지도교수 해제 경고:", e);
          }
        }
      }
    } catch (err: any) {
      alert(`역할 변경 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // 게시판 관리 탭 및 추가 폼
  const [adminBoardTypeFilter, setAdminBoardTypeFilter] = useState<"all" | "career" | "double_major">("all");
  const [newRoomType, setNewRoomType] = useState<"career" | "double_major">("double_major");
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
    const defaultDesc =
      newRoomType === "career"
        ? `${newMajorName.trim()} 진로 트랙 학우와 졸업생 동문을 위한 정보 게시판입니다.`
        : `${newMajorName.trim()} 복수전공 이수 학우와 졸업생을 위한 정보 게시판입니다.`;

    createCommunityRoom({
      name: newRoomTitle.trim(),
      type: newRoomType,
      categoryName: newMajorName.trim(),
      description: newRoomDesc.trim() || defaultDesc,
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

  // 실제 Firestore 가입 승인 / 보완 요청(needs_revision) / 반려(rejected) 처리
  const onProcessRealUser = async (targetUid: string, status: ApprovalStatus) => {
    const defaultComment =
      status === "approved"
        ? "소속 확인 완료 (정회원 승인)"
        : status === "needs_revision" || status === "supplement_requested"
        ? "가입 신청 정보(학번/소속 확인 메모 등)의 보완이 필요합니다. 정보를 수정한 뒤 다시 승인 요청해 주세요."
        : status === "rejected"
        ? "동국대학교 교육학과 구성원 자격이 확인되지 않아 반려되었습니다."
        : "관리자 검토 처리";
    const comment = (commentInputs[targetUid] || "").trim() || defaultComment;
    const role = roleSelects[targetUid];
    const selectedRevisionFields = revisionFieldSelects[targetUid] || [];
    await handleAdminUpdateApproval(
      targetUid,
      status,
      comment,
      role,
      selectedRevisionFields
    );
    setCommentInputs((prev) => ({ ...prev, [targetUid]: "" }));
  };

  const toggleRevisionField = (targetUid: string, fieldKey: string) => {
    setRevisionFieldSelects((prev) => {
      const current = prev[targetUid] || [];
      const next = current.includes(fieldKey)
        ? current.filter((k) => k !== fieldKey)
        : [...current, fieldKey];
      return { ...prev, [targetUid]: next };
    });
  };

  // 2차 방어: 관리자 권한이 없거나 미승인 사용자인 경우 관리자 콘솔 렌더링 차단
  if (!authUserProfile || authUserProfile.role !== "admin" || authUserProfile.approvalStatus !== "approved") {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-surface rounded-3xl border border-rose-300 text-center space-y-4 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-ink">
          관리자 전용 구역 접근 제한 (403 Forbidden)
        </h2>
        <p className="text-xs sm:text-sm text-ink-2 leading-relaxed">
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
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            <h1 className="text-xl sm:text-2xl font-black text-ink">
              동국e음 관리자 센터 (회원 승인 및 운영)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-ink-3 mt-1">
            Firebase Firestore 실제 가입 신청자 승인·거절, 사용자 권한 관리, 게시판 및 신고 내역을 관리합니다.
          </p>
        </div>
      </div>



      {/* 접속 중인 관리자 프로필 및 이름 변경 섹션 */}
      <div className="bg-surface rounded-3xl border border-line p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface border border-accent-line flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
            <img
              src={ADMIN_PROFILE_LOGO_DATA_URL}
              alt="동국대학교 관리자 로고"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-ink">
                {authUserProfile.name || "시스템 관리자"}
              </span>
              <span className="px-2 py-0.5 rounded bg-orange-100 text-brand-700 text-xs font-bold">
                최고 관리자
              </span>
            </div>
            <p className="text-xs text-ink-3 mt-0.5">{authUserProfile.email}</p>
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
                className="px-3 py-1.5 rounded-xl border border-line bg-surface-2 text-xs font-semibold focus:outline-orange-600"
                autoFocus
              />
              <button
                type="submit"
                disabled={!adminNameInput.trim() || isAdminNameSaving}
                className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isAdminNameSaving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingAdminName(false)}
                className="px-2.5 py-1.5 rounded-xl border border-line text-xs text-ink-3 font-semibold"
              >
                취소
              </button>
            </form>
          ) : (
            <>
              
              <button
                type="button"
                onClick={() => {
                  setAdminNameInput(authUserProfile.name || "이혜원");
                  setIsEditingAdminName(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-ink-2 text-xs font-bold transition"
              >
                직접 수정
              </button>
            </>
          )}
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-surface p-2 rounded-2xl border border-line">
        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "approvals"
              ? "bg-brand-600 text-white"
              : "text-ink-2  hover:bg-slate-100"
          }`}
        >
          <UserCheck className="w-4 h-4" /> 가입 승인 관리 (
          {isFirestoreConnected && realUsersForAdmin.length > 0 ? pendingRealUsers.length : pendingApprovalRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "users"
              ? "bg-brand-600 text-white"
              : "text-ink-2  hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" /> 전체 회원 관리 (
          {fullMembersList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("graduation_rules")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "graduation_rules"
              ? "bg-brand-600 text-white"
              : "text-ink-2  hover:bg-slate-100"
          }`}
        >
          <GraduationCap className="w-4 h-4" /> 공통 졸업요건 관리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rooms_posts")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "rooms_posts"
              ? "bg-brand-600 text-white"
              : "text-ink-2  hover:bg-slate-100"
          }`}
        >
          <Compass className="w-4 h-4" /> 게시판·게시글 관리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === "reports"
              ? "bg-brand-600 text-white"
              : "text-ink-2  hover:bg-slate-100"
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
              <h2 className="text-sm font-black text-ink flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Firebase 가입 승인 대기자 실시간 목록 ({pendingRealUsers.length}명)
              </h2>

              {pendingRealUsers.length === 0 ? (
                <div className="p-8 rounded-3xl bg-surface border border-line text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm sm:text-base font-bold text-ink">
                    현재 승인 대기 중인 가입 신청이 없습니다.
                  </p>
                  <p className="text-xs text-ink-3">
                    모든 가입 신청자의 승인이 완료되었습니다. 승인 완료된 회원은 상단의 <strong>[전체 회원 관리]</strong> 탭에서 확인 및 권한을 관리하실 수 있습니다.
                  </p>
                </div>
              ) : (
                pendingRealUsers.map((userDoc) => {
                  const st = STATUS_LABELS[userDoc.approvalStatus] || STATUS_LABELS.pending;
                  return (
                    <div
                      key={userDoc.id}
                      className="bg-surface rounded-3xl border border-line p-5 sm:p-6 space-y-3 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.style}`}
                          >
                            {st.label}
                          </span>
                          {(userDoc.revisionCount ?? 0) > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                              재신청 완료 ({userDoc.revisionCount}회차)
                            </span>
                          )}
                          <span className="font-extrabold text-sm sm:text-base text-ink">
                            {userDoc.name}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold">
                            신청 역할: {ROLE_LABELS[userDoc.role]}{userDoc.role !== "admin" && userDoc.studentIdOrYear ? ` (${userDoc.studentIdOrYear})` : ""}
                          </span>
                        </div>
                        <div className="text-xs text-ink-3 flex items-center gap-2">
                          <span>가입일: {userDoc.joinedAt}</span>
                          {userDoc.resubmittedAt && (
                            <span className="text-indigo-700 font-bold">
                              · 재신청: {userDoc.resubmittedAt.slice(0, 16).replace("T", " ")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-2 bg-surface-2 p-3.5 rounded-xl">
                        <p>
                          <strong>이메일:</strong> {userDoc.email}
                        </p>
                        <p>
                          <strong>UID:</strong> <code className="text-xs">{userDoc.id}</code>
                        </p>
                        {userDoc.doubleMajor && (
                          <p>
                            <strong>복수전공/트랙:</strong> {userDoc.doubleMajor}
                          </p>
                        )}
                        {userDoc.verificationNote && (
                          <p className="sm:col-span-2">
                            <strong>가입 신청 메모:</strong> {userDoc.verificationNote}
                          </p>
                        )}
                        {userDoc.revisionFields && userDoc.revisionFields.length > 0 && (
                          <p className="sm:col-span-2 text-blue-700 font-semibold">
                            <strong>보완 요청 항목:</strong>{" "}
                            {userDoc.revisionFields
                              .map(
                                (fk) =>
                                  REVISION_FIELD_OPTIONS.find((o) => o.key === fk)
                                    ?.label || fk
                              )
                              .join(", ")}
                          </p>
                        )}
                        {userDoc.adminComment && (
                          <p className="sm:col-span-2 text-brand-600 font-semibold">
                            <strong>관리자 메시지:</strong> {userDoc.adminComment}
                          </p>
                        )}
                      </div>

                      {/* 보완 요청 시 보완 필요 항목 체크박스 선택 */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="font-bold text-ink-3">
                          보완 요청 시 수정 필요 항목 지정 (선택):
                        </span>
                        {REVISION_FIELD_OPTIONS.map((opt) => {
                          const selected = (
                            revisionFieldSelects[userDoc.id] ||
                            userDoc.revisionFields ||
                            []
                          ).includes(opt.key);
                          return (
                            <label
                              key={opt.key}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer transition ${
                                selected
                                  ? "bg-blue-50 border-blue-400 text-blue-900 font-bold"
                                  : "bg-surface border-line text-ink-2 hover:bg-surface-2"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  toggleRevisionField(userDoc.id, opt.key)
                                }
                                className="rounded border-slate-300 text-blue-600"
                              />
                              <span>{opt.label}</span>
                            </label>
                          );
                        })}
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
                          className="px-2.5 py-2 rounded-xl border border-line bg-surface-2 text-xs font-semibold"
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
                          placeholder="승인 / 보완 요청 사유 / 반려 사유 입력..."
                          className="flex-1 px-3 py-2 rounded-xl border border-line bg-surface-2 text-xs"
                        />

                        <div className="flex gap-1.5 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onProcessRealUser(userDoc.id, "approved")}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                          </button>
                          <button
                            type="button"
                            onClick={() => onProcessRealUser(userDoc.id, "needs_revision")}
                            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <AlertCircle className="w-3.5 h-3.5" /> 보완 요청
                          </button>
                          <button
                            type="button"
                            onClick={() => onProcessRealUser(userDoc.id, "rejected")}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> 반려
                          </button>
                          <button
                            type="button"
                            onClick={() => onProcessRealUser(userDoc.id, "suspended")}
                            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            이용 정지
                          </button>
                          <button
                            type="button"
                            disabled={deletingUserId === userDoc.id}
                            onClick={() => handleDeleteUser(userDoc)}
                            title="가입 신청 회원 삭제"
                            className="px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-600 hover:bg-rose-100 text-xs font-bold inline-flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingUserId === userDoc.id ? "삭제 중" : "삭제"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 오프라인 시연용 가입 신청 목록 (Firebase 연결 시에는 예시 데이터를 노출하지 않음) */}
          {!isFirestoreConnected && !isRealAuthActive && realUsersForAdmin.length === 0 && (
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-bold text-ink-3">
              가입 신청 목록
            </h2>

            {pendingApprovalRequests.map((req) => {
              const st = STATUS_LABELS[req.status];
              return (
                <div
                  key={req.id}
                  className="bg-surface rounded-3xl border border-line p-5 sm:p-6 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.style}`}
                      >
                        {st.label}
                      </span>
                      <span className="font-extrabold text-sm sm:text-base text-ink">
                        {req.applicantName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold">
                        신청 역할: {ROLE_LABELS[req.requestedRole]}
                      </span>
                    </div>
                    <span className="text-xs text-ink-3">
                      신청일시: {req.submittedAt}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-2 bg-surface-2 p-3.5 rounded-xl">
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
                      <p className="sm:col-span-2 text-brand-600 font-semibold">
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
                      className="flex-1 px-3 py-2 rounded-xl border border-line bg-surface-2 text-xs"
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
          )}
        </div>
      )}

      {/* 탭 2: 사용자 역할 관리 */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {advisorFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{advisorFeedback}</span>
            </div>
          )}

          {/* 1. 회원 유형별 목록 구분 탭 (재학생, 졸업생, 교수진, 관리자, 전체 회원) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: "all", label: "전체 회원" },
              { key: "student", label: "재학생" },
              { key: "alumni", label: "졸업생" },
              { key: "professor", label: "교수진" },
              { key: "admin", label: "관리자" },
            ].map((tab) => {
              const count = fullMembersList.filter(
                (u) => tab.key === "all" || u.role === tab.key
              ).length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setUserRoleFilter(tab.key as AdminUserRoleCategory)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    userRoleFilter === tab.key
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-surface border border-line text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs font-black ${
                      userRoleFilter === tab.key
                        ? "bg-surface/20 text-white"
                        : "bg-slate-100 text-ink-3"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. 검색 및 승인 상태별 필터 도구 모음 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface p-3 rounded-2xl border border-line shadow-2xs">
            {/* 검색창 */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="회원 이름, 학번, 이메일, UID, 복수전공 검색..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-line bg-surface-2 text-xs font-semibold text-ink placeholder:text-ink-3 focus:outline-orange-600"
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink text-xs font-bold p-0.5"
                  title="검색어 초기화"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 승인 상태별 필터 */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-bold text-ink-3 shrink-0">
                승인 상태:
              </label>
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as AdminUserApprovalFilter)}
                className="px-3 py-2 rounded-xl border border-line bg-surface-2 text-xs font-semibold text-ink focus:outline-orange-600"
              >
                <option value="all">전체 승인 상태 (승인 완료 & 이용 정지)</option>
                <option value="approved">승인 완료 (정상 이용 중)</option>
                <option value="suspended">이용 정지</option>
              </select>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-xs">
            {/* 상단 안내 바 및 정렬 기준 안내 */}
            {(() => {
              const targetList = fullMembersList;
              const filteredUsers = filterAndSortAdminUsers(targetList, {
                roleFilter: userRoleFilter,
                statusFilter: userStatusFilter,
                searchQuery: userSearchQuery,
                onlyFullMembers: true,
              });

              const sortLabel =
                userRoleFilter === "student"
                  ? "정렬: 학번 오름차순 (20학번 → 26학번) · 이름 가나다순"
                  : userRoleFilter === "alumni"
                  ? "정렬: 입학 학번 오름차순 (졸업연도 제외) · 이름 가나다순"
                  : userRoleFilter === "professor"
                  ? "정렬: 교수 성함 가나다순"
                  : userRoleFilter === "admin"
                  ? "정렬: 관리자 성함 가나다순"
                  : "정렬: 재학생 → 졸업생 → 교수진 → 관리자 순서 및 유형별 정렬";

              return (
                <>
                  <div className="px-5 py-3 bg-surface-2 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink-2 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-brand-600" />
                        승인 완료 정회원 목록 ({fullMembersList.length}명 중 {filteredUsers.length}명 표시)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-ink-2 text-[11px] font-bold">
                        {sortLabel}
                      </span>
                    </div>
                    <span className="text-ink-3">
                      역할 버튼 클릭 시 권한이 즉시 변경됩니다.
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-xs text-ink-3 space-y-2">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                        <p className="font-bold text-sm text-ink-2">
                          해당 조건에 일치하는 회원이 없습니다.
                        </p>
                        <p className="text-xs text-ink-3">
                          {userSearchQuery || userStatusFilter !== "all"
                            ? "검색어 또는 승인 상태 필터를 변경해 보세요."
                            : "선택한 역할 카테고리에 등록된 회원이 없습니다."}
                        </p>
                        {(userSearchQuery || userStatusFilter !== "all") && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserSearchQuery("");
                              setUserStatusFilter("all");
                            }}
                            className="mt-2 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-2 text-xs font-bold text-brand-600 transition"
                          >
                            검색 및 필터 초기화
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isUpdating = updatingUserId === u.id;
                        const st = STATUS_LABELS[u.approvalStatus];
                        return (
                    <div
                      key={u.id}
                      className="p-4 flex flex-col gap-3 hover:bg-surface-2 transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm sm:text-base text-ink">
                              {u.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-orange-100 text-brand-700 text-xs font-bold">
                              {ROLE_LABELS[u.role] || "구성원"}
                            </span>
                            {st && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st.style}`}>
                                {st.label}
                              </span>
                            )}
                            <span className="text-xs text-ink-3">
                              {u.studentIdOrYear}
                            </span>
                          </div>
                          <p className="text-xs text-ink-3 flex items-center gap-2 flex-wrap">
                            <span>{u.email}</span>
                            <span>·</span>
                            <span className="text-xs text-ink-3">UID: {u.id}</span>
                            {u.joinedAt && (
                              <>
                                <span>·</span>
                                <span className="text-xs text-ink-3">가입일: {u.joinedAt}</span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0 pt-1 lg:pt-0">
                          <span className="text-xs text-ink-3 mr-1 font-semibold">역할 변경:</span>
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
                                    ? "bg-brand-600 text-white shadow-xs"
                                    : "bg-slate-100  text-ink-2  hover:bg-slate-200"
                                }`}
                              >
                                {ROLE_LABELS[roleOption]}
                              </button>
                            )
                          )}
                        
                          {/* 회원 완전 삭제 버튼 */}
                          <button
                            type="button"
                            disabled={deletingUserId === u.id || isUpdating}
                            onClick={() => handleDeleteUser(u)}
                            title="회원 영구 삭제"
                            className="ml-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-600 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingUserId === u.id ? "삭제 중..." : "회원 삭제"}</span>
                          </button>
                        </div>
                      </div>

                      {/* 재학생 전용: 배정된 지도교수 정보 표시 (배정/변경은 교수 회원 카드에서만 수행) */}
                      {u.role === "student" && (
                        <div className="w-full mt-1 pt-2.5 border-t border-line flex items-center justify-between gap-2.5 bg-accent-soft/50 px-3 py-2 rounded-xl">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <GraduationCap className="w-4 h-4 text-brand-600 shrink-0" />
                            <span className="font-bold text-ink-2">
                              배정된 지도교수:
                            </span>
                            {(() => {
                              const assignedProf = approvedProfessors.find(
                                (p) => p.id === u.advisorProfessorId || (p as any).uid === u.advisorProfessorId
                              );
                              if (assignedProf) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-brand-700 font-extrabold text-xs">
                                    {assignedProf.name}
                                    {assignedProf.specialty ? ` (${assignedProf.specialty})` : ""}
                                  </span>
                                );
                              }
                              if (u.advisorProfessorId) {
                                return (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold text-xs">
                                    계정 상태 확인 필요 (UID: {u.advisorProfessorId})
                                  </span>
                                );
                              }
                              return (
                                <span className="text-ink-3 font-medium">
                                  지도교수 미등록
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 교수진 전용: 교수 계정 아래 지도학생(재학생만) 배정 및 관리 */}
                      {u.role === "professor" && (
                        <div className="w-full mt-1 pt-2.5 border-t border-line space-y-2.5 bg-emerald-50/50 px-3.5 py-3 rounded-xl">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-extrabold text-ink">
                                배정된 지도학생 (재학생):
                              </span>
                              {(() => {
                                const assignedStudents = targetList.filter(
                                  (s) =>
                                    s.role === "student" &&
                                    (s.advisorProfessorId === u.id ||
                                      (s as any).advisorProfessorId === (u as any).uid)
                                );
                                return (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                                    총 {assignedStudents.length}명
                                  </span>
                                );
                              })()}
                            </div>

                            {/* 새 지도학생(재학생만) 배정 드롭다운 */}
                            <div className="flex items-center gap-2 shrink-0">
                              <label className="text-xs font-bold text-ink-2 shrink-0">
                                + 지도학생 배정 (재학생만):
                              </label>
                              <select
                                defaultValue=""
                                disabled={updatingAdvisorStudentId !== null}
                                onChange={(e) => {
                                  const selectedStudentId = e.target.value;
                                  if (selectedStudentId) {
                                    handleAssignAdvisor(selectedStudentId, u.id);
                                    e.target.value = "";
                                  }
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-line bg-surface text-ink focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                              >
                                <option value="">-- 배정할 재학생 선택 --</option>
                                {sortAdminUsers(
                                  targetList.filter(
                                    (s) =>
                                      s.role === "student" &&
                                      s.id !== u.id &&
                                      s.approvalStatus === "approved"
                                  ),
                                  "student"
                                ).map((student) => {
                                    const isAlreadyAssignedToMe =
                                      student.advisorProfessorId === u.id ||
                                      (student as any).advisorProfessorId === (u as any).uid;
                                    const otherAdvisor =
                                      !isAlreadyAssignedToMe && student.advisorProfessorId
                                        ? approvedProfessors.find(
                                            (p) =>
                                              p.id === student.advisorProfessorId ||
                                              (p as any).uid === student.advisorProfessorId
                                          )
                                        : null;

                                    return (
                                      <option
                                        key={student.id}
                                        value={student.id}
                                        disabled={isAlreadyAssignedToMe}
                                      >
                                        {student.name} ({student.studentIdOrYear || "재학생"})
                                        {isAlreadyAssignedToMe
                                          ? " [이미 배정됨]"
                                          : otherAdvisor
                                          ? ` [현재 지도: ${otherAdvisor.name} 교수]`
                                          : " [미배정]"}
                                      </option>
                                    );
                                  })}
                              </select>
                            </div>
                          </div>

                          {/* 배정된 지도학생 태그 목록 */}
                          {(() => {
                            const assignedStudents = targetList.filter(
                              (s) =>
                                s.role === "student" &&
                                (s.advisorProfessorId === u.id ||
                                  (s as any).advisorProfessorId === (u as any).uid)
                            );

                            if (assignedStudents.length === 0) {
                              return (
                                <p className="text-xs text-ink-3 font-medium pl-6">
                                  현재 이 교수님 계정 아래로 배정된 지도학생이 없습니다. 위 드롭다운에서 재학생을 선택해 배정할 수 있습니다.
                                </p>
                              );
                            }

                            return (
                              <div className="flex items-center gap-2 flex-wrap pl-6 pt-1">
                                {assignedStudents.map((st) => (
                                  <span
                                    key={st.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface border border-emerald-200 text-ink text-xs shadow-2xs font-bold"
                                  >
                                    <span className="text-emerald-600">●</span>
                                    <span>{st.name}</span>
                                    {st.studentIdOrYear && (
                                      <span className="text-xs text-ink-3 font-normal">
                                        ({st.studentIdOrYear})
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      disabled={updatingAdvisorStudentId === st.id}
                                      onClick={() => handleAssignAdvisor(st.id, null)}
                                      title="지도학생 배정 해제"
                                      className="ml-1 p-0.5 rounded hover:bg-rose-50 text-ink-3 hover:text-rose-600 transition"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                }))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  )}

      {/* 탭 3: 게시판 및 게시글 관리 */}
      {activeTab === "rooms_posts" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-3xl border border-line p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-ink">
                진로 트랙 및 복수전공 게시판 관리
              </h2>
              {/* 구분 필터 (전체 / 진로 트랙 / 복수전공) */}
              <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAdminBoardTypeFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition",
                    adminBoardTypeFilter === "all"
                      ? "bg-brand-600 text-white shadow-2xs"
                      : "text-ink-2 hover:text-ink"
                  )}
                >
                  전체 ({communityRooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminBoardTypeFilter("career")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition",
                    adminBoardTypeFilter === "career"
                      ? "bg-brand-600 text-white shadow-2xs"
                      : "text-ink-2 hover:text-ink"
                  )}
                >
                  진로 트랙 ({communityRooms.filter((r) => r.type === "career").length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminBoardTypeFilter("double_major")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition",
                    adminBoardTypeFilter === "double_major"
                      ? "bg-brand-600 text-white shadow-2xs"
                      : "text-ink-2 hover:text-ink"
                  )}
                >
                  복수전공 ({communityRooms.filter((r) => r.type === "double_major").length})
                </button>
              </div>
            </div>

            <form
              onSubmit={handleAddDoubleMajorRoom}
              className="p-3.5 rounded-2xl bg-surface-2 border border-line space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-ink-2">
                  + 새 게시판 추가
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="boardType"
                      checked={newRoomType === "career"}
                      onChange={() => setNewRoomType("career")}
                    />
                    <span>진로 트랙</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="boardType"
                      checked={newRoomType === "double_major"}
                      onChange={() => setNewRoomType("double_major")}
                    />
                    <span>복수전공</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newMajorName}
                  onChange={(e) => setNewMajorName(e.target.value)}
                  placeholder={
                    newRoomType === "career"
                      ? "분야명 (예: 미디어/콘텐츠, 대학원)"
                      : "전공명 (예: 사회학, 통계학)"
                  }
                  className="px-3 py-2 rounded-xl border border-line bg-surface"
                />
                <input
                  type="text"
                  required
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder={
                    newRoomType === "career"
                      ? "게시판 제목 (예: 미디어·콘텐츠 제작 트랙 게시판)"
                      : "게시판 제목 (예: 사회학 복수전공 게시판)"
                  }
                  className="px-3 py-2 rounded-xl border border-line bg-surface"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="게시판 소개 및 설명 입력..."
                  className="flex-1 px-3 py-2 rounded-xl border border-line bg-surface"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-brand-600 text-white font-bold shrink-0 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 추가
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {communityRooms
                .filter(
                  (r) =>
                    adminBoardTypeFilter === "all" || r.type === adminBoardTypeFilter
                )
                .map((room) => (
                  <div
                    key={room.id}
                    className="p-3 rounded-xl border border-line text-xs space-y-2 bg-surface"
                  >
                    {editingRoomId === room.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-ink-3">
                            [{room.type === "career" ? "진로 트랙" : "복수전공"}]
                          </span>
                          <input
                            type="text"
                            value={editRoomCat}
                            onChange={(e) => setEditRoomCat(e.target.value)}
                            placeholder="분류/분야명"
                            className="w-32 px-2.5 py-1.5 rounded-lg border border-line bg-surface"
                          />
                          <input
                            type="text"
                            value={editRoomName}
                            onChange={(e) => setEditRoomName(e.target.value)}
                            placeholder="게시판 제목"
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface"
                          />
                        </div>
                        <input
                          type="text"
                          value={editRoomDesc}
                          onChange={(e) => setEditRoomDesc(e.target.value)}
                          placeholder="게시판 설명"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingRoomId(null)}
                            className="px-2.5 py-1 rounded-lg bg-surface-2 border border-line text-ink-2 font-medium"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditRoom(room.id)}
                            className="px-2.5 py-1 rounded-lg bg-brand-600 text-white font-bold"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5",
                              room.type === "career"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            )}
                          >
                            {room.type === "career" ? "진로 트랙" : "복수전공"}
                          </span>
                          <span className="font-bold text-brand-600">
                            [{room.categoryName}]
                          </span>{" "}
                          <span className="font-bold text-ink">
                            {room.name}
                          </span>
                          <p className="text-ink-3 mt-0.5">
                            {room.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditRoom(room)}
                          className="px-2.5 py-1 rounded-lg border border-line font-semibold shrink-0 hover:bg-surface-2 cursor-pointer"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-surface rounded-3xl border border-line p-5 sm:p-6 space-y-4 shadow-xs">
            <h2 className="text-base font-extrabold text-ink">
              게시판 게시글 관리 ({communityPosts.length}건)
            </h2>
            <div className="space-y-2.5 max-h-96 overflow-y-auto">
              {communityPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3.5 rounded-xl border border-line flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="text-brand-600 font-bold">
                      [{post.roomName}]
                    </span>{" "}
                    <span className="font-bold text-ink">
                      {post.title}
                    </span>
                    <p className="text-ink-3 mt-0.5">
                      작성자: {post.authorName} · {post.createdAt}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCommunityPost(post.id)}
                    className="p-1.5 rounded-lg text-ink-3 hover:text-rose-600 hover:bg-rose-50 shrink-0"
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
              className="bg-surface rounded-3xl border border-line p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
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
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold">
                    대상: {rep.targetType}
                  </span>
                  <span className="text-xs text-ink-3">{rep.createdAt}</span>
                </div>
                <p className="font-bold text-ink">
                  {rep.targetTitle}
                </p>
                <p className="text-xs text-ink-3">
                  신고 사유: {rep.reason} (신고자: {rep.reporterName})
                </p>
              </div>

              <button
                type="button"
                onClick={() => resolveReport(rep.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 ${
                  rep.status === "접수됨"
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "bg-slate-200  text-ink-2 "
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
            <div className="bg-surface rounded-3xl border border-line p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-ink flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-brand-600" />
                    동국대학교 교육학과 공통 졸업요건 관리 (신입학 재학생 기준)
                  </h2>
                  <p className="text-xs text-ink-3 mt-1">
                    공통요건은 학생이 직접 수정할 수 없으며(Firestore 보안 규칙 차단), 관리자가 공식 학업이수 가이드(
                    <a
                      href={graduationCatalog.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 font-bold underline inline-flex items-center gap-0.5"
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
                  className="px-3.5 py-2 rounded-xl border border-line hover:bg-surface-2 text-xs font-bold inline-flex items-center gap-1.5 self-start"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 공식 기준(page/619) 초기값 복원
                </button>
              </div>

              {/* 카탈로그 메타데이터 요약 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-surface-2 text-xs">
                <div>
                  <span className="text-ink-3 block">기준 버전</span>
                  <span className="font-bold text-ink">
                    {currentCohortRule.version}
                  </span>
                </div>
                <div>
                  <span className="text-ink-3 block">최종 확인일</span>
                  <span className="font-bold text-ink">
                    {currentCohortRule.lastVerifiedAt}
                  </span>
                </div>
                <div>
                  <span className="text-ink-3 block">관리자 검토 상태</span>
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
                  <span className="text-ink-3 block">공식 출처 URL</span>
                  <a
                    href={currentCohortRule.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-brand-600 hover:underline truncate block"
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
                <label className="block text-xs font-bold text-ink-2">
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
                            ? "bg-brand-600 text-white border-orange-600"
                            : "bg-surface  border-line  text-ink-2 "
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
                <div className="p-3.5 rounded-xl border border-line space-y-2">
                  <span className="font-extrabold text-ink block">
                    1. 졸업·전공 이수학점 기준
                  </span>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
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
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
                      교육학과 단일전공 기준 (전공필수 36학점 + 전공선택 30학점 = 66학점)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.eduSingleMajorCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          eduSingleMajorCredits: Number(e.target.value) || 66,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
                      교육학과 복수전공 주전공 기준 (전공필수 36학점 필수)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.eduDoublePrimaryCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          eduDoublePrimaryCredits: Number(e.target.value) || 62,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
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
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-line space-y-2">
                  <span className="font-extrabold text-ink block">
                    2. 교양·학문기초·교직·실습 기준
                  </span>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
                      공통교양(기초교양) 표시 기준 ({currentCohortRule.commonLiberalArtsRangeLabel})
                    </label>
                    <select
                      value={currentCohortRule.commonLiberalArtsStatus}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          commonLiberalArtsStatus: e.target.value as RuleReviewStatus,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    >
                      <option value="confirmed">공식 단일 수치 확정 (confirmed)</option>
                      <option value="needs_admin_review">
                        관리자/요람 확인 필요 (needs_admin_review)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
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
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
                      교직 총 이수학점 (교직소양 6 + 교육실습 4 = 10학점)
                    </label>
                    <input
                      type="number"
                      value={currentCohortRule.teachingTotalCredits}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          teachingTotalCredits: Number(e.target.value) || 10,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
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
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-line space-y-2">
                  <span className="font-extrabold text-ink block">
                    3. 검사·교육·평점 및 메타데이터
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-ink-3 block mb-0.5">
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
                        className="w-full px-2 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-ink-3 block mb-0.5">
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
                        className="w-full px-2 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-ink-3 block mb-0.5">
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
                        className="w-full px-2 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-ink-3 block mb-0.5">
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
                        className="w-full px-2 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-ink-3 block mb-0.5">
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
                        className="w-full px-2 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
                      관리자 검토 상태
                    </label>
                    <select
                      value={currentCohortRule.reviewStatus}
                      onChange={(e) =>
                        updateCurrentCohortField({
                          reviewStatus: e.target.value as RuleReviewStatus,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2 font-bold"
                    >
                      <option value="confirmed">공식 기준 확인 완료 (confirmed)</option>
                      <option value="needs_admin_review">
                        관리자 확인 필요 (needs_admin_review)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-0.5">
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
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 회원 삭제 확인 및 단계별 데이터 처리 결과 모달 */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl border border-line max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-ink">
                    {deleteModalReport
                      ? "회원 삭제 단계별 처리 결과 리포트"
                      : "회원 삭제 확인 및 데이터 처리 범위 안내"}
                  </h3>
                  <p className="text-xs text-ink-3">
                    개인정보 삭제 범위와 공동 데이터(게시글·단체 대화) 보호 기준을 확인합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={deletingUserId !== null}
                onClick={() => {
                  setDeleteModalTarget(null);
                  setDeleteModalReport(null);
                  setDeleteModalError(null);
                }}
                className="text-xs font-bold text-ink-3 hover:text-ink px-2 py-1 rounded-lg"
              >
                닫기 ✕
              </button>
            </div>

            {/* 삭제 대상 회원 식별 정보 (UID, 이름, 이메일) */}
            <div className="p-4 rounded-2xl bg-surface-2 border border-line text-xs space-y-1.5">
              <p className="font-extrabold text-ink text-sm">
                삭제 대상 회원 정보 확인
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-ink-2">
                <p>
                  • <strong>이름:</strong> {deleteModalTarget.name} (
                  {ROLE_LABELS[deleteModalTarget.role] || deleteModalTarget.role})
                </p>
                <p>
                  • <strong>이메일:</strong>{" "}
                  {deleteModalTarget.email || "이메일 정보 없음"}
                </p>
                <p className="sm:col-span-2">
                  • <strong>대상 UID:</strong>{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-[11px]">
                    {deleteModalTarget.id}
                  </code>
                </p>
              </div>
            </div>

            {/* 실행 전: 데이터 처리 범위 안내 */}
            {!deleteModalReport && (
              <div className="space-y-3 text-xs">
                <p className="font-extrabold text-ink">
                  회원 삭제 시 연결 데이터 처리 범위
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {USER_DELETION_DATA_POLICY.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl border border-line bg-surface flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-ink">{item.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.policyType === "delete"
                              ? "bg-rose-100 text-rose-800"
                              : item.policyType === "preserve_shared"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.policyType === "anonymize_or_detach"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.policyType === "delete"
                            ? "개인정보 즉시 삭제"
                            : item.policyType === "preserve_shared"
                            ? "공동 기록 보존"
                            : item.policyType === "anonymize_or_detach"
                            ? "참조 분리 · 타 회원 기록 보호"
                            : "서버 삭제 또는 재가입 자동 복구"}
                        </span>
                      </div>
                      <p className="text-ink-3 text-[11px] leading-relaxed">
                        {item.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 진행 중 상태 표시 */}
            {deletingUserId === deleteModalTarget.id && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                <span>
                  회원 문서 및 연결 데이터를 단계별로 안전하게 정리하고 있습니다. 잠시만 기다려 주세요...
                </span>
              </div>
            )}

            {/* 에러 메시지 */}
            {deleteModalError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold space-y-2">
                <p>{deleteModalError}</p>
              </div>
            )}

            {/* 실행 후: 단계별 검증 결과 리포트 */}
            {deleteModalReport && (
              <div className="space-y-3 text-xs">
                <div
                  className={`p-4 rounded-2xl border font-bold leading-relaxed ${
                    deleteModalReport.overallStatus === "partial_failure"
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : deleteModalReport.overallStatus === "completed_all"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <p className="text-sm font-black mb-1">
                    {deleteModalReport.overallStatus === "partial_failure"
                      ? "⚠️ 일부 단계 처리 실패 (재시도 가능)"
                      : deleteModalReport.overallStatus === "completed_all"
                      ? "✅ 모든 데이터 및 인증 계정 삭제 완료"
                      : "✅ Firestore 개인 데이터 삭제 완료 (동일 이메일 재가입 복구 활성화)"}
                  </p>
                  <p className="font-medium">{deleteModalReport.summaryMessage}</p>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {deleteModalReport.steps.map((step) => (
                    <div
                      key={step.key}
                      className="p-2.5 rounded-xl border border-line bg-surface-2 flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-ink">{step.label}</p>
                        <p className="text-[11px] text-ink-3 mt-0.5">
                          {step.detail}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          step.status === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : step.status === "failed"
                            ? "bg-rose-100 text-rose-800"
                            : step.status === "skipped"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {step.status === "success"
                          ? "삭제·정리 완료"
                          : step.status === "failed"
                          ? "실패 (재시도 필요)"
                          : step.status === "skipped"
                          ? "정책상 보존"
                          : "재가입 자동 복구 지원"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 하단 액션 버튼 */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-line">
              {!deleteModalReport ? (
                <>
                  <button
                    type="button"
                    disabled={deletingUserId !== null}
                    onClick={() => setDeleteModalTarget(null)}
                    className="px-4 py-2 rounded-xl border border-line bg-surface hover:bg-surface-2 text-xs font-bold text-ink-2 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={deletingUserId !== null}
                    onClick={executeConfirmedDeleteUser}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingUserId !== null
                      ? "삭제 진행 중..."
                      : "위 내용을 확인했으며 회원 삭제 실행"}
                  </button>
                </>
              ) : (
                <>
                  {deleteModalReport.failedSteps.length > 0 && (
                    <button
                      type="button"
                      disabled={deletingUserId !== null}
                      onClick={executeConfirmedDeleteUser}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      실패 단계 다시 시도
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModalTarget(null);
                      setDeleteModalReport(null);
                      setDeleteModalError(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    확인 및 닫기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

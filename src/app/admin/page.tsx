"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { ApprovalStatus, UserRole } from "@/types";
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
    isFirestoreConnected,
    authUserProfile,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    "approvals" | "users" | "rooms_posts" | "reports"
  >("approvals");

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {}
  );
  const [roleSelects, setRoleSelects] = useState<Record<string, UserRole>>({});

  // 복수전공 공유방 추가 폼
  const [newMajorName, setNewMajorName] = useState("");
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  // 공유방 수정 상태
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
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

      {/* 탭 메뉴 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
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
          <Users className="w-4 h-4" /> 사용자 역할 관리 ({users.length})
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
                const st = STATUS_LABELS[userDoc.approvalStatus];
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {u.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-xs font-bold">
                      현재: {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {u.email} · {u.studentIdOrYear}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">역할 변경:</span>
                  {(["student", "alumni", "professor", "admin"] as UserRole[]).map(
                    (roleOption) => (
                      <button
                        key={roleOption}
                        type="button"
                        onClick={() => updateUserRoleByAdmin(u.id, roleOption)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          u.role === roleOption
                            ? "bg-slate-900 dark:bg-orange-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {ROLE_LABELS[roleOption]}
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
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
    </div>
  );
}

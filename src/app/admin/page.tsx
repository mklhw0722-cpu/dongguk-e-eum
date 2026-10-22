"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { ApprovalStatus, UserRole } from "@/types";
import { ROLE_LABELS, RoleBadge, DemoInfoBanner } from "@/components/common/Cards";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  SectionHeader,
  Select,
  Tabs,
  useToast,
  type BadgeTone,
} from "@/components/ui";
import { CheckCircle2, XCircle, AlertCircle, Trash2, Plus } from "lucide-react";

const STATUS_LABELS: Record<ApprovalStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "승인 대기중", tone: "warning" },
  approved: { label: "승인 완료", tone: "success" },
  supplement_requested: { label: "보완 요청됨", tone: "info" },
  rejected: { label: "승인 거절됨", tone: "danger" },
};

const ROLE_OPTIONS: UserRole[] = ["student", "alumni", "professor", "admin"];

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
  } = useApp();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<
    "approvals" | "users" | "rooms_posts" | "reports"
  >("approvals");

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {}
  );

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
    toast({ title: "공유방을 추가했어요" });
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
    toast({ title: "공유방을 수정했어요" });
  };

  const handleApproval = (
    id: string,
    status: ApprovalStatus,
    comment: string,
    doneTitle: string
  ) => {
    updateApprovalStatus(id, status, comment);
    toast({ title: doneTitle });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="동국e음 관리자 센터"
        description="가입 신청 승인·거절, 사용자 역할 관리, 복수전공 공유방 및 게시글 관리, 신고 내역 처리를 수행합니다."
      />

      <DemoInfoBanner
        title="관리자 기능 데모 안내"
        description="1차 버전에서는 별도 로그인 없이도 모든 관리자 UI를 점검하실 수 있도록 개방되어 있습니다. 실제 서비스 배포 시에는 관리자(Admin) 권한 토큰 검증이 서버 단에서 강제됩니다."
      />

      <Tabs
        variant="underline"
        label="관리자 메뉴"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: "approvals", label: "가입 승인 관리", count: approvalRequests.length },
          { value: "users", label: "사용자 역할 관리", count: users.length },
          { value: "rooms_posts", label: "공유방·게시글 관리" },
          { value: "reports", label: "신고 내역 관리", count: reports.length },
        ]}
      />

      {/* 탭 1: 가입 신청 승인 및 거절 */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          {approvalRequests.map((req) => {
            const st = STATUS_LABELS[req.status];
            return (
              <article
                key={req.id}
                className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="font-semibold text-ink">{req.applicantName}</span>
                    <span className="flex items-center gap-1.5 text-xs text-ink-3">
                      신청 역할
                      <RoleBadge role={req.requestedRole} />
                    </span>
                  </div>
                  <span className="tabular text-xs text-ink-3">
                    신청일시: {req.submittedAt}
                  </span>
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-surface-2 p-3.5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-ink-3">이메일</dt>
                    <dd className="text-sm break-all text-ink">{req.applicantEmail}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">학번/연도</dt>
                    <dd className="text-sm text-ink">{req.studentIdOrYear}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-ink-3">인증 방식</dt>
                    <dd className="text-sm text-ink">{req.verificationMethod}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-ink-3">신청 메모</dt>
                    <dd className="text-sm text-ink">{req.note}</dd>
                  </div>
                  {req.adminComment && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-ink-3">관리자 처리 사유</dt>
                      <dd className="text-sm font-semibold text-accent">{req.adminComment}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <Input
                    type="text"
                    aria-label={`${req.applicantName} 처리 사유 메모`}
                    value={commentInputs[req.id] || ""}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({
                        ...prev,
                        [req.id]: e.target.value,
                      }))
                    }
                    placeholder="승인/보완요청/거절 안내 사유 메모 입력 (선택)..."
                    className="lg:flex-1"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="success"
                      icon={<CheckCircle2 />}
                      onClick={() =>
                        handleApproval(
                          req.id,
                          "approved",
                          commentInputs[req.id] || "교육학과 소속 확인 완료 (승인)",
                          "가입을 승인했어요"
                        )
                      }
                    >
                      승인
                    </Button>
                    <Button
                      variant="warning"
                      icon={<AlertCircle />}
                      onClick={() =>
                        handleApproval(
                          req.id,
                          "supplement_requested",
                          commentInputs[req.id] ||
                            "학번 및 소속 확인 정보를 보완해 주세요.",
                          "보완을 요청했어요"
                        )
                      }
                    >
                      보완 요청
                    </Button>
                    <Button
                      variant="danger"
                      icon={<XCircle />}
                      onClick={() =>
                        handleApproval(
                          req.id,
                          "rejected",
                          commentInputs[req.id] || "교육학과 구성원 확인 불가",
                          "가입을 거절했어요"
                        )
                      }
                    >
                      거절
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 탭 2: 사용자 역할 관리 */}
      {activeTab === "users" && (
        <Panel padding="none" className="overflow-x-auto">
          {/* 좁은 화면에서는 '현재 역할' 열을 이름 옆 배지로 합쳐 가로 스크롤 없이 보이게 한다 */}
          <table className="w-full text-left sm:min-w-[34rem]">
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-3">
                <th scope="col" className="px-4 py-3 sm:px-5">사용자</th>
                <th scope="col" className="hidden px-3 py-3 sm:table-cell">현재 역할</th>
                <th scope="col" className="px-4 py-3 sm:px-5">역할 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} initials={u.avatarInitials} role={u.role} size="sm" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                          {u.name}
                          <RoleBadge role={u.role} className="sm:hidden" />
                        </p>
                        <p className="text-xs break-all text-ink-3">
                          {u.email} · {u.studentIdOrYear}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 align-middle sm:px-5">
                    <Select
                      aria-label={`${u.name} 역할`}
                      value={u.role}
                      onChange={(e) => {
                        const next = e.target.value as UserRole;
                        updateUserRoleByAdmin(u.id, next);
                        toast({ title: `${u.name}님의 역할을 ${ROLE_LABELS[next]}(으)로 바꿨어요` });
                      }}
                      className="w-28 sm:w-36"
                    >
                      {ROLE_OPTIONS.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {ROLE_LABELS[roleOption]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {/* 탭 3: 공유방(복수전공 확장) 및 게시글 관리 */}
      {activeTab === "rooms_posts" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          {/* 복수전공 공유방 추가/수정 관리 */}
          <Panel as="section" className="space-y-4">
            <SectionHeader
              title="복수전공 공유방 확장·수정 관리"
              description="기본 예시 전공(경영·경제·심리·컴공·기타) 외에 새로운 복수전공 공유방을 추가하거나 이름을 수정할 수 있습니다."
            />

            <form
              onSubmit={handleAddDoubleMajorRoom}
              className="space-y-3 rounded-xl bg-surface-2 p-3.5"
            >
              <p className="text-sm font-semibold text-ink">+ 새 복수전공 공유방 추가</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="전공명">
                  <Input
                    type="text"
                    required
                    value={newMajorName}
                    onChange={(e) => setNewMajorName(e.target.value)}
                    placeholder="전공명 (예: 사회학, 통계학)"
                  />
                </Field>
                <Field label="공유방 제목">
                  <Input
                    type="text"
                    required
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="공유방 제목 (예: 사회학 복수전공 공유방)"
                  />
                </Field>
              </div>
              <Field label="공유방 설명">
                <Input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="공유방 설명 입력..."
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" icon={<Plus />}>
                  추가
                </Button>
              </div>
            </form>

            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {communityRooms
                .filter((r) => r.type === "double_major")
                .map((room) => (
                  <li key={room.id} className="py-3 first:pt-0 last:pb-0">
                    {editingRoomId === room.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
                          <Field label="분류">
                            <Input
                              type="text"
                              value={editRoomCat}
                              onChange={(e) => setEditRoomCat(e.target.value)}
                            />
                          </Field>
                          <Field label="공유방 이름">
                            <Input
                              type="text"
                              value={editRoomName}
                              onChange={(e) => setEditRoomName(e.target.value)}
                            />
                          </Field>
                        </div>
                        <Field label="설명">
                          <Input
                            type="text"
                            value={editRoomDesc}
                            onChange={(e) => setEditRoomDesc(e.target.value)}
                          />
                        </Field>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingRoomId(null)}
                          >
                            취소
                          </Button>
                          <Button size="sm" onClick={() => handleSaveEditRoom(room.id)}>
                            저장
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{room.categoryName}</Badge>
                            <span className="text-sm font-semibold text-ink">{room.name}</span>
                          </div>
                          <p className="text-sm text-ink-2">{room.description}</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => startEditRoom(room)}
                        >
                          수정
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </Panel>

          {/* 게시글 관리 */}
          <Panel as="section" className="space-y-4">
            <SectionHeader
              title="공유방 게시글 관리"
              count={communityPosts.length}
              description="부적절하거나 규정에 어긋나는 게시글을 삭제할 수 있습니다."
            />
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {communityPosts.map((post) => (
                <li
                  key={post.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{post.roomName}</Badge>
                      <span className="text-sm font-semibold text-ink">{post.title}</span>
                    </div>
                    <p className="text-xs text-ink-3">
                      작성자: {post.authorName} · <span className="tabular">{post.createdAt}</span>
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 />}
                    aria-label={`${post.title} 게시글 삭제`}
                    onClick={() => {
                      deleteCommunityPost(post.id);
                      toast({ title: "게시글을 삭제했어요" });
                    }}
                  >
                    삭제
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {/* 탭 4: 신고 내역 관리 */}
      {activeTab === "reports" &&
        (reports.length === 0 ? (
          <EmptyState compact title="접수된 신고가 없어요" />
        ) : (
          <Panel padding="none">
            <ul className="divide-y divide-line">
              {reports.map((rep) => (
                <li
                  key={rep.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={rep.status === "처리완료" ? "success" : "danger"}>
                        {rep.status}
                      </Badge>
                      <Badge>대상: {rep.targetType}</Badge>
                      <span className="tabular text-xs text-ink-3">{rep.createdAt}</span>
                    </div>
                    <p className="font-semibold text-ink">{rep.targetTitle}</p>
                    <p className="text-sm text-ink-2">
                      신고 사유: {rep.reason}{" "}
                      <span className="text-xs text-ink-3">(신고자: {rep.reporterName})</span>
                    </p>
                  </div>

                  <Button
                    variant={rep.status === "접수됨" ? "success" : "secondary"}
                    size="sm"
                    className="self-start sm:self-center"
                    onClick={() => {
                      resolveReport(rep.id);
                      toast({
                        title:
                          rep.status === "접수됨"
                            ? "처리완료로 전환했어요"
                            : "접수됨으로 되돌렸어요",
                      });
                    }}
                  >
                    {rep.status === "접수됨" ? "검토 및 처리완료 전환" : "접수됨으로 되돌리기"}
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp, CAREER_TRACK_LIST } from "@/context/AppContext";
import { AlumniProfile, CareerTrack, MentoringRequest } from "@/types";
import {
  AlumniCard,
  EmptyStateBox,
  DemoInfoBanner,
} from "@/components/common/Cards";
import {
  Users,
  Search,
  Sparkles,
  MessageSquare,
  Lock,
  Globe,
  X,
  CheckCircle2,
  UserCog,
} from "lucide-react";

export default function AlumniPage() {
  const router = useRouter();
  const {
    alumniProfiles,
    mentoringRequests,
    createMentoringRequest,
    updateMentoringStatus,
    upsertAlumniProfile,
    startOrOpenDirectChat,
    currentRole,
    currentUser,
    authUserProfile,
  } = useApp();

  const userRole = authUserProfile?.role || currentUser.role;
  const isAlumni = userRole === "alumni";
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCareer, setSelectedCareer] = useState<string>("전체");
  const [selectedDoubleMajor, setSelectedDoubleMajor] = useState<string>("전체");
  const [activeTab, setActiveTab] = useState<"directory" | "mentoring" | "my_profile">(
    "directory"
  );

  // 모달 상태
  const [detailAlumni, setDetailAlumni] = useState<AlumniProfile | null>(null);
  const [mentoringTarget, setMentoringTarget] = useState<AlumniProfile | null>(
    null
  );
  const [mentoringTopic, setMentoringTopic] = useState("");
  const [mentoringMsg, setMentoringMsg] = useState("");
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);

  // 현재 접속 계정의 동문 프로필 매칭 및 열람 권한 판별
  const currentUserId = authUserProfile?.id || authUserProfile?.uid || currentUser.id;
  const currentUserName = authUserProfile?.name || currentUser.name;
  const isAdmin = userRole === "admin" || currentUser.role === "admin";
  const myAlumniProfile = alumniProfiles.find(
    (p) => p.userId === currentUserId || (currentUser.name && p.displayName.includes(currentUser.name))
  );

  // 멘토링 요청 열람 권한: 멘토링 신청자(멘티), 멘토링 요청받은 자(멘토), 관리자만
  const visibleMentoringRequests = mentoringRequests.filter((req: MentoringRequest) => {
    if (isAdmin) return true;
    const isMentee =
      req.fromUserId === currentUserId ||
      (Boolean(currentUserName) && req.fromUserName.includes(currentUserName));
    const isMentor =
      (myAlumniProfile && req.toAlumniProfileId === myAlumniProfile.id) ||
      req.toAlumniProfileId === currentUserId ||
      (Boolean(currentUserName) && req.toAlumniName.includes(currentUserName));
    return isMentee || isMentor;
  });

  // 졸업생 본인 프로필 등록/수정 상태
  const [profName, setProfName] = useState("동문 멘토");
  const [profGradYear, setProfGradYear] = useState(2023);
  const [profDoubleMajor, setProfDoubleMajor] = useState("국어교육학과");
  const [profCareer, setProfCareer] = useState<CareerTrack>("기업 HRD");
  const [profRoleTitle, setProfRoleTitle] = useState("교육기획 매니저");
  const [profOrg, setProfOrg] = useState("국내 기업 (예시)");
  const [profBio, setProfBio] = useState(
    "교육학 전공과 복수전공을 연결해 실무 직무로 일하고 있습니다."
  );
  const [profExp, setProfExp] = useState(
    "학부 시절 활동 및 취업/진로 준비 경험을 공유합니다."
  );
  const [profShowInDirectory, setProfShowInDirectory] = useState(true);
  const [profShowOrg, setProfShowOrg] = useState(true);
  const [profShowEmail, setProfShowEmail] = useState(false);
  const [profMentoringAvail, setProfMentoringAvail] = useState(true);

  // 홈 대시보드 등에서 ?alumniId=... 로 진입 시 해당 졸업생 상세 모달 즉시 오픈
  useEffect(() => {
    if (typeof window === "undefined" || alumniProfiles.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetAlumniId = params.get("alumniId");
    if (targetAlumniId) {
      const found = alumniProfiles.find(
        (a) => a.id === targetAlumniId && a.privacy?.showProfileInDirectory !== false
      );
      if (found) {
        setActiveTab("directory");
        setDetailAlumni(found);
      }
    }
  }, [alumniProfiles]);

  // 비졸업생이 프로필 설정 탭에 머물러 있는 경우 자동으로 목록 탭으로 전환
  useEffect(() => {
    if (!isAlumni && activeTab === "my_profile") {
      setActiveTab("directory");
    }
  }, [isAlumni, activeTab]);

  // 졸업생 계정일 때 데이터베이스에 저장된 본인 최신 프로필 정보 자동 동기화
  useEffect(() => {
    if (myAlumniProfile) {
      setProfName(myAlumniProfile.displayName || "");
      setProfGradYear(myAlumniProfile.graduationYear || 2023);
      setProfDoubleMajor(myAlumniProfile.doubleMajor || "");
      setProfCareer(myAlumniProfile.careerTrack || "기업 HRD");
      setProfRoleTitle(myAlumniProfile.currentRoleTitle || "");
      setProfOrg(myAlumniProfile.organization || "");
      setProfBio(myAlumniProfile.bio || "");
      setProfExp(myAlumniProfile.experienceSummary || "");
      setProfShowInDirectory(myAlumniProfile.privacy?.showProfileInDirectory !== false);
      setProfShowOrg(myAlumniProfile.privacy?.showOrganization !== false);
      setProfShowEmail(myAlumniProfile.privacy?.showEmail === true);
      setProfMentoringAvail(myAlumniProfile.mentoringAvailable !== false);
    } else if (isAlumni && currentUser) {
      const yearText = currentUser.studentIdOrYear ? ` (${currentUser.studentIdOrYear})` : "";
      setProfName(`${currentUser.name}${yearText}`);
      if (currentUser.doubleMajor) setProfDoubleMajor(currentUser.doubleMajor);
      if (currentUser.careerTrack) setProfCareer(currentUser.careerTrack);
      if (currentUser.bio) setProfBio(currentUser.bio);
    }
  }, [myAlumniProfile?.id, currentUserId, isAlumni, currentUser.name, currentUser.studentIdOrYear]);

  const STANDARD_DOUBLE_MAJORS = [
    "경영학",
    "국어교육학과",
    "법학과",
    "단일전공(교육학)",
    "기타",
  ];

  const doubleMajorOptions = [
    "전체",
    ...STANDARD_DOUBLE_MAJORS,
  ];

  const publicAlumniProfiles = alumniProfiles.filter(
    (a) => a.privacy?.showProfileInDirectory !== false
  );

  const filteredAlumni = publicAlumniProfiles.filter((a) => {
    const matchCareer =
      selectedCareer === "전체" || a.careerTrack === selectedCareer;
    const matchDM =
      selectedDoubleMajor === "전체"
        ? true
        : selectedDoubleMajor === "기타"
        ? a.doubleMajor === "기타" || !["경영학", "국어교육학과", "법학과", "단일전공(교육학)"].includes(a.doubleMajor)
        : a.doubleMajor === selectedDoubleMajor;
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      a.displayName.toLowerCase().includes(q) ||
      a.currentRoleTitle.toLowerCase().includes(q) ||
      a.doubleMajor.toLowerCase().includes(q) ||
      a.bio.toLowerCase().includes(q) ||
      a.interests.some((i) => i.toLowerCase().includes(q));
    return matchCareer && matchDM && matchQuery;
  });

  const handleRequestChat = (alumni: AlumniProfile) => {
    startOrOpenDirectChat(alumni.userId, "동문 멘토링 대화");
    router.push("/chat");
  };

  const handleSubmitMentoring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentoringTarget || !mentoringTopic.trim() || !mentoringMsg.trim())
      return;
    createMentoringRequest(
      mentoringTarget.id,
      mentoringTopic.trim(),
      mentoringMsg.trim()
    );
    setMentoringTarget(null);
    setMentoringTopic("");
    setMentoringMsg("");
    setFeedbackBanner(
      `${mentoringTarget.displayName} 동문에게 멘토링 신청이 접수되었습니다! [멘토링 요청 현황] 탭에서 확인할 수 있습니다.`
    );
  };

  const handleSaveMyAlumniProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await upsertAlumniProfile({
        displayName: profName.trim(),
        graduationYear: Number(profGradYear),
        admissionYear: Number(profGradYear) - 4,
        doubleMajor: profDoubleMajor.trim() || "단일전공 (교육학)",
        careerTrack: profCareer,
        currentRoleTitle: profRoleTitle.trim(),
        organization: profOrg.trim(),
        bio: profBio.trim(),
        experienceSummary: profExp.trim(),
        mentoringAvailable: profMentoringAvail,
        interests: [profCareer, profDoubleMajor.trim() || "진로멘토링"].filter(Boolean),
        privacy: {
          showProfileInDirectory: profShowInDirectory,
          showOrganization: profShowOrg,
          showEmail: profShowEmail,
          allowDirectChat: true,
        },
      });
      setFeedbackBanner("졸업생 프로필 및 개인정보 공개 범위가 클라우드 데이터베이스에 실시간으로 저장되었습니다.");
      setActiveTab("directory");
    } catch (err: any) {
      console.error("프로필 저장 에러:", err);
      setFeedbackBanner("프로필 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              졸업생 동문 연결 네트워크
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            교직, 교육행정, 공공기관, 기업 HRD, 에듀테크, 대학원 등 각 분야로 진출한 교육학과 선배들과 연결하세요.
          </p>
        </div>

        {/* 상단 탭 전환 */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === "directory"
                ? "bg-orange-600 text-white"
                : "text-slate-600"
            }`}
          >
            동문 프로필 탐색 ({publicAlumniProfiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mentoring")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === "mentoring"
                ? "bg-orange-600 text-white"
                : "text-slate-600"
            }`}
          >
            멘토링 요청 현황 ({visibleMentoringRequests.length})
          </button>
          {isAlumni && (
            <button
              type="button"
              onClick={() => setActiveTab("my_profile")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === "my_profile"
                  ? "bg-orange-600 text-white"
                  : "text-slate-600"
              }`}
            >
              졸업생 프로필·공개범위 설정
            </button>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center justify-between">
          <span className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {feedbackBanner}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline"
          >
            닫기
          </button>
        </div>
      )}

      {activeTab === "directory" && (
        <>
          {/* 검색 및 진로·복수전공 이중 필터 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="선배 이름, 직무, 관심 키워드(예: 온보딩, 임용, PM, NCS) 검색..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1">
                  진로 분야:
                </span>
                {["전체", ...CAREER_TRACK_LIST].map((track) => (
                  <button
                    key={track}
                    type="button"
                    onClick={() => setSelectedCareer(track)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedCareer === track
                        ? "bg-orange-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {track}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1">
                  복수전공:
                </span>
                {doubleMajorOptions.map((dm) => (
                  <button
                    key={dm}
                    type="button"
                    onClick={() => setSelectedDoubleMajor(dm)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedDoubleMajor === dm
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {dm}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 졸업생 카드 그리드 */}
          {filteredAlumni.length === 0 ? (
            <EmptyStateBox
              title="해당 조건의 졸업생 프로필이 없습니다"
              description="진로 분야나 복수전공 필터를 '전체'로 변경해 보세요."
              actionLabel="필터 초기화"
              onAction={() => {
                setSelectedCareer("전체");
                setSelectedDoubleMajor("전체");
                setSearchQuery("");
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAlumni.map((alumni) => (
                <AlumniCard
                  key={alumni.id}
                  alumni={alumni}
                  onSelectProfile={(a) => setDetailAlumni(a)}
                  onRequestChat={(a) => handleRequestChat(a)}
                  onRequestMentoring={(a) => setMentoringTarget(a)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "mentoring" && (
        <div className="space-y-4">
          {visibleMentoringRequests.length === 0 ? (
            <EmptyStateBox
              title="참여 중인 멘토링 요청 내역이 없습니다"
              description={
                isAdmin
                  ? "현재 학우들이 신청한 멘토링 요청 내역이 없습니다."
                  : isAlumni
                  ? "후배들이 신청한 멘토링 요청이 도착하면 이곳에서 확인하고 답변을 작성할 수 있습니다."
                  : "관심 있는 진로 분야의 선배님 프로필에서 [멘토링 신청]을 해보세요!"
              }
              actionLabel="동문 프로필 탐색하기"
              onAction={() => setActiveTab("directory")}
            />
          ) : (
            <div className="space-y-3">
              {visibleMentoringRequests.map((req) => {
                const isMentee =
                  req.fromUserId === currentUserId ||
                  (Boolean(currentUserName) && req.fromUserName.includes(currentUserName));
                const isMentor =
                  (myAlumniProfile && req.toAlumniProfileId === myAlumniProfile.id) ||
                  req.toAlumniProfileId === currentUserId ||
                  (Boolean(currentUserName) && req.toAlumniName.includes(currentUserName));
                // 관리자는 현황을 모니터링/열람할 수 있되, 답변 등록 및 수정, 수락은 해당 멘토 동문만 가능
                const canManage = isMentor;
                const isEditing = editingReplyId === req.id && isMentor;
                const showReplyForm = isMentor && (req.status === "수락됨" || isEditing);

                return (
                  <div
                    key={req.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            req.status === "수락됨"
                              ? "bg-emerald-100 text-emerald-800"
                              : req.status === "답변완료"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {req.status}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          신청자: {req.fromUserName} → 멘토: {req.toAlumniName}
                        </span>
                        {isMentee && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                            내가 신청함
                          </span>
                        )}
                        {isMentor && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            나에게 온 요청
                          </span>
                        )}
                        {isAdmin && !isMentor && !isMentee && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            관리자 모니터링 (열람 전용)
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{req.createdAt}</span>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900">
                      {req.topic}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl whitespace-pre-wrap">
                      {req.message}
                    </p>

                    {/* 대기중 상태 액션 */}
                    {req.status === "대기중" && (
                      <div className="flex items-center justify-between pt-1">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateMentoringStatus(req.id, "수락됨");
                              setEditingReplyId(req.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                          >
                            멘토링 수락
                          </button>
                        ) : (
                          <span className="text-xs text-amber-700 font-medium">
                            {isAdmin
                              ? "멘토 동문 선배님의 수락 대기 중입니다. (관리자는 열람만 가능합니다)"
                              : "멘토 선배님의 수락을 기다리고 있습니다."}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 수락됨 상태 안내 (멘티 또는 관리자에게 표시) */}
                    {req.status === "수락됨" && !canManage && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          {isAdmin
                            ? "멘토 동문이 요청을 수락했습니다. 멘토의 답변 등록을 기다리고 있습니다. (관리자 열람 전용)"
                            : "선배님이 멘토링 요청을 수락했습니다! 답변이 작성되는 대로 이곳에 표시됩니다."}
                        </span>
                      </div>
                    )}

                    {/* 답변 작성 폼 (멘토 또는 관리자에게 표시) */}
                    {showReplyForm && (
                      <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-orange-600" />
                            후배를 위한 멘토링 답변 작성
                          </span>
                          {req.status === "답변완료" && (
                            <button
                              type="button"
                              onClick={() => setEditingReplyId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              수정 취소
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={4}
                          value={
                            replyDrafts[req.id] !== undefined
                              ? replyDrafts[req.id]
                              : req.replyMessage || ""
                          }
                          onChange={(e) =>
                            setReplyDrafts({ ...replyDrafts, [req.id]: e.target.value })
                          }
                          placeholder="후배의 질문에 대한 조언과 답변을 정성껏 작성해 주세요. (이메일, 카카오톡 오픈채팅 등 추가 소통 방식도 함께 남겨주실 수 있습니다)"
                          className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isMentor) {
                                alert("멘토링 답변 등록 및 수정은 해당 멘토 동문 본인만 가능합니다.");
                                return;
                              }
                              const draft = (
                                replyDrafts[req.id] !== undefined
                                  ? replyDrafts[req.id]
                                  : req.replyMessage || ""
                              ).trim();
                              if (!draft) {
                                alert("답변 내용을 입력해 주세요.");
                                return;
                              }
                              updateMentoringStatus(req.id, "답변완료", draft);
                              setEditingReplyId(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
                          >
                            답변 등록
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 답변 완료된 답변 본문 카드 */}
                    {req.status === "답변완료" && req.replyMessage && !isEditing && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold">
                              멘토 선배님 답변
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {req.toAlumniName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {req.repliedAt && (
                              <span className="text-[11px] text-slate-400">
                                답변일: {req.repliedAt}
                              </span>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReplyId(req.id);
                                  setReplyDrafts((prev) => ({
                                    ...prev,
                                    [req.id]: req.replyMessage || "",
                                  }));
                                }}
                                className="text-xs font-bold text-orange-600 hover:text-orange-700 underline ml-2"
                              >
                                답변 수정
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {req.replyMessage}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "my_profile" && (
        !isAlumni ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
            <Lock className="w-10 h-10 text-orange-600 mx-auto" />
            <h2 className="text-lg font-black text-slate-900">
              졸업생 전용 설정 화면입니다
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              진로 프로필 등록 및 개인정보 공개 범위 설정은 교육학과를 졸업한 졸업생(동문) 계정으로 로그인한 경우에만 접근하실 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("directory")}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition"
            >
              동문 목록으로 돌아가기
            </button>
          </div>
        ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-black text-slate-900">
              졸업생 진로 프로필 등록 및 개인정보 공개 범위 설정
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            졸업생 회원은 본인의 소속 직장명, 이메일, 멘토링 가능 여부를 직접 선택해 공개 범위를 제어할 수 있습니다.
          </p>

          <form
            onSubmit={handleSaveMyAlumniProfile}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm"
          >
            <div>
              <label className="block font-bold mb-1">표시 이름 또는 닉네임</label>
              <input
                type="text"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">졸업 연도</label>
              <input
                type="number"
                value={profGradYear}
                onChange={(e) => setProfGradYear(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">진로 분야</label>
              <select
                value={profCareer}
                onChange={(e) => setProfCareer(e.target.value as CareerTrack)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              >
                {CAREER_TRACK_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">복수전공 이수 내역</label>
              <input
                type="text"
                list="double-major-suggestions"
                value={profDoubleMajor}
                onChange={(e) => setProfDoubleMajor(e.target.value)}
                placeholder="예: 국어교육학과, 경영학, 법학과, 단일전공(교육학), 기타"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
              <datalist id="double-major-suggestions">
                <option value="경영학" />
                <option value="국어교육학과" />
                <option value="법학과" />
                <option value="단일전공(교육학)" />
                <option value="기타" />
              </datalist>
            </div>

            <div>
              <label className="block font-bold mb-1">현재 담당 직무명</label>
              <input
                type="text"
                value={profRoleTitle}
                onChange={(e) => setProfRoleTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">현재 소속 기관/기업명 (선택 공개)</label>
              <input
                type="text"
                value={profOrg}
                onChange={(e) => setProfOrg(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">한 줄 자기소개</label>
              <input
                type="text"
                value={profBio}
                onChange={(e) => setProfBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">후배들에게 나눌 수 있는 경험 상세</label>
              <textarea
                rows={3}
                value={profExp}
                onChange={(e) => setProfExp(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>

            {/* 개인정보 공개 범위 설정 박스 */}
            <div className="sm:col-span-2 p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-2">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-orange-600" /> 개인정보 및 멘토링 공개 범위 설정
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profShowInDirectory}
                  onChange={(e) => setProfShowInDirectory(e.target.checked)}
                />
                <span>졸업생 동문 연결에 프로필을 공개합니다 (해제 시 비공개)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profShowOrg}
                  onChange={(e) => setProfShowOrg(e.target.checked)}
                />
                <span>현재 소속 직장/기관명을 후배들에게 공개합니다 (해제 시 비공개 처리)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profShowEmail}
                  onChange={(e) => setProfShowEmail(e.target.checked)}
                />
                <span>개인 이메일 연락처를 프로필 상세에 표시합니다</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profMentoringAvail}
                  onChange={(e) => setProfMentoringAvail(e.target.checked)}
                />
                <span>현재 멘토링 신청 접수를 받습니다</span>
              </label>
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-raise transition cursor-pointer"
              >
                {isSaving ? "데이터베이스 저장 중..." : "프로필 및 공개 설정 저장"}
              </button>
            </div>
          </form>
        </div>
        )
      )}

      {/* 상세 프로필 모달 */}
      {detailAlumni && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-xs font-bold">
                  {detailAlumni.careerTrack} 트랙
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {detailAlumni.displayName}
                </h2>
                <p className="text-xs text-slate-500">
                  {detailAlumni.graduationYear}년 졸업 · 복수전공:{" "}
                  {detailAlumni.doubleMajor}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailAlumni(null)}
                className="p-1.5 rounded-lg bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">현재 직무</span>
                <span className="font-bold">{detailAlumni.currentRoleTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">현재 소속 (선택 공개)</span>
                {detailAlumni.privacy.showOrganization ? (
                  <span className="font-semibold flex items-center gap-1 text-emerald-700">
                    <Globe className="w-3.5 h-3.5" /> {detailAlumni.organization}
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> 본인 설정에 의해 비공개
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs sm:text-sm">
              <h3 className="font-bold text-slate-900">소개 및 진로 스토리</h3>
              <p className="text-slate-600 leading-relaxed">
                {detailAlumni.bio}
              </p>
              <h3 className="font-bold text-slate-900 pt-2">
                멘토링 가능 주제 및 경험 요약
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {detailAlumni.experienceSummary}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailAlumni(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = detailAlumni;
                  setDetailAlumni(null);
                  setMentoringTarget(target);
                }}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-brand-700 shadow-raise transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> 멘토링 신청하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멘토링 신청 모달 */}
      {mentoringTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {mentoringTarget.displayName} 동문에게 멘토링 신청
                </h2>
                <p className="text-xs text-slate-500">
                  {mentoringTarget.careerTrack} · {mentoringTarget.currentRoleTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMentoringTarget(null)}
                className="p-1.5 rounded-lg bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMentoring} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold mb-1">질문/멘토링 주제</label>
                <input
                  type="text"
                  required
                  value={mentoringTopic}
                  onChange={(e) => setMentoringTopic(e.target.value)}
                  placeholder="예: 복수전공 학점 관리와 직무 인턴 준비 시기 문의"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">상세 질문 내용</label>
                <textarea
                  rows={4}
                  required
                  value={mentoringMsg}
                  onChange={(e) => setMentoringMsg(e.target.value)}
                  placeholder="선배님이 답변하기 쉽도록 본인의 학년, 관심 분야, 궁금한 점을 구체적으로 적어주세요."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMentoringTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-raise transition cursor-pointer"
                >
                  멘토링 요청 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

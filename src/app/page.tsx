"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { calculateGraduationAudit } from "@/lib/graduationCurriculum";
import { ROLE_LABELS } from "@/components/common/Cards";
import { formatUnreadBadge } from "@/lib/chatReadReceipts";
import { getAvatarInitials } from "@/lib/firebase";
import EditableCalendar from "@/components/calendar/EditableCalendar";
import { ConsultationStatus, ConsultationType, ConsultationRequest } from "@/types";
import {
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ArrowRight,
  Pin,
  BookOpen,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Calendar,
  AlertCircle,
  Clock,
  X,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Inbox,
  MessageCircle,
  Check,
  Send,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const {
    currentUser,
    currentRole,
    notices,
    conversations,
    communityRooms,
    communityPosts,
    alumniProfiles,
    studentProgress,
    graduationCatalog,
    mentoringRequests,
    approvalRequests,
    myAdvisorInfo,
  } = useApp();

  // 읽지 않은 채팅 목록
  const unreadConversations = conversations.filter((conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return (member?.unreadCount || 0) > 0;
  });

  // 주요 진로·복수전공 게시판 목록
  const featuredBoards = communityRooms;

  // 최근 복수전공 후기
  const doubleMajorReviews = communityPosts
    .filter((p) => p.category === "복수전공 후기")
    .slice(0, 3);

  // 추천 졸업생 (상위 3명)
  const recommendedAlumni = alumniProfiles.slice(0, 3);

  // 역할별 맞춤형 바로가기 구성
  
  // 재학생 모드 판별 (관리자, 교수진, 졸업생은 false)
  const isStudent =
    (currentUser.role === "student" || currentRole === "student") &&
    currentUser.role !== "admin" &&
    currentRole !== "admin" &&
    currentUser.role !== "professor" &&
    currentRole !== "professor" &&
    currentUser.role !== "alumni" &&
    currentRole !== "alumni";

  // 진로·복수전공 게시판 바로가기 위젯
  const renderJoinedRoomsSection = () => (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-orange-600" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            진로·복수전공 게시판 ({featuredBoards.length})
          </h2>
        </div>
        <Link
          href="/rooms"
          className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
        >
          전체 게시판 보기 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {featuredBoards.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
          등록된 게시판이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {featuredBoards.slice(0, 4).map((room) => {
            const count = communityPosts.filter((p) => p.roomId === room.id).length;
            return (
              <Link
                key={room.id}
                href="/rooms"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-400 transition bg-slate-50/50 dark:bg-slate-800/40"
              >
                <span className="inline-block px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[10px] font-bold mb-1.5">
                  {room.type === "career" ? "진로 트랙" : "복수전공"} · {room.categoryName}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {room.name.replace(/공유방/g, "게시판")}
                </h3>
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  게시글 {count}건
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );

  // 최근 등록된 복수전공 후기 위젯
  const renderDoubleMajorReviewsSection = () => (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-600" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            최근 등록된 복수전공 후기
          </h2>
        </div>
        <Link
          href="/rooms"
          className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
        >
          후기 더보기 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {doubleMajorReviews.map((post) => (
          <Link
            key={post.id}
            href="/rooms"
            className="block p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-orange-300 bg-slate-50/60 dark:bg-slate-800/40 transition"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                [{post.roomName}]
              </span>
              <span>
                {post.authorName} ({post.authorBadge})
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
              {post.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {/* 환영 배너 */}
      <section className="rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              동국대학교 교육학과 전용 소통 플랫폼 · 동국e음
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              반갑습니다, {currentUser.name}님!{currentRole === "admin" ? ` (${ROLE_LABELS.admin} 모드)` : ""}
            </h1>
            <p className="text-xs sm:text-sm text-orange-50 max-w-2xl leading-relaxed">
              교육(e)으로 사람과 사람을 잇는 <strong>동국e음</strong>입니다. 학과 공지부터
              졸업요건 자가점검, 진로·복수전공 게시판, 동문 멘토링까지 한곳에서 연결하세요.
            </p>
          </div>

          
        </div>
      </section>

      
      {/* 중단 2단 그리드: 최근 학과 공지 & 읽지 않은 채팅 + 졸업요건 바로가기 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 직접 일정 수정 가능한 캘린더 (기존 홈화면 공지란 대체) */}
        <EditableCalendar className="lg:col-span-7" />

        {/* 우측: 지도교수 & 읽지 않은 채팅 & 나의 졸업요건 확인 바로가기 */}
        <div className="lg:col-span-5 space-y-6">
          {/* 학생 전용: 나의 지도교수 영역 */}
          {isStudent && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-orange-600" />
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    나의 지도교수
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-semibold">
                  교육학과 학생 지도 시스템
                </span>
              </div>

              {myAdvisorInfo.status === "assigned" && myAdvisorInfo.professor ? (
                <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30 dark:from-slate-800/60 dark:to-slate-800/30 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {getAvatarInitials(myAdvisorInfo.professor.name, myAdvisorInfo.professor.role) || myAdvisorInfo.professor.avatarInitials}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {myAdvisorInfo.professor.name}
                        </span>
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                          {myAdvisorInfo.professor.studentIdOrYear || "교육학과 전임교원"}
                        </span>
                        {((myAdvisorInfo.professor as any).id === "u-prof-1" || (myAdvisorInfo.professor as any).email?.includes("@sample.dgu.edu")) && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            테스트 계정
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        소속: 동국대학교 사범대학 교육학과
                      </p>
                      {myAdvisorInfo.professor.specialty && (
                        <p className="text-xs text-slate-500 truncate">
                          전문 분야: {myAdvisorInfo.professor.specialty}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-orange-100 dark:border-orange-900/30">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        myAdvisorInfo.professor.consultationAvailable !== false
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {myAdvisorInfo.professor.consultationAvailable !== false
                        ? "● 상담 가능"
                        : "현재 상담 불가"}
                    </span>
                    <Link
                      href={`/chat?consultProfessorId=${myAdvisorInfo.professor.id}`}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center"
                    >
                      상담 신청
                    </Link>
                  </div>
                </div>
              ) : myAdvisorInfo.status === "invalid_status" ? (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">지정된 지도교수 계정의 이용 상태를 확인할 수 없습니다.</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      교수 계정 권한이 변경되었거나 이용 정지 상태일 수 있습니다. 학과사무실(관리자)에 문의해 주세요.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1 bg-slate-50/50 dark:bg-slate-800/20">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">지도교수 미등록</p>
                  <p className="text-xs text-slate-400">
                    아직 배정된 지도교수님이 없습니다. 학과사무실 또는 관리자에게 지도교수 지정을 요청해 주세요.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* 읽지 않은 채팅 */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  읽지 않은 대화
                </h2>
              </div>
              <Link
                href="/chat"
                className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
              >
                대화창 이동 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {unreadConversations.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
                현재 읽지 않은 새 메시지가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {unreadConversations.map((conv) => {
                  const myMember = conv.members.find(
                    (m) => m.userId === currentUser.id
                  );
                  return (
                    <Link
                      key={conv.id}
                      href="/chat"
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 hover:border-orange-400 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {conv.title}
                          </p>
                          <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-bold">
                            +{formatUnreadBadge(myMember?.unreadCount || 0)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {conv.lastMessageText}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {conv.lastMessageAt}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* 나의 졸업요건 확인 바로가기 (재학생/관리자 전용) */}
          {/* 재학생 전용: 나의 졸업요건 자가점검 요약 */}
          {isStudent && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-orange-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  나의 졸업요건 자가점검 요약
                </h2>
              </div>
              <Link
                href="/graduation"
                className="text-xs font-semibold text-orange-600 hover:underline"
              >
                상세 기록하기 →
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-2 text-xs">
              {(() => {
                const homeAudit = calculateGraduationAudit(studentProgress, graduationCatalog);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">적용 기준 정보</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {homeAudit.profile.admissionYearLabel} · {studentProgress.majorType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">내가 기록한 총 이수 학점</span>
                      <span className="font-bold text-orange-600">
                        {homeAudit.totalEarnedCredits}학점 / {homeAudit.applicable.cohortRule.totalGraduationCredits}학점
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">내가 기록한 교육봉사 시간</span>
                      <span className="font-bold text-orange-600">
                        {homeAudit.volunteeringAudit.effectiveHours}시간 / {homeAudit.volunteeringAudit.targetHours}시간
                      </span>
                    </div>
                  </>
                );
              })()}
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                ※ 공식 학사 시스템 연동 결과가 아닌 학생 개인의 자가점검 메모입니다.
              </p>
            </div>
          </section>
          )}

          {/* 관리자·졸업생·교수진 모드: 캘린더 우측 빈 공간에 공유방 & 후기 배치 */}
          {!isStudent && (
            <>
              {renderJoinedRoomsSection()}
              {renderDoubleMajorReviewsSection()}
            </>
          )}
        </div>
      </div>

      {/* 재학생 모드: 하단 2열에 진로 공유방 & 최근 복수전공 후기 배치 */}
      {isStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderJoinedRoomsSection()}
          {renderDoubleMajorReviewsSection()}
        </div>
      )}

      {/* 추천 졸업생 멘토 */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              추천 졸업생 동문 프로필
            </h2>
          </div>
          <Link
            href="/alumni"
            className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
          >
            졸업생 전체 탐색 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedAlumni.map((alumni) => (
            <Link
              key={alumni.id}
              href="/alumni"
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-400 transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {alumni.displayName}
                </span>
                <span className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[11px] font-bold">
                  {alumni.careerTrack}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {alumni.currentRoleTitle}
              </p>
              <p className="text-xs text-slate-500">
                복수전공: {alumni.doubleMajor} · {alumni.graduationYear}년 졸업
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

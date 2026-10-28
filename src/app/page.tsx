"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { ROLE_LABELS } from "@/components/common/Cards";
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
} from "lucide-react";

export default function HomePage() {
  const {
    currentUser,
    currentRole,
    notices,
    conversations,
    communityRooms,
    communityPosts,
    alumniProfiles,
    studentProgress,
    mentoringRequests,
    approvalRequests,
  } = useApp();

  // 읽지 않은 채팅 목록
  const unreadConversations = conversations.filter((conv) => {
    const member = conv.members.find((m) => m.userId === currentUser.id);
    return (member?.unreadCount || 0) > 0;
  });

  // 내가 참여한 공유방
  const myJoinedRooms = communityRooms.filter((r) =>
    r.memberIds.includes(currentUser.id)
  );

  // 최근 복수전공 후기
  const doubleMajorReviews = communityPosts
    .filter((p) => p.category === "복수전공 후기")
    .slice(0, 3);

  // 추천 졸업생 (상위 3명)
  const recommendedAlumni = alumniProfiles.slice(0, 3);

  // 역할별 맞춤형 바로가기 구성
  const roleShortcuts = {
    student: [
      {
        title: "나의 졸업요건 자가점검",
        desc: "전공·교양·복수전공 학점과 교육봉사 시간을 직접 기록하고 점검하세요.",
        href: "/graduation",
        icon: CheckSquare,
        badge: "재학생 필수",
      },
      {
        title: "진로·복수전공 공유방",
        desc: "교직, HRD, 에듀테크 및 심리·경영·컴공 복수전공 선배 후기를 확인하세요.",
        href: "/rooms",
        icon: Compass,
        badge: "정보 아카이브",
      },
      {
        title: "졸업생 동문 멘토 찾기",
        desc: "관심 직무에 재직 중인 교육학과 선배에게 1:1 대화나 멘토링을 요청하세요.",
        href: "/alumni",
        icon: Users,
        badge: "동문 네트워크",
      },
    ],
    alumni: [
      {
        title: "내 졸업생 프로필·멘토링 관리",
        desc: `현재 도착한 멘토링 요청 ${mentoringRequests.length}건을 확인하고 직무 정보를 공유하세요.`,
        href: "/alumni",
        icon: Briefcase,
        badge: "동문 전용",
      },
      {
        title: "후배들과 진로·복전 경험 나누기",
        desc: "내가 겪은 복수전공 팁과 취업 준비 과정을 공유방에 남겨주세요.",
        href: "/rooms",
        icon: Compass,
        badge: "경험 공유",
      },
      {
        title: "재학생과 1:1 / 그룹 대화",
        desc: "멘토링 요청을 보낸 후배들과 실시간 대화창에서 소통하세요.",
        href: "/chat",
        icon: MessageSquare,
        badge: "메신저",
      },
    ],
    professor: [
      {
        title: "학생 검색 및 면담 대화 요청",
        desc: "재학생·졸업생을 검색해 1:1 면담을 요청하거나 연구/수업 단체방을 개설하세요.",
        href: "/chat",
        icon: MessageSquare,
        badge: "교수진 전용",
      },
      {
        title: "진로 트랙별 공유방 참여",
        desc: "학생들의 진로 고민 질문에 코멘트를 남기고 연구실 소식을 전하세요.",
        href: "/rooms",
        icon: Compass,
        badge: "학업·진로 지도",
      },
      {
        title: "학과 공지 및 학사 안내 확인",
        desc: "학과 주요 행사와 교직·학사 공지 현황을 살펴보세요.",
        href: "/notices",
        icon: Megaphone,
        badge: "학과 소식",
      },
    ],
    admin: [
      {
        title: "신규 가입 승인 및 역할 관리",
        desc: `현재 승인 대기 중인 가입 신청 ${
          approvalRequests.filter((r) => r.status === "pending").length
        }건을 검토하고 처리하세요.`,
        href: "/admin",
        icon: ShieldCheck,
        badge: "관리자 전용",
      },
      {
        title: "학과 공지사항 작성 및 고정",
        desc: "새로운 교육학과 공지나 교직 안내를 등록하고 상단에 고정하세요.",
        href: "/notices",
        icon: Megaphone,
        badge: "공지 관리",
      },
      {
        title: "복수전공 공유방 개설·신고 관리",
        desc: "새로운 복수전공 공유방을 추가하거나 신고된 게시글을 관리하세요.",
        href: "/admin",
        icon: UserCheck,
        badge: "커뮤니티 운영",
      },
    ],
  }[currentRole];

  return (
    <div className="space-y-6">
      {/* 환영 배너 */}
      <section className="rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              동국대학교 교육학과 폐쇄형 소통 플랫폼 · 동국e음
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              반갑습니다, {currentUser.name}님! ({ROLE_LABELS[currentRole]} 모드)
            </h1>
            <p className="text-xs sm:text-sm text-orange-50 max-w-2xl leading-relaxed">
              교육(e)으로 사람과 사람을 잇는 <strong>동국e음</strong>입니다. 학과 공지부터
              졸업요건 자가점검, 복수전공·진로 트랙 공유방, 동문 멘토링까지 한곳에서 연결하세요.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <Link
              href="/chat"
              className="px-4 py-2.5 rounded-xl bg-white text-orange-700 font-bold text-xs sm:text-sm shadow-xs hover:bg-orange-50 transition inline-flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              대화창 열기
              {unreadConversations.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[10px]">
                  {unreadConversations.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* 역할별 맞춤 바로가기 3종 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {ROLE_LABELS[currentRole]} 맞춤 바로가기
          </h2>
          <span className="text-xs text-slate-500">
            현재 선택된 역할: {ROLE_LABELS[currentRole]}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-orange-400 transition flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[11px] font-bold">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base mb-1 group-hover:text-orange-600 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-orange-600">
                  <span>바로 이동하기</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 중단 2단 그리드: 최근 학과 공지 & 읽지 않은 채팅 + 졸업요건 바로가기 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 최근 학과 공지 */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Megaphone className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                최근 학교·교육학과·사범대 공지
              </h2>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                공식 홈페이지 자동 연동
              </span>
            </div>
            <Link
              href="/notices"
              className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
            >
              전체보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {notices.slice(0, 4).map((notice) => (
              <Link
                key={notice.id}
                href="/notices"
                className="block p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-orange-300 bg-slate-50/60 dark:bg-slate-800/40 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {notice.isPinned && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-bold">
                        <Pin className="w-2.5 h-2.5" /> 고정
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                      [{notice.category === "학사 일정" ? "학사 일정·학사공지" : notice.category}]
                    </span>
                    {notice.isOfficialSynced ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        공식 홈페이지 연동 · {notice.organization || notice.authorName}
                      </span>
                    ) : notice.isSampleData ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                        예시 데이터
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        학과 관리자 공지
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">{notice.createdAt}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                  {notice.title}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 우측: 읽지 않은 채팅 & 나의 졸업요건 확인 바로가기 */}
        <div className="lg:col-span-5 space-y-6">
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
                            +{myMember?.unreadCount}
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

          {/* 나의 졸업요건 확인 바로가기 */}
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
              <div className="flex justify-between">
                <span className="text-slate-500">적용 기준 정보</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {studentProgress.admissionYear} · {studentProgress.majorType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">내가 기록한 총 이수 학점</span>
                <span className="font-bold text-orange-600">
                  {studentProgress.credits["졸업 이수 학점"]?.completedValue ?? 0}학점 (기준 미설정)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">내가 기록한 교육봉사 시간</span>
                <span className="font-bold text-orange-600">
                  {studentProgress.credits["교육봉사 시간"]?.completedValue ?? 0}시간 (기준 미설정)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                ※ 공식 학사 시스템 연동 결과가 아닌 학생 개인의 자가점검 메모입니다.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* 내가 참여한 진로 공유방 & 최근 등록된 복수전공 후기 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 내가 참여한 진로 공유방 */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-orange-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                내가 참여 중인 공유방 ({myJoinedRooms.length})
              </h2>
            </div>
            <Link
              href="/rooms"
              className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
            >
              전체 공유방 탐색 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myJoinedRooms.slice(0, 4).map((room) => (
              <Link
                key={room.id}
                href="/rooms"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-400 transition bg-slate-50/50 dark:bg-slate-800/40"
              >
                <span className="inline-block px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[10px] font-bold mb-1.5">
                  {room.type === "career" ? "진로 트랙" : "복수전공"} · {room.categoryName}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {room.name}
                </h3>
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  참여 인원 {room.memberIds.length}명
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 최근 등록된 복수전공 후기 */}
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
      </div>

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

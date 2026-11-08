"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { calculateGraduationAudit } from "@/lib/graduationCurriculum";
import { ROLE_LABELS } from "@/components/common/Cards";
import { formatUnreadBadge } from "@/lib/chatReadReceipts";
import { getAvatarInitials } from "@/lib/firebase";
import EditableCalendar from "@/components/calendar/EditableCalendar";
import {
  Avatar,
  Badge,
  CountBadge,
  Panel,
  SectionHeader,
  textLinkClass,
} from "@/components/ui";
import {
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ArrowRight,
  Sparkles,
  GraduationCap,
  AlertCircle,
  BookOpen,
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
    <Panel as="section">
      <SectionHeader
        title={`진로·복수전공 게시판 (${featuredBoards.length})`}
        icon={<Compass className="w-5 h-5 text-accent" />}
        action={
          <Link href="/rooms" className={textLinkClass}>
            전체 게시판 보기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      {featuredBoards.length === 0 ? (
        <div className="p-5 rounded-2xl bg-surface-2 text-center text-xs text-ink-3">
          등록된 게시판이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {featuredBoards.slice(0, 4).map((room) => {
            const count = communityPosts.filter((p) => p.roomId === room.id).length;
            return (
              <Link
                key={room.id}
                href="/rooms"
                className="group p-4 rounded-2xl border border-line hover:border-line-strong hover:bg-surface-2 transition flex flex-col justify-between gap-2"
              >
                <div>
                  <Badge tone={room.type === "career" ? "brand" : "info"} className="mb-2">
                    {room.type === "career" ? "진로 트랙" : "복수전공"} · {room.categoryName}
                  </Badge>
                  <h3 className="text-sm font-bold text-ink group-hover:text-accent transition-colors line-clamp-1">
                    {room.name.replace(/공유방/g, "게시판")}
                  </h3>
                </div>
                <p className="text-xs text-ink-3 font-medium">
                  게시글 <span className="text-ink-2 font-bold tabular">{count}</span>건
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );

  // 최근 등록된 복수전공 후기 위젯
  const renderDoubleMajorReviewsSection = () => (
    <Panel as="section">
      <SectionHeader
        title="최근 등록된 복수전공 후기"
        icon={<BookOpen className="w-5 h-5 text-accent" />}
        action={
          <Link href="/rooms" className={textLinkClass}>
            후기 더보기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      <div className="divide-y divide-line mt-2">
        {doubleMajorReviews.map((post) => (
          <Link
            key={post.id}
            href="/rooms"
            className="group block py-3 px-1 hover:bg-surface-2 rounded-xl transition"
          >
            <div className="flex items-center justify-between text-xs text-ink-3 mb-1">
              <span className="font-bold text-accent">
                [{post.roomName}]
              </span>
              <span>
                {post.authorName} ({post.authorBadge})
              </span>
            </div>
            <p className="text-sm font-semibold text-ink group-hover:text-accent transition-colors line-clamp-1">
              {post.title}
            </p>
          </Link>
        ))}
      </div>
    </Panel>
  );

  return (
    <div className="space-y-6">
      {/* 환영 배너 (사람과 사람을 잇는 '이음' 일러스트 포함) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-amber-500 text-white p-6 sm:p-8 shadow-sm">
        <ConnectionMotif />

        <div className="relative z-10 max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-white shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            동국대학교 교육학과 전용 종합 플랫폼 · 동국e음
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            반갑습니다, {currentUser.name}님!
            {currentRole === "admin" ? ` (${ROLE_LABELS.admin} 모드)` : ""}
          </h1>
          <p className="text-xs sm:text-sm text-brand-50 leading-relaxed font-medium">
            교육(e)으로 사람과 사람을 잇는 <strong>동국e음</strong>입니다. 학과 공지부터
            졸업요건 자가점검, 진로·복수전공 게시판, 동문 멘토링까지 한곳에서 안전하게 연결하세요.
          </p>
        </div>
      </section>

      {/* 중단 2단 그리드: 직접 일정 수정 캘린더 & 지도교수/대화/졸업요건 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 직접 일정 수정 가능한 캘린더 */}
        <EditableCalendar className="lg:col-span-7" />

        {/* 우측 패널: 지도교수 & 읽지 않은 대화 & 졸업요건 요약 */}
        <div className="lg:col-span-5 space-y-6">
          {/* 학생 전용: 나의 지도교수 영역 */}
          {isStudent && (
            <Panel as="section">
              <SectionHeader
                title="나의 지도교수"
                icon={<GraduationCap className="w-5 h-5 text-accent" />}
                action={
                  <span className="text-xs text-ink-3 font-medium">
                    학생 지도 시스템
                  </span>
                }
              />

              {myAdvisorInfo.status === "assigned" && myAdvisorInfo.professor ? (
                <div className="p-4 rounded-2xl border border-line bg-surface-2 flex flex-col gap-3 mt-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={myAdvisorInfo.professor.name}
                      role="professor"
                      size="lg"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-ink">
                          {myAdvisorInfo.professor.name}
                        </span>
                        <span className="text-xs font-semibold text-accent">
                          {myAdvisorInfo.professor.studentIdOrYear || "교육학과 전임교원"}
                        </span>
                      </div>
                      <p className="text-xs text-ink-2">
                        동국대학교 사범대학 교육학과
                      </p>
                      {myAdvisorInfo.professor.specialty && (
                        <p className="text-xs text-ink-3 truncate">
                          전문 분야: {myAdvisorInfo.professor.specialty}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-line text-xs">
                    <Badge
                      tone={myAdvisorInfo.professor.consultationAvailable !== false ? "success" : "neutral"}
                    >
                      {myAdvisorInfo.professor.consultationAvailable !== false
                        ? "● 상담 가능"
                        : "현재 상담 불가"}
                    </Badge>
                    <Link
                      href={`/chat?consultProfessorId=${myAdvisorInfo.professor.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1"
                    >
                      상담 신청
                    </Link>
                  </div>
                </div>
              ) : myAdvisorInfo.status === "invalid_status" ? (
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-center gap-2 mt-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">지정된 지도교수 계정 상태를 확인할 수 없습니다.</p>
                    <p className="text-amber-700 mt-0.5">
                      학과사무실 또는 관리자에게 지도교수 지정을 문의해 주세요.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-line text-center space-y-1 bg-surface-2 mt-3">
                  <p className="text-sm font-bold text-ink">지도교수 미배정</p>
                  <p className="text-xs text-ink-3">
                    배정된 지도교수님이 없습니다. 학과사무실에 지정을 요청해 주세요.
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* 읽지 않은 대화 */}
          <Panel as="section">
            <SectionHeader
              title="읽지 않은 대화"
              icon={<MessageSquare className="w-5 h-5 text-accent" />}
              action={
                <Link href="/chat" className={textLinkClass}>
                  대화창 이동 <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />

            {unreadConversations.length === 0 ? (
              <div className="p-5 rounded-2xl bg-surface-2 text-center text-xs text-ink-3 mt-3">
                현재 읽지 않은 새 메시지가 없습니다.
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {unreadConversations.map((conv) => {
                  const myMember = conv.members.find(
                    (m) => m.userId === currentUser.id
                  );
                  return (
                    <Link
                      key={conv.id}
                      href="/chat"
                      className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-2 hover:bg-surface-3 transition border border-transparent hover:border-line"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-ink truncate group-hover:text-accent transition-colors">
                            {conv.title}
                          </p>
                          <CountBadge count={myMember?.unreadCount || 0} />
                        </div>
                        <p className="text-xs text-ink-2 truncate mt-1">
                          {conv.lastMessageText}
                        </p>
                      </div>
                      <span className="text-xs text-ink-3 shrink-0 tabular">
                        {conv.lastMessageAt}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* 재학생 전용: 나의 졸업요건 자가점검 요약 */}
          {isStudent && (
            <Panel as="section">
              <SectionHeader
                title="졸업요건 자가점검 요약"
                icon={<CheckSquare className="w-5 h-5 text-accent" />}
                action={
                  <Link href="/graduation" className={textLinkClass}>
                    상세 기록하기 <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />

              <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-2.5 text-xs mt-3">
                {(() => {
                  const homeAudit = calculateGraduationAudit(studentProgress, graduationCatalog);
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-3">적용 기준</span>
                        <span className="font-bold text-ink">
                          {homeAudit.profile.admissionYearLabel} · {studentProgress.majorType}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-3">총 이수 학점</span>
                        <span className="font-bold text-accent tabular">
                          {homeAudit.totalEarnedCredits}학점 / {homeAudit.applicable.cohortRule.totalGraduationCredits}학점
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ink-3">교육봉사 시간</span>
                        <span className="font-bold text-accent tabular">
                          {homeAudit.volunteeringAudit.effectiveHours}시간 / {homeAudit.volunteeringAudit.targetHours}시간
                        </span>
                      </div>
                    </>
                  );
                })()}
                <p className="text-[11px] text-ink-3 pt-2 border-t border-line">
                  ※ 공식 학사 시스템 연동이 아닌 개인 자가점검 메모입니다.
                </p>
              </div>
            </Panel>
          )}

          {/* 비재학생(관리자·졸업생·교수진) 모드: 게시판 & 후기 배치 */}
          {!isStudent && (
            <>
              {renderJoinedRoomsSection()}
              {renderDoubleMajorReviewsSection()}
            </>
          )}
        </div>
      </div>

      {/* 재학생 모드: 하단 2열에 진로 게시판 & 복수전공 후기 */}
      {isStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderJoinedRoomsSection()}
          {renderDoubleMajorReviewsSection()}
        </div>
      )}

      {/* 추천 졸업생 동문 프로필 */}
      <Panel as="section">
        <SectionHeader
          title="추천 졸업생 동문 프로필"
          icon={<Users className="w-5 h-5 text-accent" />}
          action={
            <Link href="/alumni" className={textLinkClass}>
              졸업생 전체 탐색 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {recommendedAlumni.map((alumni) => (
            <Link
              key={alumni.id}
              href="/alumni"
              className="group p-4 rounded-2xl border border-line bg-surface-2 hover:bg-surface-3 transition flex items-start gap-3.5"
            >
              <Avatar name={alumni.displayName} role="alumni" size="md" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-sm text-ink group-hover:text-accent transition-colors">
                    {alumni.displayName}
                  </span>
                  <Badge tone="brand">{alumni.careerTrack}</Badge>
                </div>
                <p className="text-xs font-semibold text-ink-2 truncate">
                  {alumni.currentRoleTitle}
                </p>
                <p className="text-xs text-ink-3 truncate">
                  {alumni.doubleMajor} · {alumni.graduationYear}년 졸업
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/**
 * 환영 배너 오른쪽의 '이음' 그림: 사람(점)과 사람을 잇는 선 SVG 애니메이션.
 */
function ConnectionMotif() {
  const links = [
    "M48 178 L142 96",
    "M142 96 L246 150",
    "M246 150 L330 58",
    "M246 150 L372 196",
    "M142 96 L330 58",
    "M48 178 L196 224",
    "M196 224 L246 150",
  ];
  const nodes: [number, number, number][] = [
    [48, 178, 5],
    [142, 96, 7],
    [246, 150, 9],
    [330, 58, 6],
    [372, 196, 5],
    [196, 224, 4],
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 260"
      fill="none"
      className="pointer-events-none absolute top-1/2 -right-8 hidden h-[135%] -translate-y-1/2 text-white sm:block"
    >
      {links.map((d, i) => (
        <path
          key={d}
          d={d}
          pathLength={1}
          stroke="currentColor"
          strokeOpacity={i === 4 ? 0.14 : 0.26}
          strokeWidth={1.5}
          strokeDasharray={i === 4 ? "0.02 0.02" : "1"}
          className={i === 4 ? undefined : "animate-draw [stroke-dashoffset:1]"}
          style={i === 4 ? undefined : { animationDelay: `${i * 90}ms` }}
        />
      ))}
      {nodes.map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r + 7} stroke="currentColor" strokeOpacity={i === 2 ? 0.35 : 0.16} />
          <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity={i === 2 ? 0.95 : 0.4} />
        </g>
      ))}
    </svg>
  );
}

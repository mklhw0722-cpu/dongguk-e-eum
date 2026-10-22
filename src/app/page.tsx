"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { User } from "@/types";
import {
  ROLE_LABELS,
  DemoInfoBanner,
  NOTICE_CATEGORY_TONE,
} from "@/components/common/Cards";
import {
  Avatar,
  AvatarStack,
  Badge,
  CountBadge,
  EmptyState,
  Panel,
  SectionHeader,
  buttonClass,
  textLinkClass,
} from "@/components/ui";
import {
  Megaphone,
  MessageSquare,
  Compass,
  Users,
  CheckSquare,
  ArrowRight,
  Pin,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Briefcase,
} from "lucide-react";

export default function HomePage() {
  const {
    currentUser,
    currentRole,
    users,
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

  // 대화 상대 표시용
  const otherMembersOf = (memberIds: string[]) =>
    memberIds
      .filter((id) => id !== currentUser.id)
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => Boolean(u));

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
    <div className="space-y-8">
      {/* 환영 배너 */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-600 px-6 py-7 text-white sm:px-9 sm:py-9 dark:bg-brand-800">
        <ConnectionMotif />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" aria-hidden="true" />
              동국대학교 교육학과 폐쇄형 소통 플랫폼 · 동국e음
            </p>
            <h1 className="text-[28px] leading-tight font-bold sm:text-display">
              반갑습니다, {currentUser.name}님!{" "}
              <span className="block text-lg font-semibold sm:inline sm:text-2xl">
                ({ROLE_LABELS[currentRole]} 모드)
              </span>
            </h1>
            <p className="text-sm leading-relaxed sm:text-body">
              교육(e)으로 사람과 사람을 잇는 <strong className="font-bold">동국e음</strong>입니다.
              학과 공지부터 졸업요건 자가점검, 복수전공·진로 트랙 공유방, 동문 멘토링까지
              한곳에서 연결하세요.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
            <Link
              href="/chat"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-brand-700 shadow-raise transition-colors hover:bg-brand-50"
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              대화창 열기
              <CountBadge count={unreadConversations.length} />
            </Link>
            <Link
              href="/auth"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black/15 px-5 text-sm font-semibold text-white transition-colors hover:bg-black/25"
            >
              가입·승인 프로세스 보기
            </Link>
          </div>
        </div>
      </section>

      <DemoInfoBanner
        title="현재 화면은 역할별 맞춤 홈 대시보드(데모)입니다."
        description="상단 바에서 [재학생 / 졸업생 / 교수 / 관리자] 버튼을 누르면 각 사용자 유형에 맞춰 추천 메뉴와 바로가기가 즉시 전환됩니다."
      />

      {/* 역할별 맞춤 바로가기 3종 */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-bold text-ink">{ROLE_LABELS[currentRole]} 맞춤 바로가기</h2>
          <span className="text-xs text-ink-3">현재 선택된 역할: {ROLE_LABELS[currentRole]}</span>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {roleShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-raise"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <Badge tone="neutral">{item.badge}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink transition-colors group-hover:text-accent">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.desc}</p>
                  <span className="mt-auto flex items-center justify-between pt-4 text-sm font-semibold text-accent">
                    바로 이동하기
                    <ArrowRight
                      className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 중단 2단 그리드: 최근 학과 공지 & 읽지 않은 채팅 + 졸업요건 바로가기 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 최근 학과 공지 */}
        <Panel as="section" className="lg:col-span-7 lg:self-start">
          <SectionHeader
            title={
              <span className="inline-flex flex-wrap items-center gap-2">
                최근 학교·교육학과 공지
                <Badge tone="demo">예시 데이터</Badge>
              </span>
            }
            action={
              <Link href="/notices" className={textLinkClass}>
                전체보기 <ArrowRight aria-hidden="true" />
              </Link>
            }
          />

          <ul className="mt-2 divide-y divide-line">
            {notices.slice(0, 4).map((notice) => (
              <li key={notice.id}>
                <Link
                  href="/notices"
                  className="group -mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-center gap-1.5">
                    {notice.isPinned && (
                      <Badge tone="brand" variant="solid" icon={<Pin />}>
                        고정
                      </Badge>
                    )}
                    <Badge tone={NOTICE_CATEGORY_TONE[notice.category] ?? "neutral"} dot>
                      {notice.category}
                    </Badge>
                    <span className="tabular ml-auto shrink-0 text-xs text-ink-3">
                      {notice.createdAt}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm font-medium text-ink transition-colors group-hover:text-accent">
                    {notice.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 우측: 읽지 않은 채팅 & 나의 졸업요건 확인 바로가기 */}
        <div className="space-y-6 lg:col-span-5">
          {/* 읽지 않은 채팅 */}
          <Panel as="section">
            <SectionHeader
              title="읽지 않은 대화"
              count={unreadConversations.length}
              action={
                <Link href="/chat" className={textLinkClass}>
                  대화창 이동 <ArrowRight aria-hidden="true" />
                </Link>
              }
            />

            {unreadConversations.length === 0 ? (
              <EmptyState
                compact
                className="mt-3"
                icon={<MessageSquare />}
                title="현재 읽지 않은 새 메시지가 없습니다."
              />
            ) : (
              <ul className="mt-2 space-y-0.5">
                {unreadConversations.map((conv) => {
                  const myMember = conv.members.find(
                    (m) => m.userId === currentUser.id
                  );
                  const others = otherMembersOf(conv.memberIds);
                  return (
                    <li key={conv.id}>
                      <Link
                        href="/chat"
                        className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
                      >
                        {conv.isGroup ? (
                          <AvatarStack
                            people={others.map((u) => ({
                              name: u.name,
                              initials: u.avatarInitials,
                              role: u.role,
                            }))}
                            max={2}
                            size="sm"
                          />
                        ) : others[0] ? (
                          <Avatar
                            name={others[0].name}
                            initials={others[0].avatarInitials}
                            role={others[0].role}
                          />
                        ) : (
                          <Avatar name={conv.title} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{conv.title}</p>
                          <p className="truncate text-[13px] text-ink-3">{conv.lastMessageText}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="tabular text-xs text-ink-3">{conv.lastMessageAt}</span>
                          <CountBadge count={myMember?.unreadCount ?? 0} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* 나의 졸업요건 확인 바로가기 */}
          <Panel as="section">
            <SectionHeader
              title="나의 졸업요건 자가점검 요약"
              action={
                <Link href="/graduation" className={textLinkClass}>
                  상세 기록하기 <ArrowRight aria-hidden="true" />
                </Link>
              }
            />

            <dl className="mt-3 divide-y divide-line rounded-xl bg-surface-2 px-3.5 text-sm">
              <div className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-ink-3">적용 기준 정보</dt>
                <dd className="text-right font-semibold text-ink">
                  {studentProgress.admissionYear} · {studentProgress.majorType}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-ink-3">내가 기록한 총 이수 학점</dt>
                <dd className="text-right">
                  <span className="tabular font-semibold text-ink">
                    {studentProgress.credits["졸업 이수 학점"]?.completedValue ?? 0}학점
                  </span>{" "}
                  <span className="text-xs font-medium text-warning">(기준 미설정)</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-ink-3">내가 기록한 교육봉사 시간</dt>
                <dd className="text-right">
                  <span className="tabular font-semibold text-ink">
                    {studentProgress.credits["교육봉사 시간"]?.completedValue ?? 0}시간
                  </span>{" "}
                  <span className="text-xs font-medium text-warning">(기준 미설정)</span>
                </dd>
              </div>
            </dl>
            <p className="mt-2.5 text-xs leading-relaxed text-ink-3">
              ※ 공식 학사 시스템 연동 결과가 아닌 학생 개인의 자가점검 메모입니다.
            </p>
          </Panel>
        </div>
      </div>

      {/* 내가 참여한 진로 공유방 & 최근 등록된 복수전공 후기 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 내가 참여한 진로 공유방 */}
        <Panel as="section">
          <SectionHeader
            title="내가 참여 중인 공유방"
            count={myJoinedRooms.length}
            action={
              <Link href="/rooms" className={textLinkClass}>
                전체 공유방 탐색 <ArrowRight aria-hidden="true" />
              </Link>
            }
          />

          {myJoinedRooms.length === 0 ? (
            <EmptyState
              compact
              className="mt-3"
              icon={<Compass />}
              title="아직 참여 중인 공유방이 없어요"
              description="관심 있는 진로 트랙이나 복수전공 공유방에 참여해 보세요."
              action={
                <Link href="/rooms" className={buttonClass("secondary", "sm")}>
                  공유방 둘러보기
                </Link>
              }
            />
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {myJoinedRooms.slice(0, 4).map((room) => (
                <li key={room.id}>
                  <Link
                    href="/rooms"
                    className="group flex h-full flex-col items-start gap-1.5 rounded-xl bg-surface-2 p-3.5 transition-colors hover:bg-surface-3"
                  >
                    <Badge tone={room.type === "career" ? "brand" : "info"}>
                      {room.type === "career" ? "진로 트랙" : "복수전공"} · {room.categoryName}
                    </Badge>
                    <h3 className="text-sm font-semibold text-ink transition-colors group-hover:text-accent">
                      {room.name}
                    </h3>
                    <p className="text-xs text-ink-3">참여 인원 {room.memberIds.length}명</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 최근 등록된 복수전공 후기 */}
        <Panel as="section">
          <SectionHeader
            title="최근 등록된 복수전공 후기"
            action={
              <Link href="/rooms" className={textLinkClass}>
                후기 더보기 <ArrowRight aria-hidden="true" />
              </Link>
            }
          />

          <ul className="mt-2 divide-y divide-line">
            {doubleMajorReviews.map((post) => (
              <li key={post.id}>
                <Link
                  href="/rooms"
                  className="group -mx-2 block rounded-lg px-2 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="info">{post.roomName}</Badge>
                    <span className="truncate text-xs text-ink-3">
                      {post.authorName} ({post.authorBadge})
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-medium text-ink transition-colors group-hover:text-accent">
                    {post.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* 추천 졸업생 멘토 */}
      <Panel as="section">
        <SectionHeader
          title="추천 졸업생 동문 프로필"
          action={
            <Link href="/alumni" className={textLinkClass}>
              졸업생 전체 탐색 <ArrowRight aria-hidden="true" />
            </Link>
          }
        />

        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {recommendedAlumni.map((alumni) => (
            <li key={alumni.id}>
              <Link
                href="/alumni"
                className="group flex h-full items-start gap-3 rounded-xl bg-surface-2 p-4 transition-colors hover:bg-surface-3"
              >
                <Avatar name={alumni.displayName} role="alumni" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink transition-colors group-hover:text-accent">
                      {alumni.displayName}
                    </span>
                    <Badge tone="brand">{alumni.careerTrack}</Badge>
                  </div>
                  <p className="text-[13px] font-medium text-ink-2">{alumni.currentRoleTitle}</p>
                  <p className="text-xs text-ink-3">
                    복수전공: {alumni.doubleMajor} · {alumni.graduationYear}년 졸업
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/**
 * 환영 배너 오른쪽의 '이음' 그림: 사람(점)과 사람을 잇는 선.
 * 처음 열릴 때 한 번만 선이 그려진다 (동작 줄이기 설정이면 바로 완성된 상태).
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
          <circle cx={cx} cy={cy} r={r + 7} stroke="currentColor" strokeOpacity={0.16} />
          <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity={i === 2 ? 0.9 : 0.35} />
        </g>
      ))}
    </svg>
  );
}

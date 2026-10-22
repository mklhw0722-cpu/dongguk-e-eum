"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, CAREER_TRACK_LIST } from "@/context/AppContext";
import { AlumniProfile, CareerTrack } from "@/types";
import {
  AlumniCard,
  EmptyStateBox,
  DemoInfoBanner,
} from "@/components/common/Cards";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  SectionHeader,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { MessageSquare, Sparkles, Lock, Globe } from "lucide-react";

type AlumniTab = "directory" | "mentoring" | "my_profile";

const MENTORING_STATUS_TONE: Record<string, BadgeTone> = {
  대기중: "warning",
  수락됨: "success",
  답변완료: "info",
};

export default function AlumniPage() {
  const router = useRouter();
  const toast = useToast();
  const {
    alumniProfiles,
    mentoringRequests,
    createMentoringRequest,
    updateMentoringStatus,
    upsertAlumniProfile,
    startOrOpenDirectChat,
    currentRole,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCareer, setSelectedCareer] = useState<string>("전체");
  const [selectedDoubleMajor, setSelectedDoubleMajor] = useState<string>("전체");
  const [activeTab, setActiveTab] = useState<AlumniTab>("directory");

  // 모달 상태
  const [detailAlumni, setDetailAlumni] = useState<AlumniProfile | null>(null);
  const [mentoringTarget, setMentoringTarget] = useState<AlumniProfile | null>(
    null
  );
  const [mentoringTopic, setMentoringTopic] = useState("");
  const [mentoringMsg, setMentoringMsg] = useState("");

  // 졸업생 본인 프로필 등록/수정 상태 (데모)
  const [profName, setProfName] = useState("정혜원 (18학번)");
  const [profGradYear, setProfGradYear] = useState(2023);
  const [profDoubleMajor, setProfDoubleMajor] = useState("심리학");
  const [profCareer, setProfCareer] = useState<CareerTrack>("기업 HRD");
  const [profRoleTitle, setProfRoleTitle] = useState("인재개발원 교육기획 매니저");
  const [profOrg, setProfOrg] = useState("국내 대기업 그룹 인재개발원 (예시)");
  const [profBio, setProfBio] = useState(
    "교육학 전공과 심리학 복수전공을 연결해 기업 HRD 직무로 일하고 있습니다."
  );
  const [profExp, setProfExp] = useState(
    "신입사원 온보딩 프로그램 개발 및 리더십 과정 운영 경험을 공유합니다."
  );
  const [profShowOrg, setProfShowOrg] = useState(true);
  const [profShowEmail, setProfShowEmail] = useState(false);
  const [profMentoringAvail, setProfMentoringAvail] = useState(true);

  const doubleMajorOptions = [
    "전체",
    ...Array.from(new Set(alumniProfiles.map((a) => a.doubleMajor))),
  ];

  const filteredAlumni = alumniProfiles.filter((a) => {
    const matchCareer =
      selectedCareer === "전체" || a.careerTrack === selectedCareer;
    const matchDM =
      selectedDoubleMajor === "전체" || a.doubleMajor === selectedDoubleMajor;
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
    const targetName = mentoringTarget.displayName;
    setMentoringTarget(null);
    setMentoringTopic("");
    setMentoringMsg("");
    toast({
      title: `${targetName} 동문에게 멘토링 신청이 접수되었습니다!`,
      description: "[멘토링 요청 현황] 탭에서 확인할 수 있습니다.",
    });
  };

  const handleSaveMyAlumniProfile = (e: React.FormEvent) => {
    e.preventDefault();
    upsertAlumniProfile({
      displayName: profName,
      graduationYear: Number(profGradYear),
      admissionYear: Number(profGradYear) - 5,
      doubleMajor: profDoubleMajor,
      careerTrack: profCareer,
      currentRoleTitle: profRoleTitle,
      organization: profOrg,
      bio: profBio,
      experienceSummary: profExp,
      mentoringAvailable: profMentoringAvail,
      interests: [profCareer, profDoubleMajor, "진로멘토링"],
      privacy: {
        showOrganization: profShowOrg,
        showEmail: profShowEmail,
        allowDirectChat: true,
      },
    });
    toast({ title: "졸업생 프로필 및 개인정보 공개 범위가 저장되었습니다." });
    setActiveTab("directory");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="졸업생 동문 연결 네트워크"
        description="교직, 교육행정, 공공기관, 기업 HRD, 에듀테크, 대학원 등 각 분야로 진출한 교육학과 선배들과 연결하세요."
      />

      <Tabs
        variant="underline"
        label="졸업생 동문 메뉴"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            value: "directory",
            label: "동문 프로필 탐색",
            count: alumniProfiles.length,
          },
          {
            value: "mentoring",
            label: "멘토링 요청 현황",
            count: mentoringRequests.length,
          },
          { value: "my_profile", label: "졸업생 프로필·공개범위 설정" },
        ]}
      />

      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* 검색 및 진로·복수전공 이중 필터 */}
          <Panel className="space-y-3">
            <SearchInput
              label="동문 검색"
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="선배 이름, 직무, 관심 키워드(예: 온보딩, 임용, PM, NCS) 검색..."
            />
            <ChipGroup label="진로 분야" scroll>
              {["전체", ...CAREER_TRACK_LIST].map((track) => (
                <Chip
                  key={track}
                  selected={selectedCareer === track}
                  onClick={() => setSelectedCareer(track)}
                >
                  {track}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup label="복수전공" scroll>
              {doubleMajorOptions.map((dm) => (
                <Chip
                  key={dm}
                  selected={selectedDoubleMajor === dm}
                  onClick={() => setSelectedDoubleMajor(dm)}
                >
                  {dm}
                </Chip>
              ))}
            </ChipGroup>
          </Panel>

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
            <>
              <p className="text-sm text-ink-3" aria-live="polite">
                동문 <span className="tabular font-semibold text-ink-2">{filteredAlumni.length}</span>명
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </>
          )}
        </div>
      )}

      {activeTab === "mentoring" && (
        <div className="space-y-4">
          <DemoInfoBanner
            title="멘토링 요청 확인 및 상태 변경"
            description="재학생이 신청한 멘토링 내역을 확인하고, 졸업생 역할에서는 '수락됨' 또는 '답변완료'로 상태를 변경할 수 있습니다."
          />

          {mentoringRequests.length === 0 ? (
            <EmptyState
              title="멘토링 요청이 없습니다"
              description="동문 프로필에서 멘토링을 신청하면 이곳에 표시됩니다."
              action={
                <Button variant="secondary" onClick={() => setActiveTab("directory")}>
                  동문 프로필 탐색
                </Button>
              }
            />
          ) : (
            <Panel>
              <p className="mb-4 text-sm text-ink-3">
                {currentRole === "alumni"
                  ? "졸업생 모드: 요청 상태를 변경할 수 있습니다."
                  : "상단에서 '졸업생' 역할로 전환하면 수락/답변완료 처리가 가능합니다."}
              </p>
              <ul className="divide-y divide-line border-t border-line">
                {mentoringRequests.map((req) => (
                  <li key={req.id} className="space-y-3 py-4 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Badge tone={MENTORING_STATUS_TONE[req.status] ?? "neutral"} dot>
                          {req.status}
                        </Badge>
                        <span className="text-sm text-ink-2">
                          신청자: {req.fromUserName} → 멘토: {req.toAlumniName}
                        </span>
                      </div>
                      <span className="tabular text-xs text-ink-3">{req.createdAt}</span>
                    </div>

                    <h3 className="text-base font-semibold text-ink">{req.topic}</h3>
                    <p className="rounded-xl bg-surface-2 p-3.5 text-sm leading-relaxed text-ink-2">
                      {req.message}
                    </p>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => updateMentoringStatus(req.id, "수락됨")}
                      >
                        멘토링 수락
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateMentoringStatus(req.id, "답변완료")}
                      >
                        답변완료 표시
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {activeTab === "my_profile" && (
        <Panel padding="lg" className="space-y-5">
          <SectionHeader
            title="졸업생 진로 프로필 등록 및 개인정보 공개 범위 설정"
            description="졸업생 회원은 본인의 소속 직장명, 이메일, 멘토링 가능 여부를 직접 선택해 공개 범위를 제어할 수 있습니다."
          />

          <form
            onSubmit={handleSaveMyAlumniProfile}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Field label="표시 이름 또는 닉네임">
              <Input
                type="text"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
              />
            </Field>

            <Field label="졸업 연도">
              <Input
                type="number"
                inputMode="numeric"
                value={profGradYear}
                onChange={(e) => setProfGradYear(Number(e.target.value))}
              />
            </Field>

            <Field label="진로 분야">
              <Select
                value={profCareer}
                onChange={(e) => setProfCareer(e.target.value as CareerTrack)}
              >
                {CAREER_TRACK_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="복수전공 이수 내역">
              <Input
                type="text"
                value={profDoubleMajor}
                onChange={(e) => setProfDoubleMajor(e.target.value)}
                placeholder="예: 심리학, 경영학, 단일전공(교육학)"
              />
            </Field>

            <Field label="현재 담당 직무명">
              <Input
                type="text"
                value={profRoleTitle}
                onChange={(e) => setProfRoleTitle(e.target.value)}
              />
            </Field>

            <Field label="현재 소속 기관/기업명 (선택 공개)">
              <Input
                type="text"
                value={profOrg}
                onChange={(e) => setProfOrg(e.target.value)}
              />
            </Field>

            <Field label="한 줄 자기소개" className="sm:col-span-2">
              <Input
                type="text"
                value={profBio}
                onChange={(e) => setProfBio(e.target.value)}
              />
            </Field>

            <Field label="후배들에게 나눌 수 있는 경험 상세" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={profExp}
                onChange={(e) => setProfExp(e.target.value)}
              />
            </Field>

            {/* 개인정보 공개 범위 설정 박스 */}
            <Panel
              tone="muted"
              padding="sm"
              role="group"
              aria-labelledby="alumni-privacy-title"
              className="space-y-3 sm:col-span-2"
            >
              <p
                id="alumni-privacy-title"
                className="flex items-center gap-1.5 text-sm font-semibold text-ink"
              >
                <Lock className="size-4 text-ink-3" aria-hidden="true" />
                개인정보 및 멘토링 공개 범위 설정
              </p>
              <Checkbox
                checked={profShowOrg}
                onChange={(e) => setProfShowOrg(e.target.checked)}
                label="현재 소속 직장/기관명을 후배들에게 공개합니다"
                description="해제 시 비공개 처리"
              />
              <Checkbox
                checked={profShowEmail}
                onChange={(e) => setProfShowEmail(e.target.checked)}
                label="개인 이메일 연락처를 프로필 상세에 표시합니다"
              />
              <Checkbox
                checked={profMentoringAvail}
                onChange={(e) => setProfMentoringAvail(e.target.checked)}
                label="현재 멘토링 신청 접수를 받습니다"
              />
            </Panel>

            <div className="flex sm:col-span-2 sm:justify-end">
              <Button type="submit" variant="primary" className="max-sm:w-full">
                프로필 및 공개 설정 저장
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* 상세 프로필 모달 */}
      {detailAlumni && (
        <Modal
          open
          onClose={() => setDetailAlumni(null)}
          size="lg"
          meta={<Badge tone="brand">{detailAlumni.careerTrack} 트랙</Badge>}
          title={detailAlumni.displayName}
          description={`${detailAlumni.graduationYear}년 졸업 · 복수전공: ${detailAlumni.doubleMajor}`}
          footer={
            <>
              <Button
                variant="secondary"
                icon={<MessageSquare className="size-4" />}
                onClick={() => {
                  const target = detailAlumni;
                  setDetailAlumni(null);
                  handleRequestChat(target);
                }}
              >
                1:1 대화 요청
              </Button>
              <Button
                variant="primary"
                icon={<Sparkles className="size-4" />}
                onClick={() => {
                  const target = detailAlumni;
                  setDetailAlumni(null);
                  setMentoringTarget(target);
                }}
              >
                멘토링 신청하기
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-xl bg-surface-2 p-3.5">
              <Avatar
                name={detailAlumni.displayName}
                role="alumni"
                size="xl"
              />
              <dl className="min-w-0 flex-1 space-y-2.5 text-sm">
                <div>
                  <dt className="text-xs text-ink-3">현재 직무</dt>
                  <dd className="font-semibold text-ink">
                    {detailAlumni.currentRoleTitle}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">현재 소속 (선택 공개)</dt>
                  <dd>
                    {detailAlumni.privacy.showOrganization ? (
                      <span className="flex items-start gap-1.5 font-medium text-success">
                        <Globe className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {detailAlumni.organization}
                      </span>
                    ) : (
                      <span className="flex items-start gap-1.5 text-ink-3">
                        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        본인 설정에 의해 비공개
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4 text-sm">
              <section className="space-y-1.5">
                <h3 className="font-semibold text-ink">소개 및 진로 스토리</h3>
                <p className="leading-relaxed text-ink-2">{detailAlumni.bio}</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="font-semibold text-ink">
                  멘토링 가능 주제 및 경험 요약
                </h3>
                <p className="leading-relaxed text-ink-2">
                  {detailAlumni.experienceSummary}
                </p>
              </section>
            </div>

            {detailAlumni.interests.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="관심 분야">
                {detailAlumni.interests.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2"
                  >
                    #{tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {/* 멘토링 신청 모달 */}
      {mentoringTarget && (
        <Modal
          open
          onClose={() => setMentoringTarget(null)}
          title={`${mentoringTarget.displayName} 동문에게 멘토링 신청`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setMentoringTarget(null)}>
                취소
              </Button>
              <Button type="submit" form="mentoring-request-form" variant="primary">
                멘토링 요청 등록
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3.5">
              <Avatar name={mentoringTarget.displayName} role="alumni" size="md" />
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {mentoringTarget.displayName}
                </p>
                <p className="text-xs text-ink-3">
                  {mentoringTarget.careerTrack} · {mentoringTarget.currentRoleTitle}
                </p>
              </div>
            </div>

            <form
              id="mentoring-request-form"
              onSubmit={handleSubmitMentoring}
              className="space-y-4"
            >
              <Field label="질문/멘토링 주제">
                <Input
                  type="text"
                  required
                  value={mentoringTopic}
                  onChange={(e) => setMentoringTopic(e.target.value)}
                  placeholder="예: 복수전공 학점 관리와 직무 인턴 준비 시기 문의"
                />
              </Field>

              <Field label="상세 질문 내용">
                <Textarea
                  rows={4}
                  required
                  value={mentoringMsg}
                  onChange={(e) => setMentoringMsg(e.target.value)}
                  placeholder="선배님이 답변하기 쉽도록 본인의 학년, 관심 분야, 궁금한 점을 구체적으로 적어주세요."
                />
              </Field>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

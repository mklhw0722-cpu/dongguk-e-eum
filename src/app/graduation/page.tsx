"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { GraduationRequirement, RequirementCategory } from "@/types";
import { RequirementProgressCard } from "@/components/common/Cards";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Panel,
  SectionHeader,
  Select,
  useToast,
} from "@/components/ui";
import {
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Circle,
  Settings,
} from "lucide-react";

export default function GraduationPage() {
  const {
    graduationRequirements,
    studentProgress,
    updateStudentCredit,
    updateStudentProfileMeta,
    addVolunteeringRecord,
    removeVolunteeringRecord,
    toggleChecklistItem,
    addChecklistItem,
  } = useApp();
  const toast = useToast();

  // 학점/목표 수정 모달 상태
  const [editingReq, setEditingReq] = useState<GraduationRequirement | null>(
    null
  );
  const [editCompletedVal, setEditCompletedVal] = useState<number>(0);
  const [editCustomTarget, setEditCustomTarget] = useState<string>("");
  const [editBooleanVal, setEditBooleanVal] = useState<boolean>(false);

  // 학생 기본 소속/학번 설정 모달
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaYear, setMetaYear] = useState(studentProgress.admissionYear);
  const [metaMajorType, setMetaMajorType] = useState(studentProgress.majorType);
  const [metaDoubleMajor, setMetaDoubleMajor] = useState(
    studentProgress.doubleMajorName
  );
  const [metaTeacher, setMetaTeacher] = useState(studentProgress.isTeacherTrack);

  // 교육봉사 추가 폼 상태
  const [volInst, setVolInst] = useState("");
  const [volDate, setVolDate] = useState("");
  const [volHours, setVolHours] = useState<number>(4);
  const [volNote, setVolNote] = useState("");

  // 체크리스트 추가 폼 상태
  const [newChkLabel, setNewChkLabel] = useState("");
  const [newChkCat, setNewChkCat] =
    useState<RequirementCategory>("졸업 이수 학점");
  const [newChkMemo, setNewChkMemo] = useState("");

  const openEditModal = (req: GraduationRequirement) => {
    const currentRecord = studentProgress.credits[req.category];
    setEditingReq(req);
    setEditCompletedVal(currentRecord?.completedValue ?? 0);
    setEditCustomTarget(
      currentRecord?.userCustomTarget !== null &&
        currentRecord?.userCustomTarget !== undefined
        ? String(currentRecord.userCustomTarget)
        : ""
    );
    setEditBooleanVal(Boolean(currentRecord?.isCompletedBoolean));
  };

  const openMetaModal = () => {
    setMetaYear(studentProgress.admissionYear);
    setMetaMajorType(studentProgress.majorType);
    setMetaDoubleMajor(studentProgress.doubleMajorName);
    setMetaTeacher(studentProgress.isTeacherTrack);
    setIsMetaModalOpen(true);
  };

  const handleSaveCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;
    const parsedTarget =
      editCustomTarget.trim() === "" ? null : Number(editCustomTarget);
    updateStudentCredit(
      editingReq.category,
      Number(editCompletedVal),
      parsedTarget && parsedTarget > 0 ? parsedTarget : null,
      editBooleanVal
    );
    setEditingReq(null);
    toast({ title: "자가점검 기록을 저장했어요" });
  };

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudentProfileMeta(
      metaYear,
      metaMajorType,
      metaDoubleMajor,
      metaTeacher
    );
    setIsMetaModalOpen(false);
    toast({ title: "입학 연도·전공 이수 형태를 적용했어요" });
  };

  const handleAddVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!volInst.trim() || !volDate.trim() || volHours <= 0) return;
    addVolunteeringRecord(
      volInst.trim(),
      volDate.trim(),
      Number(volHours),
      volNote.trim() || "자가점검 봉사 기록"
    );
    setVolInst("");
    setVolDate("");
    setVolHours(4);
    setVolNote("");
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChkLabel.trim()) return;
    addChecklistItem(newChkLabel.trim(), newChkCat, newChkMemo.trim());
    setNewChkLabel("");
    setNewChkMemo("");
  };

  const completedCheckCount = studentProgress.checklist.filter(
    (c) => c.completed
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="졸업요건 자가점검 대시보드"
        description="입학 연도와 다전공·교직 여부에 따른 나의 학점, 교육봉사 시간, 필수 체크리스트를 직접 기록하고 점검하세요."
        actions={
          <Button variant="dark" icon={<Settings />} onClick={openMetaModal}>
            내 입학연도·이수트랙 설정
          </Button>
        }
      />

      {/* 필수 주의 배너 (기능 D 핵심 요구사항 준수) */}
      <Callout
        tone="warning"
        title="[중요 안내] 공식 학사 시스템 연동 결과가 아닌 개인 ‘자가점검’ 화면입니다"
      >
        <ul className="list-disc space-y-1 pl-4">
          <li>
            동국대학교의 실제 졸업요건 수치나 교육봉사 기준 시간은 <strong>입학 연도(학번), 단일/복수전공 여부, 교직 이수 여부</strong>에 따라 달라지므로 시스템이 임의의 숫자를 강제하지 않습니다.
          </li>
          <li>
            공식 기준이 미설정된 항목은 <strong>허위 진행률(%)을 계산하지 않으며 ‘기준 미설정’으로 표시</strong>합니다. 본인의 학번별 대학 요람을 확인한 뒤 각 카드의 [수치·목표 수정]에서 직접 목표 기준치를 입력하면 자가점검 달성률을 볼 수 있습니다.
          </li>
        </ul>
      </Callout>

      {/* 현재 학생의 적용 요건 프로필 요약 */}
      <Panel>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">적용 입학 연도(학번)</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {studentProgress.admissionYear}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">전공 이수 형태</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {studentProgress.majorType}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">복수전공 학과</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {studentProgress.doubleMajorName || "해당 없음"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">교직 과정 여부</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {studentProgress.isTeacherTrack ? "교직 이수 병행" : "일반 학사 트랙"}
            </dd>
          </div>
        </dl>
      </Panel>

      {/* 8개 졸업요건 항목 대시보드 그리드 */}
      <section className="space-y-4">
        <SectionHeader
          title="항목별 이수 학점 및 요건 자가점검 (총 8개 영역)"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {graduationRequirements.map((req) => {
            const creditInfo = studentProgress.credits[req.category];
            return (
              <RequirementProgressCard
                key={req.id}
                requirement={req}
                completedValue={creditInfo?.completedValue ?? 0}
                userCustomTarget={creditInfo?.userCustomTarget ?? null}
                isCompletedBoolean={creditInfo?.isCompletedBoolean}
                onEdit={() => openEditModal(req)}
              />
            );
          })}
        </div>
      </section>

      {/* 교육봉사 시간 기록장 & 완료/미완료 체크리스트 */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* 교육봉사 시간 기록 */}
        <Panel as="section" className="space-y-4">
          <SectionHeader
            title="교육봉사 시간 자가 기록장"
            action={
              <Badge tone="neutral" size="md" className="tabular">
                누적 기록:{" "}
                {studentProgress.credits["교육봉사 시간"]?.completedValue ?? 0}시간
              </Badge>
            }
          />

          <form
            onSubmit={handleAddVolunteer}
            className="space-y-3 rounded-xl bg-surface-2 p-3.5"
          >
            <p className="text-sm font-semibold text-ink">
              + 새로운 교육봉사 활동 내역 추가
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="봉사 기관명" required>
                <Input
                  type="text"
                  required
                  value={volInst}
                  onChange={(e) => setVolInst(e.target.value)}
                  placeholder="예: 동국중학교 방과후학교"
                />
              </Field>
              <Field label="활동 일자/기간" required>
                <Input
                  type="text"
                  required
                  value={volDate}
                  onChange={(e) => setVolDate(e.target.value)}
                  placeholder="예: 2026-10-15"
                />
              </Field>
              <Field label="인정 시간" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  required
                  value={volHours}
                  onChange={(e) => setVolHours(Number(e.target.value))}
                  className="tabular"
                />
              </Field>
              <Field label="활동 내용 메모">
                <Input
                  type="text"
                  value={volNote}
                  onChange={(e) => setVolNote(e.target.value)}
                  placeholder="예: 기초학력 멘토링"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" icon={<Plus />} className="w-full sm:w-auto">
                기록
              </Button>
            </div>
          </form>

          {studentProgress.volunteeringRecords.length === 0 ? (
            <EmptyState
              compact
              title="아직 기록한 교육봉사 내역이 없어요"
              description="위 양식에 기관과 시간을 입력하고 ‘기록’을 눌러 보세요."
            />
          ) : (
            <ul className="divide-y divide-line">
              {studentProgress.volunteeringRecords.map((rec) => (
                <li
                  key={rec.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-ink">
                        {rec.institutionName}
                      </span>
                      <Badge tone="neutral" className="tabular">
                        +{rec.hours}시간
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      <span className="tabular">{rec.activityDate}</span> ·{" "}
                      {rec.note}
                    </p>
                  </div>
                  <IconButton
                    label="기록 삭제"
                    aria-label={`${rec.institutionName} 기록 삭제`}
                    onClick={() => removeVolunteeringRecord(rec.id)}
                    className="shrink-0 hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 완료·미완료 체크리스트 */}
        <Panel as="section" className="space-y-4">
          <SectionHeader
            title="졸업 준비 완료·미완료 체크리스트"
            action={
              <span className="tabular text-sm font-semibold text-ink-3">
                {completedCheckCount} / {studentProgress.checklist.length} 완료
              </span>
            }
          />

          <form
            onSubmit={handleAddChecklist}
            className="space-y-3 rounded-xl bg-surface-2 p-3.5"
          >
            <p className="text-sm font-semibold text-ink">+ 나만의 점검 할 일 추가</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="분류">
                <Select
                  value={newChkCat}
                  onChange={(e) =>
                    setNewChkCat(e.target.value as RequirementCategory)
                  }
                >
                  {graduationRequirements.map((r) => (
                    <option key={r.id} value={r.category}>
                      {r.category}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="점검할 항목" required>
                <Input
                  type="text"
                  required
                  value={newChkLabel}
                  onChange={(e) => setNewChkLabel(e.target.value)}
                  placeholder="예: 복수전공 필수과목 시간표 확인"
                />
              </Field>
              <Field label="보조 메모 (선택)" className="sm:col-span-2">
                <Input
                  type="text"
                  value={newChkMemo}
                  onChange={(e) => setNewChkMemo(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                추가
              </Button>
            </div>
          </form>

          {studentProgress.checklist.length === 0 ? (
            <EmptyState
              compact
              title="아직 점검 항목이 없어요"
              description="위 양식으로 나만의 점검 할 일을 추가해 보세요."
            />
          ) : (
            <ul className="divide-y divide-line">
              {studentProgress.checklist.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.completed}
                    onClick={() => toggleChecklistItem(item.id)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      {item.completed ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : (
                        <Circle className="size-5 text-ink-3" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone="neutral">{item.category}</Badge>
                        <span
                          className={`text-sm font-semibold ${
                            item.completed ? "text-ink-3 line-through" : "text-ink"
                          }`}
                        >
                          {item.label}
                        </span>
                      </span>
                      {item.memo && (
                        <span className="block text-xs text-ink-3">{item.memo}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* 관련 공식 안내 링크 영역 */}
      <Panel as="section" className="space-y-3">
        <SectionHeader
          title="동국대학교 학사·교직 공식 안내 바로가기"
          description="본인의 입학 연도(학번)에 해당하는 정확한 졸업 이수 학점과 교직·다전공 기준은 반드시 아래 공식 페이지에서 확인하세요."
        />
        <ul className="divide-y divide-line">
          {[
            "동국대학교 공식 홈페이지 (학사안내)",
            "사범대학·교육학과 교육과정 요람 확인",
            "교직부 (교육봉사·교육실습·무시험검정 안내)",
          ].map((label) => (
            <li key={label}>
              <a
                href="https://www.dongguk.edu"
                target="_blank"
                rel="noreferrer"
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <span>{label}</span>
                <ExternalLink
                  className="size-4 shrink-0 text-ink-3"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      {/* 모달 1: 학점/목표 수정 */}
      {editingReq && (
        <Modal
          open
          onClose={() => setEditingReq(null)}
          title={`${editingReq.category} 자가점검 기록 수정`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditingReq(null)}>
                취소
              </Button>
              <Button type="submit" form="graduation-credit-form">
                저장하기
              </Button>
            </>
          }
        >
          <form
            id="graduation-credit-form"
            onSubmit={handleSaveCredit}
            className="space-y-4"
          >
            {editingReq.unit === "여부" ? (
              <div className="rounded-xl bg-surface-2 p-3.5">
                <Checkbox
                  checked={editBooleanVal}
                  onChange={(e) => setEditBooleanVal(e.target.checked)}
                  label={`해당 요건(${editingReq.title})을 이수/충족 완료했습니다`}
                />
              </div>
            ) : (
              <>
                <Field label={`내가 현재까지 이수한 ${editingReq.unit}`} required>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={300}
                    required
                    value={editCompletedVal}
                    onChange={(e) => setEditCompletedVal(Number(e.target.value))}
                    className="tabular"
                  />
                </Field>

                <Field
                  label={`내 학번 요람에서 확인한 목표 기준 ${editingReq.unit} (선택 입력)`}
                  hint="※ 비워두면 임의의 진행률(%)을 계산하지 않고 ‘기준 미설정’으로 안전하게 표시합니다."
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={300}
                    value={editCustomTarget}
                    onChange={(e) => setEditCustomTarget(e.target.value)}
                    placeholder="비워두면 '기준 미설정' 상태 유지"
                    className="tabular"
                  />
                </Field>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* 모달 2: 입학 연도 및 전공 트랙 설정 */}
      {isMetaModalOpen && (
        <Modal
          open
          onClose={() => setIsMetaModalOpen(false)}
          title="내 입학 연도·전공 이수 형태 설정"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsMetaModalOpen(false)}>
                취소
              </Button>
              <Button type="submit" form="graduation-meta-form">
                적용하기
              </Button>
            </>
          }
        >
          <form
            id="graduation-meta-form"
            onSubmit={handleSaveMeta}
            className="space-y-4"
          >
            <Field label="입학 연도 (학번)">
              <Input
                type="text"
                value={metaYear}
                onChange={(e) => setMetaYear(e.target.value)}
                placeholder="예: 2022학년도 입학 (22학번)"
              />
            </Field>

            <Field label="전공 이수 구분">
              <Select
                value={metaMajorType}
                onChange={(e) =>
                  setMetaMajorType(
                    e.target.value as typeof studentProgress.majorType
                  )
                }
              >
                <option value="단일전공(심화)">단일전공(심화)</option>
                <option value="복수전공 이수">복수전공 이수</option>
                <option value="교직 이수 병행">교직 이수 병행</option>
              </Select>
            </Field>

            <Field label="복수전공 학과명">
              <Input
                type="text"
                value={metaDoubleMajor}
                onChange={(e) => setMetaDoubleMajor(e.target.value)}
                placeholder="예: 심리학과 / 경영학과 / 없음"
              />
            </Field>

            <Checkbox
              checked={metaTeacher}
              onChange={(e) => setMetaTeacher(e.target.checked)}
              label="교직 과정 이수 대상자입니다"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

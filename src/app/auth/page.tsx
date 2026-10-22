"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { UserRole } from "@/types";
import { ROLE_LABELS, DemoInfoBanner } from "@/components/common/Cards";
import {
  ShieldAlert,
  Clock,
  XCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";
import {
  Panel,
  PageHeader,
  Tabs,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  Callout,
  buttonClass,
  useToast,
} from "@/components/ui";

type AuthScreenTab =
  | "login"
  | "signup"
  | "pending"
  | "rejected_or_supplement";

const ROLE_OPTIONS: { role: UserRole; title: string; desc: string }[] = [
  {
    role: "student",
    title: "재학생 (본전공·복수전공)",
    desc: "공지 확인, 졸업요건 자가점검, 공유방·멘토링 참여",
  },
  {
    role: "alumni",
    title: "졸업생 (동문 멘토)",
    desc: "진로 프로필 등록, 후배 멘토링 및 직무 경험 공유",
  },
  {
    role: "professor",
    title: "교수진 · 강사",
    desc: "학생 검색 및 면담 요청, 연구·진로 공유방 지도",
  },
];

export default function AuthPage() {
  const {
    currentRole,
    switchRole,
    submitApprovalRequest,
    approvalRequests,
  } = useApp();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<AuthScreenTab>("signup");

  // 회원가입 데모 폼 상태
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [studentIdOrYear, setStudentIdOrYear] = useState("");
  const [verificationMethod, setVerificationMethod] = useState(
    "학교 웹메일(@dgu.ac.kr) 인증 예정 (데모)"
  );
  const [note, setNote] = useState("");
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantEmail.trim()) return;
    submitApprovalRequest({
      applicantName: applicantName.trim(),
      applicantEmail: applicantEmail.trim(),
      requestedRole: selectedRole,
      studentIdOrYear: studentIdOrYear.trim() || "학번/연도 미기재",
      verificationMethod,
      note: note.trim() || "교육학과 구성원 가입 신청 (데모)",
    });
    setApplicantName("");
    setApplicantEmail("");
    setStudentIdOrYear("");
    setNote("");
    setSubmittedNotice(true);
    setActiveTab("pending");
    toast({ title: "가입 승인 신청을 등록했어요" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="회원가입 · 소속 인증 · 관리자 승인 화면"
        description="폐쇄형 학과 플랫폼인 동국e음의 가입 절차와 승인 대기·보완 요청 UI를 미리 확인하고 테스트할 수 있습니다."
        actions={
          <Link href="/admin" className={buttonClass("dark")}>
            관리자 가입 신청 목록 바로가기 ({approvalRequests.length})
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      <DemoInfoBanner
        title="보안 및 개인정보 보호 안내 (1차 프로토타입)"
        description="현재 실제 인증 서버가 연결되어 있지 않으므로 실제 비밀번호나 민감한 증명서(재학·졸업증명서 등) 파일을 업로드하거나 저장하지 않습니다. 향후 Firebase Auth / Supabase Auth 도입 시 관리자 승인 회원만 내부 콘텐츠에 접근하도록 제어됩니다."
        variant="amber"
      />

      <Tabs<AuthScreenTab>
        variant="underline"
        label="가입·인증 화면 미리보기"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: "login", label: "1. 로그인 화면 (데모)" },
          { value: "signup", label: "2. 회원가입 · 사용자 유형 선택" },
          { value: "pending", label: "3. 관리자 승인 대기 화면" },
          { value: "rejected_or_supplement", label: "4. 승인 거절 · 보완 요청 안내" },
        ]}
      />

      {/* 1. 로그인 화면 */}
      {activeTab === "login" && (
        <Panel padding="lg" className="mx-auto max-w-md space-y-5">
          <div className="space-y-1.5 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-600 text-2xl font-bold text-white"
            >
              e
            </div>
            <h2 className="text-xl font-bold text-ink">동국e음 로그인 (데모 화면)</h2>
            <p className="text-sm text-ink-3">동국대학교 교육학과 승인 회원 전용 서비스</p>
          </div>

          <div className="space-y-1 rounded-xl bg-surface-2 p-3.5 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <Lock aria-hidden="true" className="size-4 text-ink-3" /> 실제 비밀번호 입력 불필요 안내
            </p>
            <p className="leading-relaxed text-ink-2">
              1차 버전에서는 실제 개인 비밀번호를 수집하지 않습니다. 아래 버튼으로 역할을 선택하면 즉시 해당 권한의 데모 세션으로 전환됩니다.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">
              데모 체험 계정 바로 전환하기 (현재: {ROLE_LABELS[currentRole]})
            </p>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {(["student", "alumni", "professor", "admin"] as UserRole[]).map((r) => (
                <Button
                  key={r}
                  variant={currentRole === r ? "primary" : "secondary"}
                  aria-pressed={currentRole === r}
                  onClick={() => switchRole(r)}
                >
                  {ROLE_LABELS[r]} 계정으로 체험
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-3 text-center">
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              아직 회원이 아니신가요? 회원가입 및 소속 인증 신청 →
            </button>
          </div>
        </Panel>
      )}

      {/* 2. 회원가입 · 사용자 유형 선택 · 소속 인증 안내 */}
      {activeTab === "signup" && (
        <Panel padding="lg" className="mx-auto max-w-3xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">
              동국e음 회원가입 신청 및 소속 인증 안내
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              가입 신청서를 제출하면 [관리자 센터]의 가입 신청 목록에 실시간(로컬 상태)으로 등록되어 승인/보완 절차를 시연할 수 있습니다.
            </p>
          </div>

          {/* Step 1: 사용자 유형 선택 */}
          <div className="space-y-2.5">
            <h3 id="signup-role-label" className="text-base font-semibold text-ink">
              Step 1. 사용자 유형 선택
            </h3>
            <div
              role="radiogroup"
              aria-labelledby="signup-role-label"
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {ROLE_OPTIONS.map((item) => {
                const selected = selectedRole === item.role;
                return (
                  <button
                    key={item.role}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedRole(item.role)}
                    className={`rounded-xl border p-4 text-left transition-colors duration-150 ${
                      selected
                        ? "border-brand-500 bg-accent-soft"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{item.title}</span>
                      {selected && (
                        <CheckCircle2
                          aria-hidden="true"
                          className="size-4 shrink-0 text-accent"
                        />
                      )}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-2">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: 소속 인증 안내 (증명서 파일 미업로드 원칙 준수) */}
          <Callout
            tone="info"
            title="Step 2. 소속 인증 방식 안내 (민감 증명서 파일 업로드 미구현)"
          >
            실제 서비스 운영 단계에서는 학교 공식 웹메일(<code>@dgu.ac.kr</code>) 인증 또는 학과 사무실 명부 대조를 통해 소속을 확인합니다. <strong>현재 프로토타입에서는 개인정보 보호를 위해 재학증명서·졸업증명서 등 민감한 파일을 업로드하거나 저장하지 않습니다.</strong>
          </Callout>

          {/* Step 3: 신청 정보 입력 */}
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="이름 (가상 이름 입력 권장)">
                <Input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="예: 김교육"
                />
              </Field>

              <Field label="이메일 (예시 이메일)">
                <Input
                  type="email"
                  required
                  value={applicantEmail}
                  onChange={(e) => setApplicantEmail(e.target.value)}
                  placeholder="예: student@sample.dgu.edu"
                />
              </Field>

              <Field label="학번 / 졸업연도 / 직함">
                <Input
                  type="text"
                  required
                  value={studentIdOrYear}
                  onChange={(e) => setStudentIdOrYear(e.target.value)}
                  placeholder="예: 24학번 재학 / 19학번 졸업"
                />
              </Field>

              <Field label="희망 소속 확인 방법">
                <Select
                  value={verificationMethod}
                  onChange={(e) => setVerificationMethod(e.target.value)}
                >
                  <option value="학교 웹메일(@dgu.ac.kr) 인증 예정 (데모)">
                    학교 웹메일(@dgu.ac.kr) 인증 예정 (데모)
                  </option>
                  <option value="학과 사무실 재학/졸업 명부 대조 요청 (데모)">
                    학과 사무실 재학/졸업 명부 대조 요청 (데모)
                  </option>
                  <option value="복수전공 이수 승인 학번 확인 요청 (데모)">
                    복수전공 이수 승인 학번 확인 요청 (데모)
                  </option>
                </Select>
              </Field>

              <Field label="가입 인사 및 소속 확인 메모" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="학과 관리자가 소속을 확인할 수 있도록 간단한 소개를 남겨주세요."
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                가입 승인 신청하기 (데모 등록)
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* 3. 관리자 승인 대기 화면 */}
      {activeTab === "pending" && (
        <Panel padding="lg" className="mx-auto max-w-xl space-y-4 text-center">
          {submittedNotice && (
            <Callout
              tone="success"
              description="가입 신청이 접수되어 관리자 신청 목록에 추가되었습니다!"
              className="text-left"
            />
          )}

          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Clock aria-hidden="true" className="size-6" />
          </div>

          <h2 className="text-xl font-bold text-ink">관리자 소속 승인 대기 중입니다</h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-2">
            <strong>동국e음</strong>은 동국대학교 교육학과 구성원(재학생·복수전공생·졸업생·교수진)의 안전한 소통을 위해 학과 관리자의 소속 확인 승인 후 모든 게시판과 대화창이 열립니다.
          </p>

          <div className="space-y-1.5 rounded-xl bg-surface-2 p-3.5 text-left">
            <p className="text-sm font-semibold text-ink">승인 처리 절차 안내</p>
            <p className="text-sm leading-relaxed text-ink-2">
              1. 가입 신청 및 학번/이메일 제출 → 2. 교육학과 관리자 확인 → 3. 승인 완료 후 커뮤니티 전체 기능 활성화
            </p>
          </div>

          <div className="pt-2">
            <Link href="/admin" className={buttonClass("primary")}>
              관리자 화면에서 방금 신청한 내역 승인해보기 →
            </Link>
          </div>
        </Panel>
      )}

      {/* 4. 승인 거절 또는 보완 요청 안내 화면 */}
      {activeTab === "rejected_or_supplement" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 보완 요청 화면 예시 */}
          <Panel padding="lg" className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
              <ShieldAlert aria-hidden="true" className="size-6" />
            </div>
            <h2 className="text-lg font-bold text-ink">소속 정보 보완 요청 안내 화면</h2>
            <p className="text-sm leading-relaxed text-ink-2">
              제출하신 가입 신청서에서 학번 또는 교육학과 소속 확인 정보가 부족하여 관리자가 보완을 요청한 상태입니다.
            </p>
            <div className="space-y-1 rounded-xl bg-surface-2 p-3.5 text-left text-sm">
              <p className="font-semibold text-ink">관리자 전달 메모:</p>
              <p className="leading-relaxed text-ink-2">
                &ldquo;학번(입학연도)과 교육학과 본전공/복수전공 여부가 누락되어 있습니다. 정보를 보완하여 다시 제출해 주세요.&rdquo;
              </p>
            </div>
            <Button variant="warning" block onClick={() => setActiveTab("signup")}>
              가입 신청 정보 수정 및 재제출하기
            </Button>
          </Panel>

          {/* 승인 거절 화면 예시 */}
          <Panel padding="lg" className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <XCircle aria-hidden="true" className="size-6" />
            </div>
            <h2 className="text-lg font-bold text-ink">가입 승인 거절 안내 화면</h2>
            <p className="text-sm leading-relaxed text-ink-2">
              동국대학교 교육학과 구성원 자격이 확인되지 않거나 외부 홍보 목적 계정으로 판단되어 가입 승인이 거절되었습니다.
            </p>
            <div className="space-y-1 rounded-xl bg-surface-2 p-3.5 text-left text-sm">
              <p className="font-semibold text-ink">거절 사유:</p>
              <p className="leading-relaxed text-ink-2">
                &ldquo;동국대학교 교육학과 구성원(재학생·졸업생·교수진)만 가입할 수 있는 폐쇄형 플랫폼입니다.&rdquo;
              </p>
            </div>
            <p className="text-xs text-ink-3">
              ※ 착오로 거절된 경우 교육학과 사무실로 문의해 주시기 바랍니다.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}

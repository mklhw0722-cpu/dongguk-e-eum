"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { canAccessGraduation } from "@/lib/accessGate";
import { useApp } from "@/context/AppContext";
import {
  CourseCategory,
  CourseSemester,
  EnrolledCourse,
  MajorPlanType,
  RequirementCategory,
  TeachingTrackStatus,
} from "@/types";
import {
  calculateGraduationAudit,
  detectDuplicateCourses,
  EDU_TEACHING_SUBSTITUTION_MAP,
  formatAdmissionYearLabel,
  OFFICIAL_COURSE_PRESETS,
  OFFICIAL_GUIDE_URL,
} from "@/lib/graduationCurriculum";
import { DemoInfoBanner, ROLE_LABELS } from "@/components/common/Cards";
import {
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  ClipboardCheck,
  Settings,
  BookOpen,
  Search,
  Edit3,
  ShieldCheck,
  ShieldAlert,
  Info,
  Award,
  Sparkles,
  FileCheck2,
} from "lucide-react";

const COURSE_CATEGORIES: CourseCategory[] = [
  "전공필수/선택 (교육학과)",
  "복수전공",
  "교직이론",
  "교직소양",
  "교육실습(학교현장실습)",
  "교육봉사활동",
  "공통교양(기초교양)",
  "학문기초(외국어영역)",
  "일반교양/자유선택",
];

const COURSE_SEMESTERS: CourseSemester[] = [
  "1학기",
  "여름학기",
  "2학기",
  "겨울학기",
];

const MAJOR_PLAN_LABELS: Record<MajorPlanType, string> = {
  single: "단일전공 (교육학과 66학점)",
  double_edu: "복수전공 — 사범대학 내 타 학과 (주전공 62 + 사범대 복수 50학점)",
  double_general: "복수전공 — 일반대학(비사범대) 학과 (주전공 62 + 타 학과 기준)",
};

const TEACHING_STATUS_LABELS: Record<TeachingTrackStatus, string> = {
  educational_major: "주전공 교직 이수 (교육학과 사범대 기본 과정)",
  double_teaching: "주전공 + 복수전공 교직 병행 (교직 복수전공)",
  non_teaching: "교직 미이수 (일반 학사학위 취득 과정)",
};

export default function GraduationPage() {
  const {
    currentUser,
    authUserProfile,
    graduationCatalog,
    studentProgress,
    updateStudentAcademicProfile,
    addEnrolledCourse,
    updateEnrolledCourse,
    removeEnrolledCourse,
    updateVolunteeringCourseState,
    updateSchoolPracticumState,
    updateTeachingChecklistState,
    updateStudentCredit,
    addVolunteeringRecord,
    removeVolunteeringRecord,
    toggleChecklistItem,
    addChecklistItem,
  } = useApp();

  // 공식 졸업요건 및 이수 현황 실시간 계산
  const audit = useMemo(
    () => calculateGraduationAudit(studentProgress, graduationCatalog),
    [studentProgress, graduationCatalog]
  );
  const { profile, applicable, cohortRule } = {
    profile: audit.profile,
    applicable: audit.applicable,
    cohortRule: audit.applicable.cohortRule,
  };

  // 1. 학사정보 수정/보완 모달 및 폼 상태
  const [isEditingProfile, setIsEditingProfile] = useState(
    !studentProgress.isProfileComplete
  );
  const [admissionYearInput, setAdmissionYearInput] = useState<number>(
    profile.admissionYearNumber
  );
  const [majorPlanInput, setMajorPlanInput] = useState<MajorPlanType>(
    profile.majorPlanType
  );
  const [doubleMajorDeptInput, setDoubleMajorDeptInput] = useState<string>(
    profile.doubleMajorDepartment
  );
  const [teachingStatusInput, setTeachingStatusInput] =
    useState<TeachingTrackStatus>(profile.teachingTrackStatus);
  const [isEnglishTrackInput, setIsEnglishTrackInput] = useState<boolean>(
    profile.isEnglishTrack
  );
  const [specialMemoInput, setSpecialMemoInput] = useState<string>(
    profile.specialConditionMemo || ""
  );
  const [profileSaveFeedback, setProfileSaveFeedback] = useState<string | null>(
    null
  );

  const openProfileEditor = () => {
    setAdmissionYearInput(profile.admissionYearNumber);
    setMajorPlanInput(profile.majorPlanType);
    setDoubleMajorDeptInput(profile.doubleMajorDepartment);
    setTeachingStatusInput(profile.teachingTrackStatus);
    setIsEnglishTrackInput(profile.isEnglishTrack);
    setSpecialMemoInput(profile.specialConditionMemo || "");
    setIsEditingProfile(true);
  };

  const handleSaveAcademicProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (majorPlanInput !== "single" && !doubleMajorDeptInput.trim()) {
      alert("복수전공을 선택한 경우 복수전공 학과명을 입력해 주세요.");
      return;
    }
    await updateStudentAcademicProfile({
      admissionYearNumber: admissionYearInput,
      admissionYearLabel: formatAdmissionYearLabel(admissionYearInput),
      majorPlanType: majorPlanInput,
      hasDoubleMajor: majorPlanInput !== "single",
      doubleMajorDepartment:
        majorPlanInput === "single" ? "" : doubleMajorDeptInput.trim(),
      teachingTrackStatus: teachingStatusInput,
      isEnglishTrack: isEnglishTrackInput,
      specialConditionMemo: specialMemoInput.trim(),
      adminVerifiedSpecialCondition: Boolean(
        profile.adminVerifiedSpecialCondition
      ),
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    setIsEditingProfile(false);
    setProfileSaveFeedback(
      "학사정보가 저장되어 입학연도·전공·교직 트랙에 맞는 공식 졸업요건이 자동 갱신되었습니다."
    );
    setTimeout(() => setProfileSaveFeedback(null), 4000);
  };

  // 2. 강좌 관리(추가·수정·삭제·검색·정렬·중복 경고) 상태
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<string>("ALL");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [courseCodeInput, setCourseCodeInput] = useState("");
  const [courseTitleInput, setCourseTitleInput] = useState("");
  const [courseCreditsInput, setCourseCreditsInput] = useState<string>("3");
  const [courseYearInput, setCourseYearInput] = useState<number>(
    Math.max(profile.admissionYearNumber, 2024)
  );
  const [courseSemesterInput, setCourseSemesterInput] =
    useState<CourseSemester>("1학기");
  const [courseCategoryInput, setCourseCategoryInput] =
    useState<CourseCategory>("전공필수/선택 (교육학과)");
  const [courseCompletedInput, setCourseCompletedInput] = useState(true);
  const [courseRecognitionInput, setCourseRecognitionInput] = useState<
    "confirmed" | "needs_review"
  >("confirmed");
  const [courseIsSubjEduInput, setCourseIsSubjEduInput] = useState(false);

  // 중복 강좌 감지 시 사용자 재확인 모달 상태
  const [duplicateWarningModal, setDuplicateWarningModal] = useState<{
    warningMessage: string;
    pendingPayload: Omit<EnrolledCourse, "id" | "createdAt">;
    targetEditId: string | null;
  } | null>(null);

  const handleSelectPresetCourse = (presetCode: string) => {
    if (!presetCode) return;
    const found = OFFICIAL_COURSE_PRESETS.find(
      (p) => p.courseCode === presetCode
    );
    if (!found) return;
    setCourseCodeInput(found.courseCode.startsWith("EDU_SUBJ") ? "" : found.courseCode);
    setCourseTitleInput(found.courseTitle);
    setCourseCreditsInput(String(found.credits));
    setCourseCategoryInput(found.category);
    setCourseIsSubjEduInput(Boolean(found.isSubjectEducationCourse));
    setCourseRecognitionInput("confirmed");
  };

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCourseCodeInput("");
    setCourseTitleInput("");
    setCourseCreditsInput("3");
    setCourseCategoryInput("전공필수/선택 (교육학과)");
    setCourseCompletedInput(true);
    setCourseRecognitionInput("confirmed");
    setCourseIsSubjEduInput(false);
  };

  const startEditCourse = (course: EnrolledCourse) => {
    setEditingCourseId(course.id);
    setCourseCodeInput(course.courseCode || "");
    setCourseTitleInput(course.courseTitle);
    setCourseCreditsInput(String(course.credits));
    setCourseYearInput(course.yearTaken);
    setCourseSemesterInput(course.semesterTaken);
    setCourseCategoryInput(course.category);
    setCourseCompletedInput(course.isCompleted !== false);
    setCourseRecognitionInput(course.recognitionStatus || "confirmed");
    setCourseIsSubjEduInput(Boolean(course.isSubjectEducationCourse));
  };

  const commitCourseSave = (
    payload: Omit<EnrolledCourse, "id" | "createdAt">,
    editId: string | null
  ) => {
    if (editId) {
      updateEnrolledCourse(editId, payload);
    } else {
      addEnrolledCourse(payload);
    }
    setDuplicateWarningModal(null);
    resetCourseForm();
  };

  const handleCourseFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = courseTitleInput.trim();
    if (!title) return;

    const payload: Omit<EnrolledCourse, "id" | "createdAt"> = {
      courseCode: courseCodeInput.trim() || undefined,
      courseTitle: title,
      credits: Math.max(0, Number(courseCreditsInput) || 0),
      yearTaken: Number(courseYearInput) || profile.admissionYearNumber,
      semesterTaken: courseSemesterInput,
      category: courseCategoryInput,
      isCompleted: courseCompletedInput,
      recognitionStatus: courseRecognitionInput,
      isSubjectEducationCourse: courseIsSubjEduInput,
    };

    const dupCheck = detectDuplicateCourses(
      {
        id: editingCourseId || undefined,
        courseCode: payload.courseCode,
        courseTitle: payload.courseTitle,
        category: payload.category,
      },
      studentProgress.courses || []
    );

    if (dupCheck.hasExactDuplicate || dupCheck.hasSimilarWarning) {
      setDuplicateWarningModal({
        warningMessage: dupCheck.warningMessage,
        pendingPayload: payload,
        targetEditId: editingCourseId,
      });
      return;
    }

    commitCourseSave(payload, editingCourseId);
  };

  const filteredCourses = useMemo(() => {
    const list = studentProgress.courses || [];
    return list.filter((c) => {
      if (courseCategoryFilter !== "ALL" && c.category !== courseCategoryFilter) {
        return false;
      }
      if (courseSearchQuery.trim()) {
        const q = courseSearchQuery.trim().toLowerCase();
        const matchTitle = c.courseTitle.toLowerCase().includes(q);
        const matchCode = (c.courseCode || "").toLowerCase().includes(q);
        return matchTitle || matchCode;
      }
      return true;
    });
  }, [studentProgress.courses, courseCategoryFilter, courseSearchQuery]);

  // 3. 기존 누적 학점 수동 보정 토글 상태
  const [showLegacyCreditEditor, setShowLegacyCreditEditor] = useState(false);

  // 4. 교육봉사 기록 추가 폼 상태
  const [volInst, setVolInst] = useState("");
  const [volDate, setVolDate] = useState("");
  const [volHours, setVolHours] = useState("");
  const [volNote, setVolNote] = useState("");

  const handleAddVolunteering = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(volHours);
    if (!volInst.trim() || !volDate.trim() || !h || h <= 0) return;
    addVolunteeringRecord(volInst.trim(), volDate.trim(), h, volNote.trim());
    setVolInst("");
    setVolDate("");
    setVolHours("");
    setVolNote("");
  };

  // 5. 개인별 추가 체크리스트 입력 상태
  const [newChkLabel, setNewChkLabel] = useState("");
  const [newChkCategory, setNewChkCategory] =
    useState<RequirementCategory>("기타 졸업요건");
  const [newChkMemo, setNewChkMemo] = useState("");

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChkLabel.trim()) return;
    addChecklistItem(newChkLabel.trim(), newChkCategory, newChkMemo.trim());
    setNewChkLabel("");
    setNewChkMemo("");
  };

  const vs = studentProgress.volunteeringState!;
  const ps = studentProgress.practicumState!;
  const tc = studentProgress.teachingChecklist!;

  // 교수 및 졸업생 접근 차단 (프론트엔드 보호 게이트)
  const userRole = authUserProfile?.role || currentUser.role;
  const isAllowed = canAccessGraduation({ role: userRole });

  if (!isAllowed) {
    const roleLabel =
      userRole === "professor"
        ? "교수진"
        : userRole === "alumni"
        ? "졸업생(동문)"
        : "비재학생";
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              학부 재학생(신입학) 전용 서비스
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              졸업요건 관리에 접근할 수 없습니다
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              현재 로그인하신 계정은 <strong>{roleLabel}</strong> 계정입니다.<br />
              졸업요건 자가점검 및 이수 강좌 관리는 <strong>동국대학교 교육학과 학부 신입학 재학생</strong>만을 위한 기능으로,
              교수진 및 졸업생 계정의 접근이 제한됩니다.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 max-w-md mx-auto text-left text-xs text-slate-500 space-y-1">
            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>내 계정 구분</span>
              <span>{ROLE_LABELS[userRole] || userRole}</span>
            </div>
            <div className="flex justify-between">
              <span>접근 제한 사유</span>
              <span>학부 이수 기준 대상 외 (신입학 재학생 전용)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm transition inline-flex items-center justify-center gap-2"
            >
              홈 대시보드로 이동
            </Link>
            <Link
              href="/rooms"
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition inline-flex items-center justify-center gap-2"
            >
              진로·복전 공유방 둘러보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              동국대학교 교육학과 졸업요건 자가점검 시스템
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            공식 학업이수 가이드(
            <a
              href={OFFICIAL_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-orange-600 font-bold hover:underline"
            >
              edu.dongguk.edu/page/619
            </a>
            )의 <strong>신입학 재학생</strong> 기준을 자동 적용하여 전공·교직이론 대체인정·교육실습·교육봉사를 점검합니다.
          </p>
        </div>

        <a
          href={OFFICIAL_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto"
        >
          공식 학업이수 가이드 원문 보기
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* 공식 안내 및 자가점검 고지 배너 */}
      <DemoInfoBanner
        title="공식 학업이수 기준 적용 및 자가점검 유의사항"
        description="본 화면의 공통요건은 동국대학교 사범대학·교육학과 공식 학업이수 가이드(https://edu.dongguk.edu/page/619)에서 확인된 신입학 기준만 반영하며, 학과 내규나 타 학과 요람 확인이 필요한 항목은 임의 수치 없이 '확인 필요'로 표시됩니다. 학생이 입력한 이수 내역은 자가점검용 기록이며 최종 졸업·교원자격 판정은 학교 공식 학사시스템(nDRIMS) 및 학사운영실 확인을 따릅니다."
        variant="amber"
      />

      {/* 학사정보 미완성 회원용 보완 안내 배너 (로그인·이용 차단 없이 보완 유도) */}
      {!studentProgress.isProfileComplete && (
        <div className="p-4 rounded-2xl bg-orange-50 border border-orange-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-orange-950">
            <Sparkles className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold">
                학사정보 보완 안내: 내 입학연도와 전공·교직 트랙을 확인해 주세요!
              </p>
              <p className="text-xs text-orange-800 mt-0.5">
                신입학 입학연도, 단일/복수전공 형태, 교직 이수 여부를 설정하면 나에게 맞는 교육학과 졸업요건(66학점/62학점 등)이 자동으로 계산됩니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openProfileEditor}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0"
          >
            지금 학사정보 보완하기
          </button>
        </div>
      )}

      {profileSaveFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{profileSaveFeedback}</span>
        </div>
      )}

      {/* =====================================================================
          섹션 1. 나의 기본 학사정보 (전공 이수 형태와 교직 이수 상태 분리)
         ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-600" />
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              1. 나의 기본 학사정보 (신입학 재학생 기준)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
              {studentProgress.officialAdminVerified
                ? "학교/관리자 공식 확인됨"
                : "학생 자가 설정 기록"}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              isEditingProfile ? setIsEditingProfile(false) : openProfileEditor()
            }
            className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition"
          >
            {isEditingProfile ? "닫기" : "학사정보 수정 · 보완"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">신입학 연도 · 적용 과정</span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              {profile.admissionYearLabel}
            </p>
            <p className="text-[11px] text-orange-600 font-semibold mt-0.5">
              적용 기준: {cohortRule.cohortLabel}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">전공 이수 형태</span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              {profile.majorPlanType === "single"
                ? "단일전공 (교육학과 66학점)"
                : profile.majorPlanType === "double_edu"
                ? "복수전공 (사범대 타 학과)"
                : "복수전공 (비사범대 일반학과)"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {profile.hasDoubleMajor
                ? `복수전공 학과: ${profile.doubleMajorDepartment || "미입력"}`
                : "주전공(교육학) 단일 이수"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">교직 이수 관련 상태</span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              {TEACHING_STATUS_LABELS[profile.teachingTrackStatus]}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              {profile.teachingTrackStatus !== "non_teaching"
                ? "교원자격(정교사 2급) 요건 적용 중"
                : "교직 요건 제외 (학사학위 기준 적용)"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">기타 개인별 적용 조건</span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              {profile.isEnglishTrack ? "영어트랙 대상자" : "일반 트랙 (영어강의 면제)"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {profile.isEnglishTrack
                ? "영어트랙 교양 기준 확인 필요"
                : "사범대학 영어강의 이수 의무 제외"}
            </p>
          </div>
        </div>

        {isEditingProfile && (
          <form
            onSubmit={handleSaveAcademicProfile}
            className="p-4 sm:p-5 rounded-2xl bg-orange-50/70 dark:bg-slate-800/70 border border-orange-200 dark:border-slate-700 space-y-4 text-xs sm:text-sm"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold text-orange-950 dark:text-orange-200">
                학사정보 수정 (전공 이수 형태와 교직 이수 상태를 독립적으로 설정할 수 있습니다)
              </span>
              <span className="text-[11px] text-orange-700">
                ※ 관리자 확인이 필요한 특수 조건은 학생이 변경하더라도 &apos;확인 필요&apos; 상태로 관리됩니다.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-bold mb-1 text-xs">
                  1. 신입학 입학 연도
                </label>
                <select
                  value={admissionYearInput}
                  onChange={(e) => setAdmissionYearInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014].map(
                    (yr) => (
                      <option key={yr} value={yr}>
                        {yr}학년도 신입학 ({String(yr).slice(-2)}학번)
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-xs">
                  2. 전공 이수 형태 (단일 / 복수전공)
                </label>
                <select
                  value={majorPlanInput}
                  onChange={(e) => {
                    const nextPlan = e.target.value as MajorPlanType;
                    setMajorPlanInput(nextPlan);
                    if (
                      nextPlan === "single" &&
                      teachingStatusInput === "double_teaching"
                    ) {
                      setTeachingStatusInput("educational_major");
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="single">{MAJOR_PLAN_LABELS.single}</option>
                  <option value="double_edu">{MAJOR_PLAN_LABELS.double_edu}</option>
                  <option value="double_general">
                    {MAJOR_PLAN_LABELS.double_general}
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-xs">
                  3. 교직 이수 상태 (복수전공과 동시 선택 가능)
                </label>
                <select
                  value={teachingStatusInput}
                  onChange={(e) =>
                    setTeachingStatusInput(e.target.value as TeachingTrackStatus)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="educational_major">
                    {TEACHING_STATUS_LABELS.educational_major}
                  </option>
                  {majorPlanInput !== "single" && (
                    <option value="double_teaching">
                      {TEACHING_STATUS_LABELS.double_teaching}
                    </option>
                  )}
                  <option value="non_teaching">
                    {TEACHING_STATUS_LABELS.non_teaching}
                  </option>
                </select>
              </div>
            </div>

            {majorPlanInput !== "single" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold mb-1 text-xs">
                    복수전공 학과명
                  </label>
                  <input
                    type="text"
                    required
                    value={doubleMajorDeptInput}
                    onChange={(e) => setDoubleMajorDeptInput(e.target.value)}
                    placeholder={
                      majorPlanInput === "double_edu"
                        ? "예: 국어교육과, 역사교육과, 수학교육과 등"
                        : "예: 심리학과, 경영학과, 컴퓨터공학과 등"
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-xs">
                    개인별 적용 조건 메모 (선택)
                  </label>
                  <input
                    type="text"
                    value={specialMemoInput}
                    onChange={(e) => setSpecialMemoInput(e.target.value)}
                    placeholder="예: 2025-1학기 복수전공 진입 승인"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnglishTrackInput}
                  onChange={(e) => setIsEnglishTrackInput(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600"
                />
                <span>
                  영어트랙 대상자입니다 (체크 시 공통교양·핵심교양 별도 기준 확인 필요 상태로 표시)
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white text-xs font-bold text-slate-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                >
                  학사정보 저장 및 적용 요건 갱신
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* =====================================================================
          섹션 2. 공통 졸업요건 (공식 자료 기반 자동 적용 기준표)
         ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
              2. 내 학번·트랙에 자동 적용된 공식 공통 졸업요건
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              공통요건은 학생이 임의로 수정할 수 없으며, 관리자가 공식 출처(
              <code>{cohortRule.sourceUrl}</code>)를 근거로 등록한 기준입니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              기준 버전: {cohortRule.version}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              최종 확인일: {cohortRule.lastVerifiedAt}
            </span>
          </div>
        </div>

        {/* 사범대 일반 전공학점 vs 교육학과 별도 전공학점 비교 안내 박스 */}
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-xs space-y-1.5">
          <p className="font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            사범대학 일반 기준 vs 교육학과 별도 전공학점 기준 구분 안내
          </p>
          <p className="text-amber-900 dark:text-amber-300 leading-relaxed">
            • <strong>사범대학 일반 학과 기준 ({cohortRule.cohortLabel})</strong>: 단일전공{" "}
            <strong>{cohortRule.generalSingleMajorCredits}학점</strong> / 복수전공 이수 시 주전공{" "}
            <strong>{cohortRule.generalDoublePrimaryCredits}학점</strong>
            <br />• <strong>교육학과 별도 적용 기준 (현재 적용 중)</strong>: 교육학과는 전공과목으로 교직이론(12학점)을 대체이수하므로 대체이수한 12학점만큼 전공학점을 추가 이수하여{" "}
            <strong className="underline">
              단일전공 {cohortRule.eduSingleMajorCredits}학점, 복수전공 이수 시 주전공{" "}
              {cohortRule.eduDoublePrimaryCredits}학점
            </strong>
            을 이수해야 합니다 (교과교육영역 9학점 포함).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                <th className="py-2.5 px-3 font-bold">요건 영역</th>
                <th className="py-2.5 px-3 font-bold">적용 항목명</th>
                <th className="py-2.5 px-3 font-bold">공식 기준값</th>
                <th className="py-2.5 px-3 font-bold">적용 대상</th>
                <th className="py-2.5 px-3 font-bold">검토 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {applicable.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-bold text-orange-700 dark:text-orange-400 whitespace-nowrap">
                    {item.category}
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.description}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                    {item.targetDisplay}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {item.applicableTarget}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {item.reviewStatus === "confirmed" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        공식 기준 확인됨
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        관리자/요람 확인 필요
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================================
          섹션 3. 전공·교양·교직 이수 현황 카드 (확정된 수치만 진행률 표시)
         ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-600" />
              3. 전공 · 교양 · 교직 이수 현황
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              정확한 공식 기준값과 취득값이 모두 확인된 항목만 진행률(%)을 표시하며, 요람 대조가 필요한 항목은 &apos;확인 필요&apos;로 구분합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLegacyCreditEditor((v) => !v)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {showLegacyCreditEditor
              ? "영역별 누적 학점 수동 보정 닫기"
              : "영역별 누적 학점 직접 입력/보정 (기존 기록 호환)"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {audit.categoryCards.map((card) => (
            <div
              key={card.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-xs font-bold">
                    {card.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      card.status === "fulfilled"
                        ? "bg-emerald-100 text-emerald-800"
                        : card.status === "needs_review"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {card.statusBadgeText}
                  </span>
                </div>

                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {card.helperText}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 font-semibold">
                    현재 취득 / 공식 기준
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-black text-orange-600">
                      {card.earnedValue}
                      {card.unit}
                    </span>
                    <span className="text-xs text-slate-500 font-bold ml-1">
                      / {card.targetDisplay}
                    </span>
                  </div>
                </div>

                {card.percentage !== null ? (
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          card.percentage >= 100
                            ? "bg-emerald-600"
                            : "bg-orange-600"
                        }`}
                        style={{ width: `${card.percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-right font-bold text-slate-600">
                      달성률 {card.percentage}%
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                    ※ 세부 기준 학점을 학과 요람에서 확인해야 하므로 임의 퍼센트를 표시하지 않습니다.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 기존 누적 학점 수동 보정 패널 (강좌를 하나씩 다 넣기 전에도 기존 누적 학점을 보존·수정 가능) */}
        {showLegacyCreditEditor && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-extrabold text-slate-900 dark:text-white">
                영역별 누적 취득 학점 직접 보정 (기존 자가점검 기록 보존용)
              </p>
              <span className="text-slate-500">
                ※ 아래 강좌 목록의 합산 학점과 여기 입력한 누적 학점 중 더 큰 값이 현황 카드에 안전하게 반영됩니다.
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(
                [
                  "졸업 이수 학점",
                  "전공 이수 학점",
                  "교양 이수 학점",
                  "복수전공 이수 학점",
                  "교직 이수 학점",
                ] as RequirementCategory[]
              ).map((cat) => {
                const cur = studentProgress.credits[cat]?.completedValue ?? 0;
                return (
                  <div
                    key={cat}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <label className="block font-bold text-slate-600 mb-1">
                      {cat}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cur}
                      onChange={(e) =>
                        updateStudentCredit(
                          cat,
                          Math.max(0, Number(e.target.value) || 0),
                          studentProgress.credits[cat]?.userCustomTarget ?? null
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          섹션 4. 이수 강좌 목록 관리 및 교육학과 교직이론 대체인정 현황판
         ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-600" />
              4. 이수 강좌 관리 및 교육학과 교직이론 대체인정 현황
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              등록한 각 강좌의 학점은 <strong>총 졸업학점(130학점)에 1회만 합산</strong>되며, 교육학과 전공 대체인정 과목(3학점)은 전공학점(66/62)과 교직이론 이수 요건(6과목/12학점 상당)을 동시에 충족합니다.
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-orange-50 text-orange-700 text-xs font-extrabold self-start">
            등록 강좌 총 {studentProgress.courses?.length || 0}개
          </span>
        </div>

        {/* 강좌 추가 / 수정 폼 */}
        <form
          onSubmit={handleCourseFormSubmit}
          className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
              {editingCourseId ? "등록 강좌 수정하기" : "새 이수 강좌 추가하기"}
            </span>

            <div className="flex items-center gap-2">
              <label className="text-slate-500 font-bold whitespace-nowrap">
                공식 강좌 빠른 채우기:
              </label>
              <select
                value=""
                onChange={(e) => handleSelectPresetCourse(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-orange-300 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="">
                  -- 교육학과 전공(대체인정)·교직소양·실습 강좌 선택 --
                </option>
                {OFFICIAL_COURSE_PRESETS.map((preset) => (
                  <option key={preset.courseCode} value={preset.courseCode}>
                    [{preset.category}] {preset.courseTitle} ({preset.credits}학점) -{" "}
                    {preset.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-1">
              <label className="block font-bold mb-1 text-slate-600">
                학수번호 (선택)
              </label>
              <input
                type="text"
                value={courseCodeInput}
                onChange={(e) => setCourseCodeInput(e.target.value)}
                placeholder="예: EDU2013"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold mb-1 text-slate-600">
                강좌명 *
              </label>
              <input
                type="text"
                required
                value={courseTitleInput}
                onChange={(e) => setCourseTitleInput(e.target.value)}
                placeholder="예: 교육학개론, 심리학개론"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block font-bold mb-1 text-slate-600">
                학점 *
              </label>
              <input
                type="number"
                min={0}
                max={12}
                required
                value={courseCreditsInput}
                onChange={(e) => setCourseCreditsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block font-bold mb-1 text-slate-600">
                이수 연도
              </label>
              <select
                value={courseYearInput}
                onChange={(e) => setCourseYearInput(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              >
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014].map(
                  (yr) => (
                    <option key={yr} value={yr}>
                      {yr}년
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block font-bold mb-1 text-slate-600">
                이수 학기
              </label>
              <select
                value={courseSemesterInput}
                onChange={(e) =>
                  setCourseSemesterInput(e.target.value as CourseSemester)
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              >
                {COURSE_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <label className="block font-bold mb-1 text-slate-600">
                이수 구분
              </label>
              <select
                value={courseCategoryInput}
                onChange={(e) =>
                  setCourseCategoryInput(e.target.value as CourseCategory)
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              >
                {COURSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-600">
                인정 확인 상태
              </label>
              <select
                value={courseRecognitionInput}
                onChange={(e) =>
                  setCourseRecognitionInput(
                    e.target.value as "confirmed" | "needs_review"
                  )
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              >
                <option value="confirmed">이수 구분 확실 (정상 반영)</option>
                <option value="needs_review">
                  인정 여부 불확실 (&apos;확인 필요&apos; 표시)
                </option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 pt-3">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={courseCompletedInput}
                  onChange={(e) => setCourseCompletedInput(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600"
                />
                <span>이수 완료 과목 (체크 해제 시 수강 중/예정으로 보관)</span>
              </label>
              {courseCategoryInput === "전공필수/선택 (교육학과)" && (
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={courseIsSubjEduInput}
                    onChange={(e) => setCourseIsSubjEduInput(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600"
                  />
                  <span>교과교육영역 과목 (교과교육론·교재연구·논리및논술)</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {editingCourseId && (
              <button
                type="button"
                onClick={resetCourseForm}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold"
              >
                수정 취소
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {editingCourseId ? "강좌 수정 저장" : "강좌 등록하기"}
            </button>
          </div>
        </form>

        {/* 중복 강좌 감지 시 사용자 재확인 모달 (자동 삭제 금지 원칙 준수) */}
        {duplicateWarningModal && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-950 text-sm">
                  동일 또는 유사 강좌 중복 등록 확인 안내
                </p>
                <p className="text-amber-900 mt-1">
                  {duplicateWarningModal.warningMessage}
                </p>
                <p className="text-amber-800 mt-1">
                  ※ 동일 강좌를 중복 등록하면 학점이 이중으로 합산될 수 있습니다. 재수강이거나 별도 강좌여서 그대로 등록하시겠습니까?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateWarningModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold"
              >
                등록 취소 및 다시 확인
              </button>
              <button
                type="button"
                onClick={() =>
                  commitCourseSave(
                    duplicateWarningModal.pendingPayload,
                    duplicateWarningModal.targetEditId
                  )
                }
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                확인했으며 그대로 저장
              </button>
            </div>
          </div>
        )}

        {/* 강좌 검색 및 필터 바 */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={courseSearchQuery}
              onChange={(e) => setCourseSearchQuery(e.target.value)}
              placeholder="강좌명 또는 학수번호(예: EDU2013, 교육학개론)로 검색..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <select
            value={courseCategoryFilter}
            onChange={(e) => setCourseCategoryFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
          >
            <option value="ALL">모든 이수 구분 보기</option>
            {COURSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* 학기순 정렬된 강좌 목록 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                <th className="py-2.5 px-3 font-bold">이수 학기</th>
                <th className="py-2.5 px-3 font-bold">이수 구분</th>
                <th className="py-2.5 px-3 font-bold">강좌명 (학수번호)</th>
                <th className="py-2.5 px-3 font-bold">학점</th>
                <th className="py-2.5 px-3 font-bold">교직이론 대체 / 상태</th>
                <th className="py-2.5 px-3 font-bold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-400 font-semibold"
                  >
                    조건에 맞는 등록 강좌가 없습니다. 위 입력 폼에서 수강한 강좌를 추가해 보세요.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {course.yearTaken}년 {course.semesterTaken}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                        {course.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {course.courseTitle}
                      </span>
                      {course.courseCode && (
                        <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                          ({course.courseCode})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-orange-600 whitespace-nowrap">
                      {course.credits}학점
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {course.isCompleted !== false ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            이수 완료
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                            수강 중/예정 (학점 미합산)
                          </span>
                        )}
                        {course.substitutedTeachingSubjectCode && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                            교직이론 대체인정 ({course.substitutedTeachingSubjectCode})
                          </span>
                        )}
                        {course.isSubjectEducationCourse && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                            교과교육영역
                          </span>
                        )}
                        {course.recognitionStatus === "needs_review" && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            확인 필요
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditCourse(course)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                          title="강좌 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEnrolledCourse(course.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          title="강좌 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================================
          섹션 5. 교육봉사활동(1·2, 60시간) 및 학교현장실습(Ⅰ·Ⅱ·Ⅲ 조합 검증)
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5-1. 교육봉사활동 관리 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                5-1. 교육봉사활동 관리 (총 60시간 · 2학점)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                공식 기준: <code>ERC0022 교육봉사활동1</code>(1학점/30시간) +{" "}
                <code>ERC0023 교육봉사활동2</code>(1학점/30시간) 및 확인서 제출
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-orange-50 text-orange-700 text-xs font-extrabold">
              누적 {audit.volunteeringAudit.effectiveHours} / 60시간
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vs.eduVolunteering1Completed}
                onChange={(e) =>
                  updateVolunteeringCourseState({
                    eduVolunteering1Completed: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-orange-600"
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  교육봉사활동1 (ERC0022)
                </p>
                <p className="text-[11px] text-slate-500">1학점 · 30시간</p>
              </div>
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vs.eduVolunteering2Completed}
                onChange={(e) =>
                  updateVolunteeringCourseState({
                    eduVolunteering2Completed: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-orange-600"
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  교육봉사활동2 (ERC0023)
                </p>
                <p className="text-[11px] text-slate-500">1학점 · 30시간</p>
              </div>
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vs.confirmationSubmitted}
                onChange={(e) =>
                  updateVolunteeringCourseState({
                    confirmationSubmitted: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-orange-600"
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  교육봉사 확인서 제출
                </p>
                <p className="text-[11px] text-slate-500">학교 공식 인정은 별도 확인</p>
              </div>
            </label>
          </div>

          <form
            onSubmit={handleAddVolunteering}
            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
          >
            <p className="font-bold text-slate-700 dark:text-slate-200">
              새 교육봉사 활동 시간 기록 추가 (학생 자가 기록)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={volInst}
                onChange={(e) => setVolInst(e.target.value)}
                placeholder="봉사 기관명 (예: 장충초)"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="text"
                required
                value={volDate}
                onChange={(e) => setVolDate(e.target.value)}
                placeholder="활동 기간 (예: 2026-09 ~ 10)"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="number"
                min={1}
                required
                value={volHours}
                onChange={(e) => setVolHours(e.target.value)}
                placeholder="인정 시간(시간)"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={volNote}
                onChange={(e) => setVolNote(e.target.value)}
                placeholder="활동 내용 메모 (선택)"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            </div>
          </form>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {studentProgress.volunteeringRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {rec.institutionName}
                  </span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-bold">
                    {rec.hours}시간
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {rec.activityDate} {rec.note ? `· ${rec.note}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeVolunteeringRecord(rec.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 5-2. 학교현장실습(Ⅰ·Ⅱ·Ⅲ) 조합 및 사전요건 검증 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-orange-600" />
                5-2. 학교현장실습 이수 및 조합 검증 (최소 2학점)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                공식 유효 조합: <strong>① Ⅰ+Ⅱ (2학점)</strong>,{" "}
                <strong>② Ⅲ (2학점)</strong>, <strong>③ Ⅰ+Ⅱ+Ⅲ (4학점)</strong> 중 택1
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                audit.practicumEvaluation.isCombinationValid
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {audit.practicumEvaluation.earnedPracticumCredits}학점 이수
            </span>
          </div>

          {audit.practicumEvaluation.hasSequenceError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{audit.practicumEvaluation.sequenceErrorMessage}</span>
            </div>
          )}

          <div className="space-y-2.5 text-xs">
            {[
              {
                code: "ERC0024",
                title: "학교현장실습Ⅰ (참관실습)",
                spec: "1학점 · 2주 · 3학기(2학년 1학기) 개설",
                checked: ps.practicum1Completed,
                sem: ps.practicum1Semester,
                onToggle: (v: boolean) =>
                  updateSchoolPracticumState({ practicum1Completed: v }),
                onSem: (s: string) =>
                  updateSchoolPracticumState({ practicum1Semester: s }),
              },
              {
                code: "ERC0025",
                title: "학교현장실습Ⅱ (수업실습 — Ⅰ 선이수 필수)",
                spec: "1학점 · 2주 · 5학기(3학년 1학기) 개설",
                checked: ps.practicum2Completed,
                sem: ps.practicum2Semester,
                onToggle: (v: boolean) =>
                  updateSchoolPracticumState({ practicum2Completed: v }),
                onSem: (s: string) =>
                  updateSchoolPracticumState({ practicum2Semester: s }),
              },
              {
                code: "ERC0026",
                title: "학교현장실습Ⅲ (종합실습)",
                spec: "2학점 · 4주 · 7학기 이상(4학년 1학기~) 개설",
                checked: ps.practicum3Completed,
                sem: ps.practicum3Semester,
                onToggle: (v: boolean) =>
                  updateSchoolPracticumState({ practicum3Completed: v }),
                onSem: (s: string) =>
                  updateSchoolPracticumState({ practicum3Semester: s }),
              },
            ].map((item) => (
              <div
                key={item.code}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onToggle(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-orange-600"
                  />
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {item.title}{" "}
                      <span className="font-mono text-[11px] text-orange-600">
                        ({item.code})
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">{item.spec}</p>
                  </div>
                </label>
                <input
                  type="text"
                  value={item.sem}
                  onChange={(e) => item.onSem(e.target.value)}
                  placeholder="이수 학기 (예: 2025-1학기)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:w-44"
                />
              </div>
            ))}
          </div>

          {/* 학교현장실습 참여 사전 요건 4가지 점검 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                학교현장실습 참여 가능 사전 요건 (공식 가이드 기준)
              </span>
              <span
                className={`font-bold ${
                  audit.practicumEvaluation.prerequisites.allPrerequisitesMet
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {audit.practicumEvaluation.prerequisites.allPrerequisitesMet
                  ? "사전 요건 모두 충족"
                  : "일부 사전 요건 미충족"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              <p>
                {audit.practicumEvaluation.prerequisites.personalityTestOnce
                  ? "✔"
                  : "•"}{" "}
                교직 적성 및 인성검사 1회 이상 적격
              </p>
              <p>
                {audit.practicumEvaluation.prerequisites.cprOnce ? "✔" : "•"}{" "}
                응급처치 및 심폐소생술 실습 1회 이상 이수
              </p>
              <p>
                {audit.practicumEvaluation.prerequisites.genderSensitivityOnce
                  ? "✔"
                  : "•"}{" "}
                성인지 교육 1회 이상 이수
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-orange-700">
                <input
                  type="checkbox"
                  checked={ps.humanRightsEducationCompleted}
                  onChange={(e) =>
                    updateSchoolPracticumState({
                      humanRightsEducationCompleted: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-orange-600"
                />
                <span>온라인 인권존중 교육 이수 완료</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          섹션 6. 교직 관련 검사·교육·평점평균 및 결격사유 안내 체크리스트
         ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-orange-600" />
            6. 교직 적성·응급처치·성인지 교육·평점평균·졸업논문 체크리스트
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            공식 학업이수 가이드 기준을 자동 대조합니다. 성인지 교육은{" "}
            <strong>
              {profile.admissionYearNumber <= 2020
                ? "2020학년도 이전 입학자 기준 2회 이상"
                : "2021학년도 이후 입학자 기준 4회 이상"}
            </strong>{" "}
            이수가 적용됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* 1) 교직 적성 및 인성검사 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                교직 적성 및 인성검사
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  audit.teachingChecklistAudit.personalityTestPassed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                기준: {audit.teachingChecklistAudit.personalityTestTarget}회 이상 적격
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              2013학년도 입학자부터 2회 이상 적격 판정 필수 (학기당 1회만 인정)
            </p>
            <div className="flex items-center gap-2 pt-1">
              <label className="text-slate-600 font-bold">적격 횟수:</label>
              <input
                type="number"
                min={0}
                max={8}
                value={tc.personalityTestPassCount}
                onChange={(e) =>
                  updateTeachingChecklistState({
                    personalityTestPassCount: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
              />
              <span>회</span>
            </div>
          </div>

          {/* 2) 응급처치 및 심폐소생술 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                응급처치 및 심폐소생술
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  audit.teachingChecklistAudit.cprPassed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                기준: {audit.teachingChecklistAudit.cprTarget}회 이상 이수
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              학기별 1회 인정 (외부기관 이수 및 증빙 제출 시 최대 1회 한도 인정)
            </p>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <label className="text-slate-600 font-bold">총 이수:</label>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={tc.cprCompletedCount}
                  onChange={(e) =>
                    updateTeachingChecklistState({
                      cprCompletedCount: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
                />
                <span>회</span>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500">외부기관:</label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={tc.cprExternalCount || 0}
                  onChange={(e) =>
                    updateTeachingChecklistState({
                      cprExternalCount: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                />
                <span>회</span>
              </div>
            </div>
          </div>

          {/* 3) 성인지 교육 (입학연도별 2회 / 4회 자동 구분) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                성인지 교육 이수
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  audit.teachingChecklistAudit.genderSensitivityPassed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                기준: {audit.teachingChecklistAudit.genderSensitivityTarget}회 이상
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              2020학년도 이전 입학자 2회 이상 / 2021학년도 이후 입학자 4회 이상 (연 1회 인정)
            </p>
            <div className="flex items-center gap-2 pt-1">
              <label className="text-slate-600 font-bold">이수 횟수:</label>
              <input
                type="number"
                min={0}
                max={8}
                value={tc.genderSensitivityCount}
                onChange={(e) =>
                  updateTeachingChecklistState({
                    genderSensitivityCount: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
              />
              <span>회</span>
            </div>
          </div>

          {/* 4) 전공 및 교직 평점평균 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                전공 · 교직 평점평균
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  audit.teachingChecklistAudit.majorGpaPassed &&
                  audit.teachingChecklistAudit.teachingGpaPassed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                전공 2.31+ / 교직 2.75+
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">
                  전공 평점 (기준 2.31+)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={4.5}
                  value={tc.majorGpa ?? ""}
                  onChange={(e) =>
                    updateTeachingChecklistState({
                      majorGpa:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="예: 3.85"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">
                  교직 평점 (기준 2.75+)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={4.5}
                  value={tc.teachingGpa ?? ""}
                  onChange={(e) =>
                    updateTeachingChecklistState({
                      teachingGpa:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="예: 4.10"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>
            </div>
          </div>

          {/* 5) 교육학과 졸업논문 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                교육학과 졸업논문
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  tc.graduationThesisCompleted
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {tc.graduationThesisCompleted ? "완료" : "진행 예정"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              공식 가이드 기준: 졸업논문(교육학과) 필수 — 세부 일정 및 지침은 교육학과 공지 확인
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={tc.graduationThesisCompleted}
                onChange={(e) =>
                  updateTeachingChecklistState({
                    graduationThesisCompleted: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-orange-600"
              />
              <span>졸업논문 제출 및 통과 완료</span>
            </label>
          </div>

          {/* 6) 교원자격 취득 결격사유 안내 확인 (민감 건강·범죄 정보 비저장 원칙) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 dark:text-white">
                교원자격 취득 절차 안내 확인
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                민감정보 비저장
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              동국e음은 개인정보 보호를 위해 마약·대마·향정신성의약품 중독 여부 검사 결과나 성범죄 경력 등 민감한 정보를 입력받거나 저장하지 않습니다. 교원자격 무시험검정 신청 시 학교 안내 절차를 직접 확인해 주세요.
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={tc.disqualificationGuidanceAcknowledged}
                onChange={(e) =>
                  updateTeachingChecklistState({
                    disqualificationGuidanceAcknowledged: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-orange-600"
              />
              <span>무시험검정 서류 제출 절차 안내를 확인했습니다</span>
            </label>
          </div>
        </div>

        {/* 개인별 자유 체크리스트 메모 */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              개인별 추가 점검 메모 ({studentProgress.checklist.length}건)
            </span>
            <form onSubmit={handleAddChecklist} className="flex flex-wrap gap-2 text-xs">
              <input
                type="text"
                value={newChkLabel}
                onChange={(e) => setNewChkLabel(e.target.value)}
                placeholder="추가할 개인 점검 항목..."
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <input
                type="text"
                value={newChkMemo}
                onChange={(e) => setNewChkMemo(e.target.value)}
                placeholder="메모 (선택)"
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 항목 추가
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {studentProgress.checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleChecklistItem(item.id)}
                className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 text-xs transition ${
                  item.completed
                    ? "bg-emerald-50/50 border-emerald-200"
                    : "bg-slate-50/60 border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => {}}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <div>
                  <p
                    className={`font-bold ${
                      item.completed
                        ? "line-through text-slate-400"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </p>
                  {item.memo && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.memo}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          섹션 7. 미충족 항목 및 확인 필요 항목 요약
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 미충족 항목 요약 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              7-1. 현재 미충족 졸업·교직 요건 ({audit.unmetItems.length}건)
            </h2>
            {audit.unmetItems.length === 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                모든 필수 수치 충족!
              </span>
            )}
          </div>

          {audit.unmetItems.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              축하합니다! 현재 설정된 학번·전공·교직 트랙의 공식 수치 기준을 모두 충족했습니다.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {audit.unmetItems.map((u) => (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-orange-950">
                      {u.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-orange-700">
                      {u.category}
                    </span>
                  </div>
                  <p className="text-orange-900">{u.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 확인 필요 항목 요약 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-600" />
              7-2. 요람 · 학사운영실 확인 필요 항목 ({audit.needsReviewItems.length}건)
            </h2>
          </div>

          {audit.needsReviewItems.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
              현재 별도로 확인이 필요한 불확실 항목이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {audit.needsReviewItems.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1"
                >
                  <p className="font-extrabold text-amber-950">{rev.title}</p>
                  <p className="text-amber-900 leading-relaxed">{rev.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          섹션 8. 공식 학업이수 가이드 바로가기
         ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            8. 동국대학교 교육학과 공식 학업이수 가이드 및 학사 안내 바로가기
          </h2>
          <p className="text-xs text-slate-500">
            입학연도별 교육과정 요람, 기본이수과목 상세표, 무시험검정 신청 일정은 반드시 공식 홈페이지에서 최종 대조해 주세요.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            href={OFFICIAL_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            학업이수 가이드 (page/619) <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://edu.dongguk.edu"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
          >
            사범대학 · 교육학과 홈페이지 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}

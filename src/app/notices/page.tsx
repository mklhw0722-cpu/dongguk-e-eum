"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Notice, NoticeCategory } from "@/types";
import {
  NoticeCard,
  SearchAndFilterBar,
  EmptyStateBox,
  DemoInfoBanner,
  NOTICE_CATEGORY_TONE,
} from "@/components/common/Cards";
import {
  Badge,
  Button,
  buttonClass,
  Callout,
  Checkbox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { Plus, ExternalLink, Pin } from "lucide-react";

const NOTICE_CATEGORIES: ("전체" | NoticeCategory)[] = [
  "전체",
  "학교 공지",
  "교육학과 공지",
  "학사 일정",
  "장학 및 지원",
  "교직 관련 안내",
];

export default function NoticesPage() {
  const { notices, createNotice, currentRole } = useApp();
  const toast = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

  // 새 공지 작성 폼 상태
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<NoticeCategory>("교육학과 공지");
  const [newSummary, setNewSummary] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [newUrl, setNewUrl] = useState("https://www.dongguk.edu");

  const filteredNotices = notices
    .filter((n) => {
      const matchCat =
        selectedCategory === "전체" || n.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q);
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    createNotice({
      title: newTitle.trim(),
      category: newCategory,
      summary: newSummary.trim() || newContent.trim().slice(0, 80),
      content: newContent.trim(),
      isPinned: newPinned,
      officialUrl: newUrl.trim() || "https://www.dongguk.edu",
    });
    setNewTitle("");
    setNewSummary("");
    setNewContent("");
    setNewPinned(false);
    setIsWriteModalOpen(false);
    toast({ title: "공지를 등록했어요" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="학교 및 교육학과 공지사항"
        description="학교 공지, 교육학과 공지, 학사 일정, 장학 및 교직 안내를 카테고리별로 확인하세요."
        actions={
          <Button icon={<Plus />} onClick={() => setIsWriteModalOpen(true)}>
            관리자 공지 작성 UI {currentRole !== "admin" && "(데모 체험 가능)"}
          </Button>
        }
      />

      <DemoInfoBanner
        title="모든 공지사항은 프로토타입 시연을 위한 [예시 데이터]입니다."
        description="실제 동국대학교 및 사범대학 교육학과 공지로 오해하지 않도록 각 게시물에 '예시 데이터' 표기를 의무 적용했으며, 무단 웹 크롤링을 수행하지 않습니다."
        variant="amber"
      />

      {/* 검색 및 카테고리 필터 */}
      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="공지 제목, 키워드(예: 학술제, 교육봉사, 다전공, 장학)를 검색하세요..."
        categories={NOTICE_CATEGORIES}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 공지 목록 */}
      <div className="space-y-3">
        <p className="tabular text-sm text-ink-3" aria-live="polite">
          공지 {filteredNotices.length}건
        </p>
        {filteredNotices.length === 0 ? (
          <EmptyStateBox
            title="조건에 맞는 공지사항이 없습니다"
            description="다른 카테고리를 선택하거나 검색어를 초기화해 보세요."
            actionLabel="필터 초기화"
            onAction={() => {
              setSelectedCategory("전체");
              setSearchQuery("");
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredNotices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                onSelect={(n) => setSelectedNotice(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 공지 상세 보기 모달 */}
      <Modal
        open={selectedNotice !== null}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title}
        size="lg"
        meta={
          selectedNotice && (
            <>
              {selectedNotice.isPinned && (
                <Badge tone="brand" variant="solid" icon={<Pin />}>
                  중요 고정
                </Badge>
              )}
              <Badge tone={NOTICE_CATEGORY_TONE[selectedNotice.category] ?? "neutral"} dot>
                {selectedNotice.category}
              </Badge>
              <Badge tone="demo">예시 데이터 (실제 학교 공지 아님)</Badge>
            </>
          )
        }
        footer={
          <Button variant="secondary" onClick={() => setSelectedNotice(null)}>
            닫기
          </Button>
        }
      >
        {selectedNotice && (
          <div className="space-y-5">
            <p className="tabular flex flex-wrap gap-x-4 gap-y-1 border-b border-line pb-3 text-xs text-ink-3">
              <span>작성자: {selectedNotice.authorName}</span>
              <span>작성일: {selectedNotice.createdAt}</span>
            </p>

            <div className="whitespace-pre-line text-body leading-relaxed text-ink">
              {selectedNotice.content}
            </div>

            <Callout
              tone="brand"
              title="공식 출처 링크 안내"
              description="실제 학사·교직·장학 공지는 반드시 동국대학교 공식 홈페이지에서 확인하세요."
              icon={false}
              className="flex-col sm:flex-row sm:items-center"
              action={
                <a
                  href={selectedNotice.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("primary", "sm")}
                >
                  공식 홈페이지 이동 <ExternalLink />
                </a>
              }
            />
          </div>
        )}
      </Modal>

      {/* 관리자 공지 작성 모달 */}
      <Modal
        open={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        title="새 공지사항 등록 (관리자 데모 UI)"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsWriteModalOpen(false)}>
              취소
            </Button>
            <Button type="submit" form="notice-write-form">
              공지 등록 (데모)
            </Button>
          </>
        }
      >
        <form id="notice-write-form" onSubmit={handleCreateNotice} className="space-y-4">
          <Field label="공지 분류">
            <Select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as NoticeCategory)}
            >
              <option value="교육학과 공지">교육학과 공지</option>
              <option value="학교 공지">학교 공지</option>
              <option value="학사 일정">학사 일정</option>
              <option value="장학 및 지원">장학 및 지원</option>
              <option value="교직 관련 안내">교직 관련 안내</option>
            </Select>
          </Field>

          <Field
            label="공지 제목"
            hint="자동으로 [예시 데이터] 말머리가 부여됩니다"
            required
          >
            <Input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="예: 2026학년도 2학기 교육학과 종강총회 안내"
            />
          </Field>

          <Field label="한 줄 요약">
            <Input
              type="text"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="목록에 표시될 짧은 요약 문구"
            />
          </Field>

          <Field label="본문 내용" required>
            <Textarea
              rows={6}
              required
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="상세 공지 내용을 입력하세요..."
            />
          </Field>

          <Field label="공식 출처 링크 URL">
            <Input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </Field>

          <Checkbox
            label="중요 공지로 게시판 상단에 고정하기"
            checked={newPinned}
            onChange={(e) => setNewPinned(e.target.checked)}
          />
        </form>
      </Modal>
    </div>
  );
}

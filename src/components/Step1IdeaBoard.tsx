import React, { useState } from 'react';
import { 
  Plus, 
  ThumbsUp, 
  MessageSquare, 
  Trash2, 
  Check, 
  HelpCircle,
  Lightbulb,
  ShieldAlert,
  Users,
  Compass,
  CornerDownLeft,
  Lock,
  Award,
  ChevronDown,
  ChevronUp,
  Edit3,
  X,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  HelpCircle as QuestionIcon,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import type { IdeaCard, IdeaCategory, DecisionStatus, TeamMember } from '../types/index.ts';

interface Step1IdeaBoardProps {
  projectSummary: string;
  onUpdateSummary: (summary: string) => void;
  cards: IdeaCard[];
  onAddCard: (card: Omit<IdeaCard, 'id' | 'votes' | 'votedBy' | 'comments'>) => void;
  onUpdateCard: (id: string, updated: Partial<IdeaCard>) => void;
  onDeleteCard: (id: string) => void;
  onVoteCard: (cardId: string, memberName: string) => void;
  onAddComment: (cardId: string, author: string, text: string) => void;
  teamMembers: TeamMember[];
  isLocked: boolean;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
}

const CATEGORY_META: Record<
  IdeaCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string; border: string }
> = {
  problems_goals: {
    label: '핵심 문제 & 목표',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  actors: {
    label: '주요 사용자 역할(Actor)',
    icon: Users,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  user_stories: {
    label: '핵심 유저 스토리',
    icon: Compass,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  constraints: {
    label: '기술적 제약 및 비기능 요구사항',
    icon: Lightbulb,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

const STATUS_META: Record<DecisionStatus, { label: string; bg: string; text: string; border: string }> = {
  ACCEPTED: { label: '채택됨 (Accepted)', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-600/40' },
  REVIEW: { label: '검토중 (Review)', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-600/40' },
  DEFERRED: { label: '보류 (Deferred)', bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' },
  REJECTED: { label: '기각됨 (Rejected)', bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-600/40' },
};

export const Step1IdeaBoard: React.FC<Step1IdeaBoardProps> = ({
  projectSummary,
  onUpdateSummary,
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onVoteCard,
  onAddComment,
  teamMembers,
  isLocked,
  sidebarWidth,
  onStartResize,
  mobileTab,
  onChangeMobileTab,
  isDesktop = true,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<IdeaCategory>('problems_goals');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [newDecisionReason, setNewDecisionReason] = useState('');
  const [newDecisionStatus, setNewDecisionStatus] = useState<DecisionStatus>('ACCEPTED');
  const [selectedAuthor, setSelectedAuthor] = useState(teamMembers[0]?.name || '현우');
  
  const [filterCategory, setFilterCategory] = useState<IdeaCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DecisionStatus | 'all'>('all');

  const [expandedRationaleCardId, setExpandedRationaleCardId] = useState<string | null>(null);
  const [activeCommentCardId, setActiveCommentCardId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(teamMembers[1]?.name || '수민');

  // Edit Rationale & Decision Modal
  const [editingCard, setEditingCard] = useState<IdeaCard | null>(null);
  const [editRationale, setEditRationale] = useState('');
  const [editDecisionReason, setEditDecisionReason] = useState('');
  const [editDecisionStatus, setEditDecisionStatus] = useState<DecisionStatus>('ACCEPTED');
  const [editDecidedBy, setEditDecidedBy] = useState('');

  const handleOpenEditModal = (card: IdeaCard) => {
    setEditingCard(card);
    setEditRationale(card.rationale || '');
    setEditDecisionReason(card.decisionReason || '');
    setEditDecisionStatus(card.decisionStatus || 'REVIEW');
    setEditDecidedBy(card.decidedBy || teamMembers[0]?.name || '현우');
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || isLocked) return;
    
    onUpdateCard(editingCard.id, {
      rationale: editRationale.trim() || undefined,
      decisionReason: editDecisionReason.trim() || undefined,
      decisionStatus: editDecisionStatus,
      decidedBy: editDecidedBy.trim() || undefined,
    });

    setEditingCard(null);
  };

  const handleCreateCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) return;
    if (!newTitle.trim()) return;

    onAddCard({
      category: selectedCategory,
      title: newTitle.trim(),
      description: newDescription.trim() || '상세 내용 없음',
      author: selectedAuthor,
      rationale: newRationale.trim() || undefined,
      decisionStatus: newDecisionStatus,
      decisionReason: newDecisionReason.trim() || undefined,
      decidedBy: selectedAuthor,
    });

    setNewTitle('');
    setNewDescription('');
    setNewRationale('');
    setNewDecisionReason('');
  };

  const handlePostComment = (cardId: string) => {
    if (!commentText.trim()) return;
    onAddComment(cardId, commentAuthor, commentText.trim());
    setCommentText('');
  };

  const filteredCards = cards.filter((c) => {
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;
    if (filterStatus !== 'all' && (c.decisionStatus || 'REVIEW') !== filterStatus) return false;
    return true;
  });

  const acceptedCount = cards.filter(c => c.decisionStatus === 'ACCEPTED').length;
  const reviewCount = cards.filter(c => (c.decisionStatus || 'REVIEW') === 'REVIEW').length;
  const deferredCount = cards.filter(c => c.decisionStatus === 'DEFERRED').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Mobile / Tablet Segmented View Switcher */}
      <div className="lg:hidden flex items-center justify-center p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full max-w-sm">
          <button
            onClick={() => onChangeMobileTab('editor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'editor'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>아이디어 편집기</span>
          </button>
          <button
            onClick={() => onChangeMobileTab('canvas')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'canvas'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>의사결정 캔버스</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Resizable Editor with Rationale & Decision Log */}
        <div 
          style={{ width: isDesktop ? `${sidebarWidth}%` : '100%' }}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            mobileTab === 'editor' ? 'w-full flex' : 'hidden lg:flex'
          }`}
        >
          <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" />
                Step 1. 아이디어 &amp; 의사결정 (Why &amp; Decision)
              </span>
              {isLocked && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/30">
                  <Lock className="w-3 h-3" /> 잠금 활성
                </span>
              )}
            </div>

            {/* Project Summary Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">프로젝트 한 줄 정의</label>
              <input
                type="text"
                disabled={isLocked}
                value={projectSummary}
                onChange={(e) => onUpdateSummary(e.target.value)}
                placeholder="예: 사내 스터디 매칭 & 출석 관리 플랫폼"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* Decision KPI Summary Pill */}
            <div className="mt-2.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">의사결정 현황:</span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-600/30">
                  채택 {acceptedCount}
                </span>
                <span className="text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/30">
                  검토 {reviewCount}
                </span>
                <span className="text-slate-400 font-medium bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                  보류 {deferredCount}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Card Form with Why & Decision */}
          <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/40 shrink-0 overflow-y-auto max-h-[340px]">
            <form onSubmit={handleCreateCard} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">신규 아이디어 &amp; 의사결정 근거 기록</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <CornerDownLeft className="w-3 h-3" /> 빠른 등록
                </span>
              </div>

              {/* Category selection */}
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium text-left truncate flex items-center gap-1.5 border transition-all ${
                        isSelected
                          ? `${meta.bg} ${meta.border} ${meta.color} font-semibold ring-1 ring-indigo-500/30`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <meta.icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{meta.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Title & Desc */}
              <div className="space-y-1.5">
                <input
                  type="text"
                  disabled={isLocked}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="아이디어 핵심 제목 (필수)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="상세 내용 요약..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
                />
              </div>

              {/* Why (Rationale) */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                  <QuestionIcon className="w-3 h-3" />
                  <span>왜 그런 아이디어를 냈는가? (제안 배경 &amp; 문제 가설 Why)</span>
                </label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="예: 기존 스터디 40% 이상이 노쇼로 중도 해체되는 반복 문제 해결을 위해..."
                  className="w-full bg-slate-950 border border-amber-900/50 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Decision Status & Reason */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    <span>결정 상태 (Status)</span>
                  </label>
                  <select
                    disabled={isLocked}
                    value={newDecisionStatus}
                    onChange={(e) => setNewDecisionStatus(e.target.value as DecisionStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none mt-1"
                  >
                    <option value="ACCEPTED">채택됨 (Accepted)</option>
                    <option value="REVIEW">검토중 (Review)</option>
                    <option value="DEFERRED">보류 (Deferred)</option>
                    <option value="REJECTED">기각됨 (Rejected)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-300">작성자</label>
                  <select
                    disabled={isLocked}
                    value={selectedAuthor}
                    onChange={(e) => setSelectedAuthor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none mt-1"
                  >
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.badge})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-emerald-400">
                  왜 그 아이디어로 결정/채택했는가? (최종 결정 사유 &amp; 근거)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={newDecisionReason}
                  onChange={(e) => setNewDecisionReason(e.target.value)}
                  placeholder="예: 팀원 만장일치 5표 획득 및 MVP 4주 내 구축 가능성 검증 완료"
                  className="w-full bg-slate-950 border border-emerald-900/50 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isLocked || !newTitle.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>아이디어 등록</span>
                </button>
              </div>
            </form>
          </div>

          {/* Filter bar and Cards List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="font-semibold text-slate-300">등록된 아이디어 ({filteredCards.length})</span>
              <div className="flex items-center gap-1">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
                >
                  <option value="all">전체 상태</option>
                  <option value="ACCEPTED">채택됨</option>
                  <option value="REVIEW">검토중</option>
                  <option value="DEFERRED">보류</option>
                  <option value="REJECTED">기각됨</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredCards.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  조건에 일치하는 아이디어 카드가 없습니다.
                </div>
              ) : (
                filteredCards.map((card) => {
                  const meta = CATEGORY_META[card.category];
                  const sMeta = STATUS_META[card.decisionStatus || 'REVIEW'];
                  const isExpanded = expandedRationaleCardId === card.id;

                  return (
                    <div
                      key={card.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} border ${meta.border}`}>
                            {meta.label}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sMeta.bg} ${sMeta.text} ${sMeta.border}`}>
                            {sMeta.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                            <ThumbsUp className="w-3 h-3" /> {card.votes}
                          </span>
                          
                          {!isLocked && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(card)}
                                className="text-slate-500 hover:text-indigo-400 p-0.5"
                                title="발의 배경 / 결정 사유 수정"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteCard(card.id)}
                                className="text-slate-600 hover:text-rose-400 p-0.5"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-100">{card.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{card.description}</p>

                      {/* Toggle Why / Decision Reason */}
                      {(card.rationale || card.decisionReason) && (
                        <div className="pt-1.5 border-t border-slate-900">
                          <button
                            onClick={() => setExpandedRationaleCardId(isExpanded ? null : card.id)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>제안 배경(Why) &amp; 채택 근거 보기</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                              {card.rationale && (
                                <div>
                                  <span className="font-bold text-amber-400 flex items-center gap-1">
                                    <QuestionIcon className="w-3 h-3" /> 왜 이 아이디어를 냈는가? (제안 배경/가설):
                                  </span>
                                  <p className="text-slate-300 mt-0.5 pl-4 leading-relaxed">{card.rationale}</p>
                                </div>
                              )}
                              {card.decisionReason && (
                                <div>
                                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                                    <Award className="w-3 h-3" /> 왜 이 아이디어로 결정했는가? (최종 결정 사유):
                                  </span>
                                  <p className="text-slate-300 mt-0.5 pl-4 leading-relaxed">{card.decisionReason}</p>
                                </div>
                              )}
                              {card.decidedBy && (
                                <div className="text-[10px] text-slate-500 pl-4">
                                  의사결정자: {card.decidedBy}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                        <span>제안자: {card.author}</span>
                        <span>댓글 {card.comments.length}개</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Resizer Divider between Left and Right Panel */}
        <div
          onMouseDown={onStartResize}
          className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
          title="드래그하여 사이드바 너비 조절 (더블클릭 시 42% 리셋)"
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* RIGHT PANEL: Cluster Canvas */}
        <div 
          style={{ width: isDesktop ? `${100 - sidebarWidth}%` : '100%' }}
          className={`flex-col h-full bg-slate-950/60 overflow-hidden ${
            mobileTab === 'canvas' ? 'w-full flex' : 'hidden lg:flex'
          }`}
        >
          {/* Canvas Toolbar */}
          <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">도메인 브레인스토밍 &amp; 의사결정 캔버스</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">· 가설(Why) 검증 및 채택 히스토리</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              총 {cards.length}건 등록됨
            </span>
          </div>

          {/* 4 Category Clusters Grid Canvas */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((categoryKey) => {
              const meta = CATEGORY_META[categoryKey];
              const clusterCards = cards.filter((c) => c.category === categoryKey);

              return (
                <div
                  key={categoryKey}
                  className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm"
                >
                  {/* Cluster Header */}
                  <div className={`px-3 py-2 border-b border-slate-800/80 flex items-center justify-between ${meta.bg}`}>
                    <div className="flex items-center gap-2">
                      <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                    </div>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300">
                      {clusterCards.length}
                    </span>
                  </div>

                  {/* Cluster Cards Space */}
                  <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[380px]">
                    {clusterCards.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-800 rounded-lg flex items-center justify-center text-[11px] text-slate-600">
                        카드를 추가해주세요
                      </div>
                    ) : (
                      clusterCards.map((card) => {
                        const isCommenting = activeCommentCardId === card.id;
                        const sMeta = STATUS_META[card.decisionStatus || 'REVIEW'];

                        return (
                          <div
                            key={card.id}
                            className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow transition-all space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="space-y-1">
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${sMeta.bg} ${sMeta.text} ${sMeta.border}`}>
                                  {sMeta.label}
                                </span>
                                <h5 className="text-xs font-bold text-slate-100">{card.title}</h5>
                              </div>

                              {/* Dot Voting Button */}
                              <button
                                onClick={() => {
                                  const voter = teamMembers[0]?.name || '현우';
                                  onVoteCard(card.id, voter);
                                }}
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1 active:scale-95 transition-transform"
                                title="팀원 +1 투표"
                              >
                                <ThumbsUp className="w-3 h-3 text-amber-400" />
                                <span>+{card.votes}</span>
                              </button>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-snug">{card.description}</p>

                            {/* Inline Why / Decision highlight */}
                            {card.rationale && (
                              <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[10px]">
                                <span className="font-semibold text-amber-400 flex items-center gap-1">
                                  <QuestionIcon className="w-3 h-3" /> 왜 그런 아이디어를 냈는가?
                                </span>
                                <p className="text-slate-300 mt-0.5 line-clamp-2">{card.rationale}</p>
                              </div>
                            )}

                            {card.decisionReason && (
                              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-[10px]">
                                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                                  <Award className="w-3 h-3" /> 왜 이 아이디어로 결정했는가?
                                </span>
                                <p className="text-slate-300 mt-0.5 line-clamp-2">{card.decisionReason}</p>
                              </div>
                            )}

                            {/* Quick Decision status switch & Edit Rationale Button */}
                            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-800/60 flex-wrap gap-1">
                              <div className="flex items-center gap-1">
                                <span>상태:</span>
                                {(['ACCEPTED', 'REVIEW', 'DEFERRED'] as DecisionStatus[]).map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => onUpdateCard(card.id, { decisionStatus: st })}
                                    className={`px-1.5 py-0.2 rounded ${
                                      (card.decisionStatus || 'REVIEW') === st
                                        ? 'bg-indigo-600 text-white font-bold'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    {st === 'ACCEPTED' ? '채택' : st === 'REVIEW' ? '검토' : '보류'}
                                  </button>
                                ))}
                              </div>

                              <button
                                onClick={() => handleOpenEditModal(card)}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>사유 수정</span>
                              </button>
                            </div>

                            {/* Footer with Comments */}
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-mono text-[10px]">by {card.author}</span>
                              <button
                                onClick={() => setActiveCommentCardId(isCommenting ? null : card.id)}
                                className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>댓글 ({card.comments.length})</span>
                              </button>
                            </div>

                            {/* Expanded Comments */}
                            {isCommenting && (
                              <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in duration-100">
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {card.comments.length === 0 ? (
                                    <p className="text-[10px] text-slate-500 italic">아직 작성된 코멘트가 없습니다.</p>
                                  ) : (
                                    card.comments.map((comm) => (
                                      <div key={comm.id} className="p-1.5 rounded bg-slate-950 text-[10px]">
                                        <div className="flex items-center justify-between font-semibold text-indigo-300">
                                          <span>{comm.author}</span>
                                          <span className="text-slate-600 font-normal">{comm.createdAt}</span>
                                        </div>
                                        <p className="text-slate-300 mt-0.5">{comm.text}</p>
                                      </div>
                                    ))
                                  )}
                                </div>

                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment(card.id)}
                                    placeholder="코멘트 남기기..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handlePostComment(card.id)}
                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold shrink-0"
                                  >
                                    등록
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dedicated Edit Why & Decision Modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">아이디어 발의 배경 및 결정 사유 기록</h4>
                  <p className="text-[11px] text-slate-400 truncate max-w-sm font-mono mt-0.5">
                    {editingCard.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCard(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="p-4 sm:p-5 space-y-4">
              {/* Question 1: Why proposed? */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <QuestionIcon className="w-3.5 h-3.5" />
                  <span>1. 왜 그런 아이디어를 냈는가? (제안 배경 &amp; 문제 가설)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  이 아이디어가 해결하려는 실제 문제, 기존 프로세스의 비효율 또는 타겟 고객의 불만점을 기술하세요.
                </p>
                <textarea
                  rows={3}
                  value={editRationale}
                  onChange={(e) => setEditRationale(e.target.value)}
                  placeholder="예: 기존 스터디 40% 이상이 노쇼로 중도 해체되는 반복 문제 해결을 위해..."
                  className="w-full bg-slate-950 border border-amber-900/50 rounded-lg p-2.5 sm:p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Question 2: Why accepted/chosen? */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>2. 왜 그 아이디어로 결정/채택했는가? (최종 결정 사유 &amp; 선정 근거)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  다른 대안 대비 채택된 이유, 팀원 피드백, 실현 가능성(FE/BE 공수), 비즈니스 우선순위를 기록하세요.
                </p>
                <textarea
                  rows={3}
                  value={editDecisionReason}
                  onChange={(e) => setEditDecisionReason(e.target.value)}
                  placeholder="예: 팀원 만장일치 5표 획득 및 MVP 4주 내 구축 가능성 검증 완료..."
                  className="w-full bg-slate-950 border border-emerald-900/50 rounded-lg p-2.5 sm:p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Status & Decided By */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-300">결정 상태 (Status)</label>
                  <select
                    value={editDecisionStatus}
                    onChange={(e) => setEditDecisionStatus(e.target.value as DecisionStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none mt-1"
                  >
                    <option value="ACCEPTED">채택됨 (Accepted)</option>
                    <option value="REVIEW">검토중 (Review)</option>
                    <option value="DEFERRED">보류 (Deferred)</option>
                    <option value="REJECTED">기각됨 (Rejected)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">의사결정자 (Decided By)</label>
                  <input
                    type="text"
                    value={editDecidedBy}
                    onChange={(e) => setEditDecidedBy(e.target.value)}
                    placeholder="예: 현우 (Tech Lead) / 팀 합의"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>사유 &amp; 의사결정 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Plus, 
  ThumbsUp, 
  MessageSquare, 
  Trash2, 
  Sparkles, 
  Check, 
  HelpCircle,
  Lightbulb,
  ShieldAlert,
  Users,
  Compass,
  CornerDownLeft,
  Lock
} from 'lucide-react';
import type { IdeaCard, IdeaCategory, TeamMember } from '../types/index.ts';

interface Step1IdeaBoardProps {
  projectSummary: string;
  onUpdateSummary: (summary: string) => void;
  cards: IdeaCard[];
  onAddCard: (card: Omit<IdeaCard, 'id' | 'votes' | 'votedBy' | 'comments'>) => void;
  onDeleteCard: (id: string) => void;
  onVoteCard: (cardId: string, memberName: string) => void;
  onAddComment: (cardId: string, author: string, text: string) => void;
  teamMembers: TeamMember[];
  isLocked: boolean;
  onTriggerAiDraft: () => void;
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

export const Step1IdeaBoard: React.FC<Step1IdeaBoardProps> = ({
  projectSummary,
  onUpdateSummary,
  cards,
  onAddCard,
  onDeleteCard,
  onVoteCard,
  onAddComment,
  teamMembers,
  isLocked,
  onTriggerAiDraft,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<IdeaCategory>('problems_goals');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState(teamMembers[0]?.name || '현우');
  const [filterCategory, setFilterCategory] = useState<IdeaCategory | 'all'>('all');
  const [activeCommentCardId, setActiveCommentCardId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(teamMembers[1]?.name || '수민');

  const handleCreateCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) return;
    if (!newTitle.trim()) return;

    onAddCard({
      category: selectedCategory,
      title: newTitle.trim(),
      description: newDescription.trim() || '상세 내용 없음',
      author: selectedAuthor,
    });

    setNewTitle('');
    setNewDescription('');
  };

  const handlePostComment = (cardId: string) => {
    if (!commentText.trim()) return;
    onAddComment(cardId, commentAuthor, commentText.trim());
    setCommentText('');
  };

  const filteredCards = filterCategory === 'all' ? cards : cards.filter((c) => c.category === filterCategory);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* LEFT PANEL: 42% Structured Keyboard Editor */}
      <div className="w-[42%] border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" />
              Step 1. 아이디어 & 도메인 브레인스토밍
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
        </div>

        {/* Quick Card Form (Enter to Add) */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/40 shrink-0">
          <form onSubmit={handleCreateCard} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">신규 아이디어 카드 추가</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3" /> Enter로 즉시 등록
              </span>
            </div>

            {/* Category selection radio buttons */}
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
            <div className="space-y-2">
              <input
                type="text"
                disabled={isLocked}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="아이디어 핵심 요약 (Enter로 등록)..."
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              <textarea
                rows={2}
                disabled={isLocked}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="구체적인 배경 및 요구사항 설명..."
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
              />
            </div>

            {/* Author and Submit */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>작성자:</span>
                <select
                  disabled={isLocked}
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.badge})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isLocked || !newTitle.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>카드 추가</span>
              </button>
            </div>
          </form>
        </div>

        {/* List of Registered Cards */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">등록된 아이디어 ({cards.length}개)</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  filterCategory === 'all' ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-slate-800'
                }`}
              >
                전체
              </button>
              {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    filterCategory === cat ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-slate-800'
                  }`}
                >
                  {cat === 'problems_goals' ? '문제' : cat === 'actors' ? '역할' : cat === 'user_stories' ? '스토리' : '제약'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredCards.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                해당 카테고리에 등록된 카드가 없습니다.
              </div>
            ) : (
              filteredCards.map((card) => {
                const meta = CATEGORY_META[card.category];
                return (
                  <div
                    key={card.id}
                    className={`p-3 rounded-lg border bg-slate-950/80 hover:border-slate-700 transition-all group ${
                      card.isAiDraft ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} border ${meta.border} flex items-center gap-1`}>
                        <meta.icon className="w-2.5 h-2.5" />
                        {meta.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" /> {card.votes}
                        </span>
                        {!isLocked && (
                          <button
                            onClick={() => onDeleteCard(card.id)}
                            className="text-slate-600 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-100 mb-1">{card.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{card.description}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-900">
                      <span>작성: {card.author}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-slate-400" />
                        댓글 {card.comments.length}개
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: 58% Interactive Visual Canvas */}
      <div className="w-[58%] flex flex-col h-full bg-slate-950/60 overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">도메인 브레인스토밍 캔버스</span>
            <span className="text-[11px] text-slate-400">· 실시간 Dot Voting & 팀 코멘트 핀</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerAiDraft}
              className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI 유저 스토리 추천</span>
            </button>
          </div>
        </div>

        {/* 4 Category Clusters Grid Canvas */}
        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 gap-4">
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

                      return (
                        <div
                          key={card.id}
                          className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg shadow transition-all"
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <h5 className="text-xs font-semibold text-slate-100">{card.title}</h5>
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

                          <p className="text-[11px] text-slate-400 leading-snug mb-2">{card.description}</p>

                          {/* Voters avatar preview */}
                          {card.votedBy.length > 0 && (
                            <div className="flex items-center gap-1 mb-2">
                              <span className="text-[10px] text-slate-500">투표자:</span>
                              <div className="flex -space-x-1">
                                {card.votedBy.map((voter, idx) => (
                                  <div
                                    key={idx}
                                    className="w-4 h-4 rounded-full bg-indigo-600 text-[8px] text-white font-bold flex items-center justify-center ring-1 ring-slate-900"
                                    title={voter}
                                  >
                                    {voter.slice(0, 1)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Comments section toggle */}
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-mono text-[10px]">by {card.author}</span>
                            <button
                              onClick={() => setActiveCommentCardId(isCommenting ? null : card.id)}
                              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>코멘트 ({card.comments.length})</span>
                            </button>
                          </div>

                          {/* Expanded Comment Box */}
                          {isCommenting && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-2 animate-in fade-in duration-100">
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
                                <select
                                  value={commentAuthor}
                                  onChange={(e) => setCommentAuthor(e.target.value)}
                                  className="bg-slate-950 border border-slate-700 rounded px-1 text-[10px] text-slate-300 shrink-0"
                                >
                                  {teamMembers.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
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
  );
};

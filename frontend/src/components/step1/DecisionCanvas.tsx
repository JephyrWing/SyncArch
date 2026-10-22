import React, { useState } from 'react';
import { Award, Edit3, HelpCircle as QuestionIcon, MessageSquare, Plus, ThumbsUp } from 'lucide-react';
import type { DecisionStatus, IdeaCard, TeamMember } from '../../types/index.ts';
import { STATUS_META } from './ideaConfig.ts';
import { voteCount } from '../../utils/votes.ts';
import { IdeaTree } from './IdeaTree.tsx';

interface DecisionCanvasProps {
  cards: IdeaCard[];
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onAddDerived: (card: IdeaCard) => void;
  teamMembers: TeamMember[];
  onVoteCard: (cardId: string, memberName: string) => void;
  onUpdateCard: (id: string, updated: Partial<IdeaCard>) => void;
  onAddComment: (cardId: string, author: string, text: string) => void;
  onOpenEdit: (card: IdeaCard, decisionStatus?: DecisionStatus) => void;
  isLocked: boolean;
}

export const DecisionCanvas: React.FC<DecisionCanvasProps> = ({
  cards,
  expanded, onToggle, onAddDerived,
  teamMembers,
  onVoteCard,
  onUpdateCard,
  onAddComment,
  onOpenEdit,
  isLocked,
}) => {
  const [activeCommentCardId, setActiveCommentCardId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const handlePostComment = (cardId: string) => {
    const commentText = commentDrafts[cardId] ?? '';
    if (isLocked || !commentText.trim()) return;
    onAddComment(cardId, '', commentText.trim());
    setCommentDrafts((previous) => ({ ...previous, [cardId]: '' }));
  };

  const renderCard = (card: IdeaCard, childCount: number) => {
    const isCommenting = activeCommentCardId === card.id;
    const commentText = commentDrafts[card.id] ?? '';
    const sMeta = STATUS_META[card.decisionStatus || 'REVIEW'];

    return (
      <div
        key={card.id}
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest('button, input, textarea, select, a')) onToggle(card.id);
        }}
        className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow transition-all space-y-2"
      >
        <div className="flex items-start justify-between gap-1">
          <div className="space-y-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${sMeta.bg} ${sMeta.text} ${sMeta.border}`}>
              {sMeta.label}
            </span>
            <button type="button" onClick={() => onToggle(card.id)}
              aria-expanded={expanded.has(card.id)} aria-label={`${card.title} 하위 ${expanded.has(card.id) ? '접기' : '펼치기'}`}
              className="block text-left text-xs font-bold text-slate-100 hover:text-indigo-300">
              {card.title}<span className="ml-2 text-indigo-400">{expanded.has(card.id) ? '▾' : '▸'} {childCount}</span>
            </button>
          </div>

          {/* [아이디어 보드] 투표 버튼 */}
          <button
            disabled={isLocked}
            onClick={() => {
              onVoteCard(card.id, '');
            }}
            className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1 active:scale-95 transition-transform"
            title="팀원 +1 투표"
          >
            <ThumbsUp className="w-3 h-3 text-amber-400" />
            <span>+{voteCount(card)}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-snug">{card.description}</p>

        {/* [아이디어 보드] 이유 / 결정 강조 표시 */}
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

        {/* [아이디어 보드] 결정 상태 빠른 전환과 근거 수정 버튼 */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-800/60 flex-wrap gap-1">
          <div className="flex items-center gap-1">
            <span>상태:</span>
            {(['ACCEPTED', 'REVIEW', 'DEFERRED'] as DecisionStatus[]).map((st) => (
              <button
                key={st}
                disabled={isLocked}
                onClick={() => st === 'REVIEW' ? onUpdateCard(card.id, { decisionStatus: st }) : onOpenEdit(card, st)}
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
            disabled={isLocked}
            onClick={() => onOpenEdit(card)}
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            <Edit3 className="w-3 h-3" />
            <span>수정</span>
          </button>
        </div>

        <button type="button" disabled={isLocked} onClick={() => onAddDerived(card)}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-300 disabled:opacity-40">
          <Plus className="h-3 w-3" />파생 아이디어
        </button>

        {/* [아이디어 보드] 댓글이 있는 하단 */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono text-[10px]">by {card.author || teamMembers.find((member) => member.id === card.authorId)?.name || '알 수 없음'}</span>
          <button
            onClick={() => setActiveCommentCardId(isCommenting ? null : card.id)}
            className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            <span>댓글 ({card.comments.length})</span>
          </button>
        </div>

        {/* [아이디어 보드] 펼친 댓글 */}
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
                disabled={isLocked}
                type="text"
                value={commentText}
                onChange={(e) => setCommentDrafts((previous) => ({ ...previous, [card.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handlePostComment(card.id)}
                placeholder="코멘트 남기기..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none"
              />
              <button
                disabled={isLocked}
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
  };

  return <IdeaTree cards={cards} expanded={expanded} renderCard={renderCard} />;
};

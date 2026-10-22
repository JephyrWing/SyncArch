import React, { useState } from 'react';
import { Award, ChevronDown, ChevronUp, Edit3, HelpCircle as QuestionIcon, ThumbsUp, Trash2 } from 'lucide-react';
import type { DecisionStatus, IdeaCard, TeamMember } from '../../types/index.ts';
import { CATEGORY_META, STATUS_META } from './ideaConfig.ts';
import { voteCount } from '../../utils/votes.ts';

interface IdeaCardListProps {
  cards: IdeaCard[];
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onAddDerived: (card: IdeaCard) => void;
  teamMembers: TeamMember[];
  isLocked: boolean;
  onOpenEdit: (card: IdeaCard) => void;
  onDeleteCard: (id: string) => void;
}

export const IdeaCardList: React.FC<IdeaCardListProps> = ({ cards, expanded, onToggle, onAddDerived, teamMembers, isLocked, onOpenEdit, onDeleteCard }) => {
  const [filterStatus, setFilterStatus] = useState<DecisionStatus | 'all'>('all');
  const [expandedRationaleCardId, setExpandedRationaleCardId] = useState<string | null>(null);

  const filteredCards = cards.filter((c) => {
    if (filterStatus !== 'all' && (c.decisionStatus || 'REVIEW') !== filterStatus) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <span className="font-semibold text-slate-300">표시 중인 아이디어 ({filteredCards.length})</span>
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
                      <ThumbsUp className="w-3 h-3" /> {voteCount(card)}
                    </span>

                    {!isLocked && (
                      <>
                        <button
                          onClick={() => onOpenEdit(card)}
                          className="text-slate-500 hover:text-indigo-400 p-0.5"
                          title="아이디어 수정"
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
                <div className="flex gap-3 text-xs text-indigo-300">
                  <button type="button" aria-expanded={expanded.has(card.id)} onClick={() => onToggle(card.id)}>{expanded.has(card.id) ? '하위 접기' : '하위 펼치기'}</button>
                  <button type="button" disabled={isLocked} onClick={() => onAddDerived(card)}>+ 파생 아이디어</button>
                </div>

                {/* [아이디어 보드] 이유 / 결정 사유 펼치기 */}
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
                            의사결정자: {teamMembers.find((m) => m.id === card.decidedBy)?.name ?? card.decidedBy}
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
  );
};

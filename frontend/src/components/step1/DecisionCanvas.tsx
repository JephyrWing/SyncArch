import React, { useState } from 'react';
import { Award, Edit3, HelpCircle as QuestionIcon, MessageSquare, ThumbsUp } from 'lucide-react';
import type { DecisionStatus, IdeaCard, IdeaCategory, TeamMember } from '../../types/index.ts';
import { CATEGORY_META, STATUS_META } from './ideaConfig.ts';
import { voteCount } from '../../utils/votes.ts';

interface DecisionCanvasProps {
  cards: IdeaCard[];
  teamMembers: TeamMember[];
  onVoteCard: (cardId: string, memberName: string) => void;
  onUpdateCard: (id: string, updated: Partial<IdeaCard>) => void;
  onAddComment: (cardId: string, author: string, text: string) => void;
  onOpenEdit: (card: IdeaCard) => void;
}

export const DecisionCanvas: React.FC<DecisionCanvasProps> = ({
  cards,
  teamMembers,
  onVoteCard,
  onUpdateCard,
  onAddComment,
  onOpenEdit,
}) => {
  const [activeCommentCardId, setActiveCommentCardId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor] = useState(teamMembers[1]?.name || '수민');

  const handlePostComment = (cardId: string) => {
    if (!commentText.trim()) return;
    onAddComment(cardId, commentAuthor, commentText.trim());
    setCommentText('');
  };

  return (
    <>
      {/* [아이디어 보드] 캔버스 툴바 */}
      <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">도메인 브레인스토밍 &amp; 의사결정 캔버스</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">· 가설(Why) 검증 및 채택 히스토리</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          총 {cards.length}건 등록됨
        </span>
      </div>

      {/* [아이디어 보드] 4개 분류 격자 캔버스 */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((categoryKey) => {
          const meta = CATEGORY_META[categoryKey];
          const clusterCards = cards.filter((c) => c.category === categoryKey);

          return (
            <div
              key={categoryKey}
              className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm"
            >
              {/* [아이디어 보드] 분류 헤더 */}
              <div className={`px-3 py-2 border-b border-slate-800/80 flex items-center justify-between ${meta.bg}`}>
                <div className="flex items-center gap-2">
                  <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                </div>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300">
                  {clusterCards.length}
                </span>
              </div>

              {/* [아이디어 보드] 분류별 카드 영역 */}
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

                          {/* [아이디어 보드] 투표 버튼 */}
                          <button
                            onClick={() => {
                              const voter = teamMembers[0]?.name || '현우';
                              onVoteCard(card.id, voter);
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
                            onClick={() => onOpenEdit(card)}
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>사유 수정</span>
                          </button>
                        </div>

                        {/* [아이디어 보드] 댓글이 있는 하단 */}
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
    </>
  );
};

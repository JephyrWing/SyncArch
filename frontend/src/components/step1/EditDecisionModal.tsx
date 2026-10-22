import React, { useState } from 'react';
import { Award, Check, Edit3, HelpCircle as QuestionIcon, X } from 'lucide-react';
import type { DecisionStatus, IdeaCard, TeamMember } from '../../types/index.ts';

interface EditDecisionModalProps {
  card: IdeaCard;
  teamMembers: TeamMember[];
  isLocked: boolean;
  onUpdateCard: (id: string, updated: Partial<IdeaCard>) => void;
  onClose: () => void;
}

// [아이디어 보드] 열 때마다 새로 마운트되어 카드 값으로 입력을 채운다(분리 전 열기 동작과 같음).
export const EditDecisionModal: React.FC<EditDecisionModalProps> = ({
  card: editingCard,
  teamMembers,
  isLocked,
  onUpdateCard,
  onClose,
}) => {
  const [editRationale, setEditRationale] = useState(editingCard.rationale || '');
  const [editDecisionReason, setEditDecisionReason] = useState(editingCard.decisionReason || '');
  const [editDecisionStatus, setEditDecisionStatus] = useState<DecisionStatus>(editingCard.decisionStatus || 'REVIEW');
  const [editDecidedBy, setEditDecidedBy] = useState(editingCard.decidedBy || teamMembers[0]?.name || '현우');

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    onUpdateCard(editingCard.id, {
      rationale: editRationale.trim() || undefined,
      decisionReason: editDecisionReason.trim() || undefined,
      decisionStatus: editDecisionStatus,
      decidedBy: editDecidedBy.trim() || undefined,
    });

    onClose();
  };

  return (
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
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveEditModal} className="p-4 sm:p-5 space-y-4">
          {/* [아이디어 보드] 질문 1: 왜 제안했나? */}
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

          {/* [아이디어 보드] 질문 2: 왜 채택·선택했나? */}
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

          {/* [아이디어 보드] 상태와 결정자 */}
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
              onClick={onClose}
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
  );
};

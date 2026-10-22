import React, { useEffect, useRef, useState } from 'react';
import { Check, Edit3, X } from 'lucide-react';
import type { DecisionStatus, IdeaCard, IdeaCategory } from '../../types/index.ts';
import { CATEGORY_META, STATUS_META } from './ideaConfig.ts';

interface EditDecisionModalProps {
  card: IdeaCard;
  currentCard?: IdeaCard;
  initialDecisionStatus?: DecisionStatus;
  isLocked: boolean;
  onUpdateCard: (id: string, updated: Partial<IdeaCard>) => void;
  onClose: () => void;
}

// [아이디어 보드] 임시 입력은 모달에 두고 적용할 때 변경한 항목만 공유 상태에 전달한다.
export const EditDecisionModal: React.FC<EditDecisionModalProps> = ({
  card, currentCard, initialDecisionStatus, isLocked, onUpdateCard, onClose,
}) => {
  const [original] = useState({
    title: card.title,
    description: card.description || '',
    category: card.category,
    rationale: card.rationale || '',
    decisionStatus: card.decisionStatus || 'REVIEW',
    decisionReason: card.decisionReason || '',
  });
  const [draft, setDraft] = useState({ ...original, decisionStatus: initialDecisionStatus || original.decisionStatus });
  const titleRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const disabled = isLocked || !currentCard;
  const length = (text: string) => Array.from(text.trim()).length;
  const reasonRequired = draft.decisionStatus === 'ACCEPTED' || draft.decisionStatus === 'DEFERRED';
  const errors = {
    title: !draft.title.trim() ? '제목을 입력하세요.' : length(draft.title) > 120 ? '제목은 120자 이하로 입력하세요.' : '',
    description: length(draft.description) > 5000 ? '설명은 5,000자 이하로 입력하세요.' : '',
    rationale: length(draft.rationale) > 5000 ? '제안 배경은 5,000자 이하로 입력하세요.' : '',
    decisionReason: reasonRequired && !draft.decisionReason.trim() ? '채택·보류에는 결정 사유가 필요합니다.'
      : length(draft.decisionReason) > 5000 ? '결정 사유는 5,000자 이하로 입력하세요.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50';

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialDecisionStatus ? reasonRef.current : titleRef.current)?.focus();
    return () => previous?.focus();
  }, []);

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || invalid) return;
    const changes: Partial<IdeaCard> = {};
    // [아이디어 보드] 편집하지 않은 필드는 전송하지 않아 열린 동안 받은 팀원 변경을 보존한다.
    for (const field of ['title', 'description', 'rationale', 'decisionReason'] as const) {
      if (draft[field] !== original[field]) changes[field] = draft[field].trim();
    }
    if (draft.decisionStatus !== original.decisionStatus) changes.decisionStatus = draft.decisionStatus;
    if (!currentCard.parentIdeaId && draft.category !== original.category) changes.category = draft.category;
    if (Object.keys(changes).length) onUpdateCard(card.id, changes);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="idea-edit-heading" onKeyDown={handleKeyDown}
        className="flex max-h-full sm:max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 p-4">
          <h2 id="idea-edit-heading" className="flex items-center gap-2 text-sm font-bold"><Edit3 className="h-4 w-4 text-indigo-400" />아이디어 수정</h2>
          <button type="button" aria-label="수정 닫기" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleApply} noValidate className="flex min-h-0 flex-col">
          <fieldset disabled={disabled} className="min-h-0 space-y-3 overflow-y-auto p-4 sm:p-5">
            {!currentCard && <p role="alert" className="text-xs text-rose-300">아이디어가 삭제되었습니다. 입력 내용을 복사한 뒤 닫아 주세요.</p>}
            {isLocked && <p role="alert" className="text-xs text-amber-300">현재 아이디어를 수정할 수 없습니다.</p>}
            <div className="space-y-1">
              <label htmlFor="idea-title" className="text-xs font-semibold">제목 (필수)</label>
              <input ref={titleRef} id="idea-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-invalid={!!errors.title} aria-describedby="idea-title-error" className={inputClass} />
              <p id="idea-title-error" className="text-[11px] text-rose-300">{errors.title}</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="idea-description" className="text-xs font-semibold">설명</label>
              <textarea id="idea-description" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                aria-invalid={!!errors.description} aria-describedby="idea-description-error" className={inputClass} />
              <p id="idea-description-error" className="text-[11px] text-rose-300">{errors.description}</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="idea-category" className="text-xs font-semibold">분류</label>
              <select id="idea-category" disabled={!!currentCard?.parentIdeaId} value={currentCard?.parentIdeaId ? currentCard.category : draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as IdeaCategory })} className={inputClass}>
                {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((category) => <option key={category} value={category}>{CATEGORY_META[category].label}</option>)}
              </select>
              <p className="text-[11px] text-slate-400">{currentCard?.parentIdeaId ? '파생 아이디어의 분류는 부모 아이디어에서 변경합니다.' : '분류를 변경하면 하위 아이디어도 함께 이동합니다.'}</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="idea-rationale" className="text-xs font-semibold text-amber-400">제안 배경</label>
              <textarea id="idea-rationale" rows={2} value={draft.rationale} onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
                aria-invalid={!!errors.rationale} aria-describedby="idea-rationale-error" className={inputClass} />
              <p id="idea-rationale-error" className="text-[11px] text-rose-300">{errors.rationale}</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="idea-status" className="text-xs font-semibold">결정 상태</label>
              <select id="idea-status" value={draft.decisionStatus} onChange={(e) => setDraft({ ...draft, decisionStatus: e.target.value as DecisionStatus })} className={inputClass}>
                {(Object.keys(STATUS_META) as DecisionStatus[]).map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="idea-reason" className="text-xs font-semibold text-emerald-400">결정 사유{reasonRequired ? ' (필수)' : ''}</label>
              <textarea ref={reasonRef} id="idea-reason" rows={2} value={draft.decisionReason} onChange={(e) => setDraft({ ...draft, decisionReason: e.target.value })}
                aria-required={reasonRequired} aria-invalid={!!errors.decisionReason} aria-describedby="idea-reason-error" className={inputClass} />
              <p id="idea-reason-error" className="text-[11px] text-rose-300">{errors.decisionReason}</p>
              <p className="text-[11px] text-slate-400">결정 상태나 사유를 바꾸면 로그인한 본인으로 기록됩니다.</p>
            </div>
          </fieldset>
          <div className="shrink-0 space-y-2 border-t border-slate-800 p-4">
            <p className="text-[11px] text-slate-400">적용 후 자동 저장됩니다. 상단의 저장 완료 표시를 확인하세요.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">취소</button>
              <button type="submit" disabled={disabled || invalid} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40"><Check className="h-3.5 w-3.5" />적용</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

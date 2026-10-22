import React, { useEffect, useRef, useState } from 'react';
import type { FeatureSpec, IdeaCard } from '../../types/index.ts';
import { ideaSubtreeIds } from '../../utils/ideaTree.ts';
import { voteCount } from '../../utils/votes.ts';

interface DeleteIdeaModalProps {
  id: string;
  cards: IdeaCard[];
  features: FeatureSpec[];
  isLocked: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// [아이디어 보드] 팀원이 삭제 영향을 바꾸면 다시 확인하며 기본 선택은 취소다.
export const DeleteIdeaModal: React.FC<DeleteIdeaModalProps> = ({ id, cards, features, isLocked, onConfirm, onClose }) => {
  const ids = ideaSubtreeIds(cards, id);
  const affected = cards.filter((card) => ids.has(card.id));
  const linked = features.filter((feature) => feature.relatedStoryId && ids.has(feature.relatedStoryId));
  const signature = JSON.stringify([affected.map((card) => [card.id, card.comments, card.voterIds, card.votes, card.parentIdeaId]), linked.map((feature) => feature.id)]);
  const [reviewed, setReviewed] = useState(signature);
  const cancel = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancel.current?.focus();
    return () => previous?.focus();
  }, []);
  const disabled = isLocked || !cards.some((card) => card.id === id) || reviewed !== signature;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="idea-delete-title"
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key !== 'Tab') return;
          const controls = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          if (!controls?.length) return;
          const first = controls[0]; const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <h2 id="idea-delete-title" className="font-bold">아이디어 삭제 영향 확인</h2>
        <p className="break-words text-sm">{cards.find((card) => card.id === id)?.title ?? '삭제된 아이디어'}</p>
        <p className="text-sm">아이디어 {affected.length}개(하위 {Math.max(0, affected.length - 1)}개), 댓글 {affected.reduce((sum, card) => sum + card.comments.length, 0)}개, 투표 {affected.reduce((sum, card) => sum + voteCount(card), 0)}개가 삭제됩니다.</p>
        <p className="text-sm">연결 기능 {linked.length}개의 원본 아이디어 참조를 해제합니다. 기능 자체는 유지됩니다.</p>
        {reviewed !== signature && <div role="alert" className="text-sm text-amber-300">팀원이 삭제 영향 대상을 변경했습니다. <button type="button" onClick={() => setReviewed(signature)} className="underline">최신 영향 다시 확인</button></div>}
        <div className="flex justify-end gap-3">
          <button ref={cancel} type="button" onClick={onClose} className="rounded px-3 py-2 text-sm">취소</button>
          <button type="button" disabled={disabled} onClick={onConfirm} className="rounded bg-rose-700 px-3 py-2 text-sm disabled:opacity-40">하위 포함 삭제</button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Award, CornerDownLeft, HelpCircle as QuestionIcon, Plus } from 'lucide-react';
import type { DecisionStatus, IdeaCard, IdeaCategory } from '../../types/index.ts';
import { CATEGORY_META } from './ideaConfig.ts';

interface NewIdeaFormProps {
  category: IdeaCategory;
  parentId: string | null;
  parent?: IdeaCard;
  onChangeCategory: (category: IdeaCategory) => void;
  onCancelParent: () => void;
  isLocked: boolean;
  onAddCard: (card: Omit<IdeaCard, 'id' | 'votes' | 'votedBy' | 'comments'>) => boolean;
  onCreated: () => void;
}

const emptyDraft = { title: '', description: '', rationale: '', decisionReason: '', decisionStatus: 'REVIEW' as DecisionStatus };

export const NewIdeaForm: React.FC<NewIdeaFormProps> = ({ category, parentId, parent, onChangeCategory, onCancelParent, isLocked, onAddCard, onCreated }) => {
  // [아이디어 보드] 분류·부모별 임시 입력을 유지해 탭이나 등록 대상을 바꿔도 잃지 않는다.
  const [drafts, setDrafts] = useState<Record<string, typeof emptyDraft>>({});
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (parentId) titleInput.current?.focus(); }, [parentId]);
  const draftKey = parentId ? `parent:${parentId}` : `root:${category}`;
  const draft = drafts[draftKey] ?? emptyDraft;
  const setField = <K extends keyof typeof emptyDraft>(field: K, value: typeof emptyDraft[K]) =>
    setDrafts((previous) => ({ ...previous, [draftKey]: { ...(previous[draftKey] ?? emptyDraft), [field]: value } }));
  const selectedCategory = parent?.category ?? category;
  const setSelectedCategory = onChangeCategory;
  const { title: newTitle, description: newDescription, rationale: newRationale, decisionReason: newDecisionReason, decisionStatus: newDecisionStatus } = draft;
  const setNewTitle = (value: string) => setField('title', value);
  const setNewDescription = (value: string) => setField('description', value);
  const setNewRationale = (value: string) => setField('rationale', value);
  const setNewDecisionReason = (value: string) => setField('decisionReason', value);
  const setNewDecisionStatus = (value: DecisionStatus) => setField('decisionStatus', value);
  const disabled = isLocked || (!!parentId && !parent);
  const reasonMissing = (newDecisionStatus === 'ACCEPTED' || newDecisionStatus === 'DEFERRED') && !newDecisionReason.trim();
  const tooLong = Array.from(newTitle.trim()).length > 120 || [newDescription, newRationale, newDecisionReason].some((value) => Array.from(value.trim()).length > 5000);

  const handleCreateCard = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || !newTitle.trim() || reasonMissing || tooLong) return;
    if (!onAddCard({
      parentIdeaId: parentId, category: selectedCategory,
      title: newTitle.trim(), description: newDescription.trim(), author: '',
      rationale: newRationale.trim() || undefined,
      decisionStatus: newDecisionStatus, decisionReason: newDecisionReason.trim() || undefined,
    })) return;
    setDrafts((previous) => ({ ...previous, [draftKey]: { ...emptyDraft } }));
    onCreated();
  };

  return (
    <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/40 shrink-0 overflow-y-auto max-h-[340px]">
      <form onSubmit={handleCreateCard} className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">{parentId ? '파생 아이디어 등록' : '신규 아이디어 & 의사결정 근거 기록'}</span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> 빠른 등록
          </span>
        </div>

        {parentId && <div className="rounded border border-indigo-800 p-2 text-xs text-indigo-200">
          <p>부모: {parent?.title ?? '삭제된 아이디어'}</p>
          <p>분류: {CATEGORY_META[selectedCategory].label} (부모 상속)</p>
          {!parent && <p role="alert">부모가 삭제되었습니다. 입력을 복사하거나 루트 등록으로 전환하세요.</p>}
          <button type="button" onClick={onCancelParent} className="mt-1 underline">루트 등록으로 전환</button>
        </div>}
        {reasonMissing && <p role="alert" className="text-xs text-rose-300">채택·보류에는 결정 사유가 필요합니다.</p>}
        {tooLong && <p role="alert" className="text-xs text-rose-300">제목은 120자, 설명·배경·사유는 5,000자 이하로 입력하세요.</p>}
        {/* [아이디어 보드] 분류 선택 */}
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                disabled={disabled || !!parentId}
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

        {/* [아이디어 보드] 제목과 설명 */}
        <div className="space-y-1.5">
          <input
            type="text"
            ref={titleInput}
            disabled={disabled}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            aria-label="새 아이디어 제목" placeholder="아이디어 핵심 제목 (필수)..."
            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <textarea
            rows={2}
            disabled={disabled}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            aria-label="새 아이디어 설명" placeholder="상세 내용 요약..."
            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
          />
        </div>

        {/* [아이디어 보드] 이유(근거) */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
            <QuestionIcon className="w-3 h-3" />
            <span>왜 그런 아이디어를 냈는가? (제안 배경 &amp; 문제 가설 Why)</span>
          </label>
          <textarea
            rows={2}
            disabled={disabled}
            value={newRationale}
            onChange={(e) => setNewRationale(e.target.value)}
            placeholder="예: 기존 스터디 40% 이상이 노쇼로 중도 해체되는 반복 문제 해결을 위해..."
            className="w-full bg-slate-950 border border-amber-900/50 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        {/* [아이디어 보드] 결정 상태와 사유 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <Award className="w-3 h-3" />
              <span>결정 상태 (Status)</span>
            </label>
            <select
              disabled={disabled}
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
            {/* [아이디어 보드] 서버는 로그인한 본인만 작성자·결정자로 기록한다(계약 v2). */}
            <p className="mt-1 px-2 py-1 text-xs text-slate-400">로그인한 본인으로 기록됩니다</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-emerald-400">
            왜 그 아이디어로 결정/채택했는가? (최종 결정 사유 &amp; 근거)
          </label>
          <input
            type="text"
            disabled={disabled}
            value={newDecisionReason}
            onChange={(e) => setNewDecisionReason(e.target.value)}
            placeholder="예: 팀원 만장일치 5표 획득 및 MVP 4주 내 구축 가능성 검증 완료"
            className="w-full bg-slate-950 border border-emerald-900/50 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 mt-1"
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={disabled || !newTitle.trim() || reasonMissing || tooLong}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>아이디어 등록</span>
          </button>
        </div>
      </form>
    </div>
  );
};

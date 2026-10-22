import React, { useState } from 'react';
import { LayoutGrid, LayoutList } from 'lucide-react';
import type { DecisionStatus, FeatureSpec, IdeaCard, IdeaCategory, TeamMember } from '../types/index.ts';
import { IdeaSidebarHeader } from './step1/IdeaSidebarHeader.tsx';
import { NewIdeaForm } from './step1/NewIdeaForm.tsx';
import { IdeaCardList } from './step1/IdeaCardList.tsx';
import { DecisionCanvas } from './step1/DecisionCanvas.tsx';
import { EditDecisionModal } from './step1/EditDecisionModal.tsx';
import { DeleteIdeaModal } from './step1/DeleteIdeaModal.tsx';
import { CATEGORY_META } from './step1/ideaConfig.ts';
import { toggleIdeaExpansion, visibleIdeaCards } from '../utils/ideaTree.ts';

interface Step1IdeaBoardProps {
  projectSummary: string;
  onUpdateSummary: (summary: string) => void;
  cards: IdeaCard[];
  features: FeatureSpec[];
  onAddCard: (card: Omit<IdeaCard, 'id' | 'votes' | 'votedBy' | 'comments'>) => boolean;
  onUpdateCard: (id: string, updated: Partial<IdeaCard>) => void;
  onDeleteCard: (id: string) => void;
  onVoteCard: (cardId: string, memberName: string) => void;
  onAddComment: (cardId: string, author: string, text: string) => void;
  teamMembers: TeamMember[];
  isLocked: boolean;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  onResetResize?: () => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
}

export const Step1IdeaBoard: React.FC<Step1IdeaBoardProps> = ({
  projectSummary,
  onUpdateSummary,
  cards,
  features,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onVoteCard,
  onAddComment,
  teamMembers,
  isLocked,
  sidebarWidth,
  onStartResize,
  onResetResize,
  mobileTab,
  onChangeMobileTab,
  isDesktop = true,
}) => {
  // [아이디어 보드] 근거·결정 수정 모달
  const [editingCard, setEditingCard] = useState<{ card: IdeaCard; decisionStatus?: DecisionStatus } | null>(null);
  const openEdit = (card: IdeaCard, decisionStatus?: DecisionStatus) => setEditingCard({ card, decisionStatus });
  // [아이디어 보드] 문서 payload와 분리한 개인 보기이며 프로젝트가 바뀌면 App의 key로 초기화한다.
  const [category, setCategory] = useState<IdeaCategory>('problems_goals');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [parentId, setParentId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded((previous) => toggleIdeaExpansion(cards, previous, id));
  const chooseCategory = (next: IdeaCategory) => { setCategory(next); setParentId(null); };
  const addDerived = (card: IdeaCard) => {
    setCategory(card.category);
    setParentId(card.id);
    onChangeMobileTab('editor');
  };
  const visibleCards = visibleIdeaCards(cards, category, expanded);

  const acceptedCount = cards.filter(c => c.decisionStatus === 'ACCEPTED').length;
  const reviewCount = cards.filter(c => (c.decisionStatus || 'REVIEW') === 'REVIEW').length;
  const deferredCount = cards.filter(c => c.decisionStatus === 'DEFERRED').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <div role="tablist" aria-label="아이디어 카테고리" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 p-2">
        {(Object.keys(CATEGORY_META) as IdeaCategory[]).map((key, index, keys) => (
          <button key={key} id={`idea-tab-${key}`} role="tab" type="button" aria-selected={category === key}
            tabIndex={category === key ? 0 : -1} onKeyDown={(event) => {
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1
                : event.key === 'ArrowRight' ? (index + 1) % keys.length : event.key === 'ArrowLeft' ? (index + keys.length - 1) % keys.length : -1;
              if (next < 0) return;
              event.preventDefault();
              chooseCategory(keys[next]);
              (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
            }}
            aria-controls="idea-category-panel" onClick={() => chooseCategory(key)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs ${category === key ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
            {CATEGORY_META[key].label} ({cards.filter((card) => card.category === key).length})
          </button>
        ))}
      </div>
      {/* [아이디어 보드] 모바일·태블릿 화면 전환 */}
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

      <div id="idea-category-panel" role="tabpanel" aria-labelledby={`idea-tab-${category}`} className="min-h-0 flex-1 flex overflow-hidden">
        {/* [아이디어 보드] 왼쪽 패널: 근거와 결정 기록이 있는 크기 조절 편집기 */}
        <div
          style={isDesktop ? { width: `${sidebarWidth}%` } : undefined}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            isDesktop ? 'flex' : (mobileTab === 'editor' ? 'w-full flex' : 'hidden')
          }`}
        >
          <IdeaSidebarHeader
            projectSummary={projectSummary}
            onUpdateSummary={onUpdateSummary}
            isLocked={isLocked}
            acceptedCount={acceptedCount}
            reviewCount={reviewCount}
            deferredCount={deferredCount}
          />

          {/* [아이디어 보드] 이유와 결정을 함께 적는 빠른 카드 입력 */}
          <NewIdeaForm category={category} parentId={parentId} parent={cards.find((card) => card.id === parentId)}
            onChangeCategory={chooseCategory} onCancelParent={() => setParentId(null)} isLocked={isLocked} onAddCard={onAddCard}
            onCreated={() => {
              if (parentId) {
                const parent = cards.find((card) => card.id === parentId);
                if (parent) setCategory(parent.category);
                setExpanded((previous) => new Set(previous).add(parentId));
              }
              if (!isDesktop) onChangeMobileTab('canvas');
            }} />

          {/* [아이디어 보드] 필터 바와 카드 목록 */}
          <IdeaCardList cards={visibleCards} expanded={expanded} onToggle={toggle} onAddDerived={addDerived}
            teamMembers={teamMembers} isLocked={isLocked} onOpenEdit={openEdit} onDeleteCard={setDeletingId} />
        </div>

        {/* [아이디어 보드] 왼쪽·오른쪽 패널 크기 조절 구분선 */}
        <div
          onMouseDown={onStartResize}
          onDoubleClick={onResetResize}
          className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
          title="드래그하여 사이드바 너비 조절 (더블클릭 시 40% 리셋)"
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* [아이디어 보드] 오른쪽 패널: 분류별 캔버스 */}
        <div
          className={`flex-col h-full bg-slate-950/60 overflow-hidden ${
            isDesktop ? 'flex-1 min-w-0 flex' : (mobileTab === 'canvas' ? 'w-full flex' : 'hidden')
          }`}
        >
          <DecisionCanvas
            cards={cards.filter((card) => card.category === category)}
            expanded={expanded}
            onToggle={toggle}
            onAddDerived={addDerived}
            teamMembers={teamMembers}
            onVoteCard={onVoteCard}
            onUpdateCard={onUpdateCard}
            onAddComment={onAddComment}
            onOpenEdit={openEdit}
            isLocked={isLocked}
          />
        </div>
      </div>

      {deletingId && <DeleteIdeaModal id={deletingId} cards={cards} features={features} isLocked={isLocked}
        onClose={() => setDeletingId(null)} onConfirm={() => { onDeleteCard(deletingId); setDeletingId(null); }} />}

      {/* [아이디어 보드] 이유·결정 수정 전용 모달 */}
      {editingCard && (
        <EditDecisionModal
          key={editingCard.card.id}
          card={editingCard.card}
          currentCard={cards.find((card) => card.id === editingCard.card.id)}
          initialDecisionStatus={editingCard.decisionStatus}
          isLocked={isLocked}
          onUpdateCard={onUpdateCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
};

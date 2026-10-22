import React, { useLayoutEffect, useRef, useState } from 'react';
import type { IdeaCard } from '../../types/index.ts';
import { indexIdeaTree } from '../../utils/ideaTree.ts';

interface IdeaTreeProps {
  cards: IdeaCard[];
  expanded: ReadonlySet<string>;
  renderCard: (card: IdeaCard, childCount: number) => React.ReactNode;
}

// [아이디어 보드] 카드 높이는 내용에 맡기고 실제 배치 좌표로 SVG 연결선을 그린다.
export const IdeaTree: React.FC<IdeaTreeProps> = ({ cards, expanded, renderCard }) => {
  const surface = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ id: string; path: string }[]>([]);
  const children = indexIdeaTree(cards);
  const roots = children.get(null) ?? [];

  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const nodes = new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-idea-node]'))
        .map((node) => [node.dataset.ideaNode!, node.getBoundingClientRect()]));
      const next = cards.flatMap((card) => {
        const parent = card.parentIdeaId && nodes.get(card.parentIdeaId);
        const child = nodes.get(card.id);
        if (!parent || !child) return [];
        const x1 = parent.right - origin.left;
        const y1 = parent.top + parent.height / 2 - origin.top;
        const x2 = child.left - origin.left;
        const y2 = child.top + child.height / 2 - origin.top;
        const middle = (x1 + x2) / 2;
        return [{ id: card.id, path: `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}` }];
      });
      setLines((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[data-idea-node]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [cards, expanded]);

  const branch = (card: IdeaCard, ancestors: ReadonlySet<string>): React.ReactNode => {
    if (ancestors.has(card.id)) return null;
    const next = new Set(ancestors).add(card.id);
    const descendants = children.get(card.id) ?? [];
    return (
      <div key={card.id} className="flex items-center gap-14">
        <div data-idea-node={card.id} className="w-72 shrink-0">{renderCard(card, descendants.length)}</div>
        {expanded.has(card.id) && descendants.length > 0 && (
          <div className="flex shrink-0 flex-col gap-6">{descendants.map((child) => branch(child, next))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4" role="region" aria-label="아이디어 가로 트리">
      {roots.length === 0 ? <p className="p-8 text-xs text-slate-500">이 분류에 루트 아이디어를 등록하세요.</p> : (
        <div ref={surface} className="relative flex w-max min-w-full flex-col gap-8">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {lines.map((line) => <path key={line.id} data-idea-edge={line.id} d={line.path} fill="none" stroke="#818cf8" strokeWidth="2" />)}
          </svg>
          <div className="relative flex w-max flex-col gap-8">{roots.map((root) => branch(root, new Set()))}</div>
        </div>
      )}
    </div>
  );
};

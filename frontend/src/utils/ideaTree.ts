import type { IdeaCard, IdeaCategory, FeatureSpec } from '../types/index.ts';

/** [아이디어 보드] 저장 배열은 그대로 두고 부모별 형제 순서만 화면에 적용한다. */
export const indexIdeaTree = (ideas: IdeaCard[], category?: IdeaCategory) => {
  const children = new Map<string | null, IdeaCard[]>();
  const positions = new Map(ideas.map((idea, index) => [idea.id, index]));
  for (const idea of ideas) {
    if (category && idea.category !== category) continue;
    const parent = idea.parentIdeaId ?? null;
    const siblings = children.get(parent) ?? [];
    siblings.push(idea);
    children.set(parent, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => (a.siblingOrder ?? positions.get(a.id)!) - (b.siblingOrder ?? positions.get(b.id)!));
  }
  return children;
};

/** [아이디어 보드] 접기 대상의 모든 자손을 구해 다시 펼칠 때도 직접 자식부터 시작한다. */
export const ideaSubtreeIds = (ideas: IdeaCard[], id: string): Set<string> => {
  const children = indexIdeaTree(ideas);
  const found = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const current = pending.pop()!;
    if (found.has(current)) continue;
    found.add(current);
    for (const child of children.get(current) ?? []) pending.push(child.id);
  }
  return found;
};

export const toggleIdeaExpansion = (ideas: IdeaCard[], expanded: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(expanded);
  if (next.has(id)) for (const childId of ideaSubtreeIds(ideas, id)) next.delete(childId);
  else next.add(id);
  return next;
};

export const visibleIdeaCards = (ideas: IdeaCard[], category: IdeaCategory, expanded: ReadonlySet<string>): IdeaCard[] => {
  const children = indexIdeaTree(ideas, category);
  const pending = [...(children.get(null) ?? [])].reverse();
  const visible: IdeaCard[] = [];
  const visited = new Set<string>();
  while (pending.length) {
    const card = pending.pop()!;
    if (visited.has(card.id)) continue;
    visited.add(card.id);
    visible.push(card);
    if (expanded.has(card.id)) pending.push(...[...(children.get(card.id) ?? [])].reverse());
  }
  return visible;
};

/** [아이디어 보드] 오래 열린 등록 폼도 최신 부모 분류와 형제 순서를 사용한다. */
export const ideaPlacement = (ideas: IdeaCard[], parentId: string | null, category: IdeaCategory) => {
  const parent = parentId ? ideas.find((idea) => idea.id === parentId) : undefined;
  if (parentId && !parent) return null;
  const orders = ideas.flatMap((idea, index) => (idea.parentIdeaId ?? null) === parentId ? [idea.siblingOrder ?? index] : []);
  const order = Math.max(-1, ...orders) + 1;
  if (order > 1_000_000) return null;
  return { parentIdeaId: parentId, category: parent?.category ?? category, siblingOrder: order };
};

/** [아이디어 보드] 삭제는 하위 트리와 끊어진 기능 참조를 하나의 문서 변경으로 만든다. */
export const removeIdeaSubtree = (ideas: IdeaCard[], features: FeatureSpec[], id: string) => {
  const removed = ideaSubtreeIds(ideas, id);
  return {
    ideas: ideas.filter((idea) => !removed.has(idea.id)),
    features: features.map((feature) => feature.relatedStoryId && removed.has(feature.relatedStoryId)
      ? { ...feature, relatedStoryId: '' } : feature),
  };
};

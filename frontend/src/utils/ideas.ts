import type { IdeaCard } from '../types/index.ts';

/** [아이디어 보드] 분류는 루트에서만 바꾸고 하위 트리를 같은 문서 갱신에 포함한다. */
export const updateIdea = (ideas: IdeaCard[], id: string, changes: Partial<IdeaCard>): IdeaCard[] => {
  const card = ideas.find((idea) => idea.id === id);
  if (!card) return ideas;
  const { category, ...rest } = changes;
  const nextCategory = card.parentIdeaId ? undefined : category;
  const affected = new Set([id]);
  if (nextCategory !== undefined && nextCategory !== card.category) {
    const pending = [id];
    while (pending.length) {
      const parent = pending.pop();
      for (const idea of ideas) {
        if (idea.parentIdeaId === parent && !affected.has(idea.id)) {
          affected.add(idea.id);
          pending.push(idea.id);
        }
      }
    }
  }
  return ideas.map((idea) => {
    if (!affected.has(idea.id)) return idea;
    return { ...idea, ...(idea.id === id ? rest : {}), ...(nextCategory !== undefined ? { category: nextCategory } : {}) };
  });
};

import type { IdeaCard, ProjectData } from '../types/index.ts';

/** [아이디어 보드] 숨겨진 하위 카드도 삭제 영향에 포함하고 순환 데이터에서도 종료한다. */
export const ideaBranchIds = (ideas: IdeaCard[], id: string): Set<string> => {
  const ids = new Set<string>();
  if (!ideas.some((idea) => idea.id === id)) return ids;
  ids.add(id);
  let previous = 0;
  while (previous !== ids.size) {
    previous = ids.size;
    for (const idea of ideas) if (idea.parentIdeaId && ids.has(idea.parentIdeaId)) ids.add(idea.id);
  }
  return ids;
};

/** [아이디어 보드] 기능 자체와 ERD 연결은 유지하고 삭제한 아이디어를 가리키는 출처만 해제한다. */
export const deleteIdeaBranch = (project: ProjectData, id: string): Pick<ProjectData, 'ideas' | 'features'> => {
  const ids = ideaBranchIds(project.ideas, id);
  return {
    ideas: project.ideas.filter((idea) => !ids.has(idea.id)),
    features: project.features.map((feature) => feature.relatedStoryId && ids.has(feature.relatedStoryId)
      ? { ...feature, relatedStoryId: undefined } : feature),
  };
};

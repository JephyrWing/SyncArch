import type { FeatureSpec, IdeaCard } from '../types/index.ts';

export const featureFromIdea = (idea: IdeaCard, id: string, displayCode?: string): FeatureSpec => ({
  id, displayCode, domain: idea.category === 'problems_goals' ? '정책' : idea.category === 'actors' ? '인증' : '비즈니스',
  name: idea.title, priority: 'P0', assignee: idea.author ?? '', method: 'POST',
  endpoint: `/api/v1/core/${idea.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
  requestFields: 'payload: object, userId: UUID', responseFields: 'status: "SUCCESS"',
  summary: idea.description ?? '', status: 'PLANNED', relatedStoryId: idea.id,
});

// [기능 명세] 서버 계약 v2: 새 항목 id는 UUID다. 화면에 보이는 FEAT-01은 displayCode에 둔다(예전 기능은 id가 FEAT-01이다).
export const featureCode = (feature: Pick<FeatureSpec, 'id' | 'displayCode'>): string => feature.displayCode ?? feature.id;

/** [기능 명세] 테이블이 가리키는 기능 id를 화면용 코드로 바꾼다. 지워진 기능이면 id를 그대로 보여 준다. */
export const featureCodeOf = (features: FeatureSpec[], id: string): string => {
  const feature = features.find((f) => f.id === id);
  return feature ? featureCode(feature) : id;
};

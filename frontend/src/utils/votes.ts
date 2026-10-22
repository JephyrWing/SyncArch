import type { IdeaCard } from '../types/index.ts';

// [아이디어 보드] 서버 계약 v2: 예전 표(votes·votedBy)는 고정 기록이고, 새 투표는 사용자 ID 목록(voterIds)에만 쌓인다.
// voterIds는 merge3가 값 목록으로 합치므로 동시에 투표해도 표가 사라지지 않는다.
export const voteCount = (card: Pick<IdeaCard, 'votes' | 'voterIds'>): number => (card.votes ?? 0) + (card.voterIds?.length ?? 0);

import test from 'node:test';
import assert from 'node:assert/strict';
import type { FeatureSpec, IdeaCard } from '../types/index.ts';
import { ideaPlacement, ideaSubtreeIds, indexIdeaTree, removeIdeaSubtree, toggleIdeaExpansion, visibleIdeaCards } from './ideaTree.ts';

const card = (id: string, parentIdeaId: string | null = null, siblingOrder?: number): IdeaCard => ({
  id, parentIdeaId, siblingOrder, title: id, category: 'problems_goals', description: '', author: 'A', votes: 0, votedBy: [], comments: [],
});

test('TC-IDEA-04/05: 기본 루트와 직접 자식만 순서대로 보이고 펼침은 데이터를 바꾸지 않는다', () => {
  const ideas = [card('root'), card('late', 'root', 9), card('grandchild', 'early'), card('early', 'root', 2), { ...card('actor'), category: 'actors' as const }];
  const before = structuredClone(ideas);
  assert.deepEqual(visibleIdeaCards(ideas, 'problems_goals', new Set()).map((c) => c.id), ['root']);
  const expanded = toggleIdeaExpansion(ideas, new Set(), 'root');
  assert.deepEqual(visibleIdeaCards(ideas, 'problems_goals', expanded).map((c) => c.id), ['root', 'early', 'late']);
  const deeper = toggleIdeaExpansion(ideas, expanded, 'early');
  assert.deepEqual(visibleIdeaCards(ideas, 'problems_goals', deeper).map((c) => c.id), ['root', 'early', 'grandchild', 'late']);
  const collapsed = toggleIdeaExpansion(ideas, deeper, 'root');
  assert.deepEqual([...collapsed], []);
  assert.deepEqual([...deeper], ['root', 'early']);
  assert.deepEqual(ideas, before);
});

test('TC-IDEA-04: 과거 배열 순서와 동률 형제 순서를 안정적으로 보존한다', () => {
  const ideas = [card('r'), card('b', 'r', 1), card('a', 'r', 1), card('legacy', 'r')];
  assert.deepEqual(indexIdeaTree(ideas).get('r')!.map((c) => c.id), ['b', 'a', 'legacy']);
  assert.deepEqual(ideaPlacement(ideas, 'r', 'actors'), { parentIdeaId: 'r', category: 'problems_goals', siblingOrder: 4 });
  assert.equal(ideaPlacement(ideas, 'removed', 'actors'), null);
  assert.equal(ideaPlacement([card('r'), card('max', 'r', 1_000_000)], 'r', 'actors'), null);
});

test('TC-IDEA-04/SAFE-01: 삭제는 모든 깊이와 기능 참조를 함께 정리하고 다른 트리를 보존한다', () => {
  const ideas = [card('r'), card('c', 'r'), card('g', 'c'), card('other')];
  const features = [{ id: 'linked', relatedStoryId: 'g' }, { id: 'keep', relatedStoryId: 'other' }] as FeatureSpec[];
  const before = structuredClone({ ideas, features });
  const removed = removeIdeaSubtree(ideas, features, 'r');
  assert.deepEqual(removed.ideas.map((c) => c.id), ['other']);
  assert.equal(removed.features[0].id, 'linked');
  assert.equal(removed.features[0].relatedStoryId, '');
  assert.equal(removed.features[1], features[1]);
  assert.deepEqual({ ideas, features }, before);
});

test('TC-IDEA-04: 깊은 트리와 손상된 순환 입력에서도 자손 탐색이 종료된다', () => {
  const ideas = Array.from({ length: 1500 }, (_, i) => card(String(i), i ? String(i - 1) : null));
  assert.equal(ideaSubtreeIds(ideas, '0').size, 1500);
  assert.equal(visibleIdeaCards(ideas, 'problems_goals', new Set(ideas.map((c) => c.id))).length, 1500);
  assert.equal(ideaSubtreeIds([card('a', 'b'), card('b', 'a')], 'a').size, 2);
});

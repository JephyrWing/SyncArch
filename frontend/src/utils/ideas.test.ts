import test from 'node:test';
import assert from 'node:assert/strict';
import type { IdeaCard } from '../types/index.ts';
import { updateIdea } from './ideas.ts';

const idea = (id: string, parentIdeaId: string | null = null): IdeaCard => ({
  id, parentIdeaId, category: 'problems_goals', title: id, description: '', author: '기존 작성자',
  authorId: 'author', votes: 2, votedBy: ['이전 투표자'], voterIds: ['voter'],
  comments: [{ id: 'comment', author: '댓글 작성자', text: '기록', createdAt: '2026-10-22T00:00:00Z' }],
});

test('TC-IDEA-02: 루트 분류 변경은 모든 자손을 포함하고 다른 트리와 기록을 보존한다', () => {
  const source = [idea('root'), idea('child', 'root'), idea('grandchild', 'child'), idea('other')];
  const before = structuredClone(source);
  const result = updateIdea(source, 'root', { title: '새 제목', category: 'actors' });
  assert.deepEqual(result.slice(0, 3).map((card) => card.category), ['actors', 'actors', 'actors']);
  assert.equal(result[0].title, '새 제목');
  assert.equal(result[1].title, 'child');
  assert.equal(result[3], source[3]);
  assert.deepEqual(result[0], { ...source[0], title: '새 제목', category: 'actors' });
  assert.deepEqual(source, before);
});

test('TC-IDEA-02: 자식은 부모 분류를 유지하면서 내용만 편집한다', () => {
  const source = [idea('root'), idea('child', 'root'), idea('grandchild', 'child')];
  const result = updateIdea(source, 'child', { description: '변경', category: 'constraints' });
  assert.deepEqual(result.map((card) => card.category), source.map((card) => card.category));
  assert.equal(result[1].description, '변경');
  assert.equal(result[2], source[2]);
});

test('TC-IDEA-01: 삭제된 카드의 늦은 편집은 카드를 복원하지 않는다', () => {
  const source = [idea('other')];
  assert.equal(updateIdea(source, 'deleted', { title: '복원 시도' }), source);
});

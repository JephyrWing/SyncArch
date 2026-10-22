import test from 'node:test';
import assert from 'node:assert/strict';
import type { IdeaCard } from '../types/index.ts';
import { generateMarkdownSpec } from './markdownGenerator.ts';

test('TC-IDEA-04: 내보내기는 개인 펼침에 의존하지 않고 모든 카드·부모 관계·결정 사유를 포함한다', () => {
  const cards = ['root', 'child', 'grandchild'].map((id, index): IdeaCard => ({
    id, parentIdeaId: index ? ['root', 'child'][index - 1] : null, siblingOrder: index,
    title: `${id} 제목`, category: 'problems_goals', author: 'A', description: '', votes: 0, votedBy: [], comments: [],
    decisionStatus: 'ACCEPTED', decisionReason: `${id} 채택 | 근거\n두 번째 줄`,
  }));
  const markdown = generateMarkdownSpec('트리 문서', '', cards, [], [], [], []);
  for (const card of cards) {
    assert.ok(markdown.includes(card.title));
    assert.ok(markdown.includes(`| ${card.id} | ${card.parentIdeaId ?? '루트'} | ${card.siblingOrder} | ACCEPTED |`));
    assert.ok(markdown.includes(`${card.id} 채택 \\| 근거<br>두 번째 줄`));
  }
});

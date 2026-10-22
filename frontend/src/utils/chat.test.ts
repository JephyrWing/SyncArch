import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPolled, applySent, mergeMessages } from './chat.ts';
import type { ChatMessage } from '../types/index.ts';

const message = (id: string, createdAt: string): ChatMessage => ({ id, userId: 'u', displayName: '앨리스', body: id, createdAt });

test('mergeMessages drops repeats from the inclusive since query and keeps time order', () => {
  const current = [message('a', '2026-10-21T01:00:00.000Z'), message('b', '2026-10-21T01:00:01.000Z')];
  const merged = mergeMessages(current, [message('b', '2026-10-21T01:00:01.000Z'), message('c', '2026-10-21T01:00:00.500Z')]);
  assert.deepEqual(merged.map((m) => m.id), ['a', 'c', 'b']);
  assert.equal(mergeMessages(current, [current[1]]), current, 'no change keeps the same array');
});

test('a message I send does not make the next poll skip a teammate message sent just before it', () => {
  let state = applyPolled({ messages: [] }, [message('initial', '2026-10-21T01:00:00.000Z')]);
  // [채팅] 팀원이 01:00:01에 보냈고(아직 조회 전), 내가 01:00:02에 보냈다.
  state = applySent(state, message('mine', '2026-10-21T01:00:02.000Z'));
  assert.deepEqual(state.cursor, { createdAt: '2026-10-21T01:00:00.000Z', id: 'initial' });
  const server = [message('initial', '2026-10-21T01:00:00.000Z'), message('teammate', '2026-10-21T01:00:01.000Z'), message('mine', '2026-10-21T01:00:02.000Z')];
  state = applyPolled(state, server.filter((m) => m.createdAt > state.cursor!.createdAt));
  assert.deepEqual(state.messages.map((m) => m.id), ['initial', 'teammate', 'mine']);
  assert.deepEqual(state.cursor, { createdAt: '2026-10-21T01:00:02.000Z', id: 'mine' });
});

test('same-time messages keep server (time, id) order and the cursor moves to the last id', () => {
  // [채팅] 서버는 소수 0인 시각을 '...:00Z'로 보낸다. 문자열 비교로는 '...:00.5Z'보다 뒤로 가므로 숫자로 비교해야 한다.
  const state = applyPolled({ messages: [] }, [message('b', '2026-10-21T01:00:00Z'), message('a', '2026-10-21T01:00:00.500000Z')]);
  const merged = mergeMessages(state.messages, [message('a2', '2026-10-21T01:00:00Z')]);
  assert.deepEqual(merged.map((m) => m.id), ['a2', 'b', 'a']);
  assert.deepEqual(state.cursor, { createdAt: '2026-10-21T01:00:00.500000Z', id: 'a' });
  assert.deepEqual(applyPolled(state, []).cursor, state.cursor, 'an empty poll keeps the cursor');
  // [채팅] 같은 밀리초 안의 마이크로초 차이도 서버 순서를 따른다(id 순서와 반대여도).
  const micro = mergeMessages([], [message('a', '2026-10-21T01:00:00.000200Z'), message('z', '2026-10-21T01:00:00.000100Z')]);
  assert.deepEqual(micro.map((m) => m.id), ['z', 'a']);
});

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
  assert.equal(state.cursor, '2026-10-21T01:00:00.000Z');
  const server = [message('initial', '2026-10-21T01:00:00.000Z'), message('teammate', '2026-10-21T01:00:01.000Z'), message('mine', '2026-10-21T01:00:02.000Z')];
  state = applyPolled(state, server.filter((m) => m.createdAt >= state.cursor!));
  assert.deepEqual(state.messages.map((m) => m.id), ['initial', 'teammate', 'mine']);
  assert.equal(state.cursor, '2026-10-21T01:00:02.000Z');
});

test('COL07: cursor includes ID at equal timestamps and sends cannot advance it', () => {
  let state = applyPolled({ messages: [] }, [message('a','2026-01-01'),message('b','2026-01-01')]);
  assert.equal(state.cursorId,'b');
  state=applySent(state,message('z','2026-01-02'));
  assert.equal(state.cursorId,'b');
  state=applyPolled(state,[message('c','2026-01-01')]);
  assert.equal(state.cursorId,'c');
  assert.deepEqual(state.messages.map(m=>m.id),['a','b','c','z']);
});

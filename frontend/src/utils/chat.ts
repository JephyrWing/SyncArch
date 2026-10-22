import type { ChatMessage } from '../types/index.ts';

// [채팅] 서버는 소수 0인 시각을 '…:00Z'로, 나머지는 마이크로초까지 보낸다. 6자리로 맞추면 문자열 비교가 시각 순서가 된다.
const timeKey = (createdAt: string) =>
  createdAt.replace(/(?:\.(\d+))?Z$/, (_, fraction = '') => `.${fraction.padEnd(6, '0')}Z`);

/** [채팅] 서버는 같은 시각 메시지를 다시 보낼 수 있다. id로 거르고 서버와 같은 (시각, id) 순으로 붙인다. */
export const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const known = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => {
    const [ta, tb] = [timeKey(a.createdAt), timeKey(b.createdAt)];
    return ta < tb ? -1 : ta > tb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
};

export interface ChatState {
  messages: ChatMessage[];
  // [채팅] 다음 조회의 since. 조회 결과로만 옮긴다.
  cursor?: string;
  cursorId?: string;
}

/** [채팅] 조회 결과를 합치고 다음 조회 기준을 옮긴다. */
export const applyPolled = (state: ChatState, incoming: ChatMessage[]): ChatState => ({
  messages: mergeMessages(state.messages, incoming),
  cursor: incoming[incoming.length - 1]?.createdAt ?? state.cursor,
  cursorId: incoming[incoming.length - 1]?.id ?? state.cursorId,
});

/** [채팅] 내가 보낸 메시지는 바로 보여 주되 조회 기준은 그대로 둔다. 옮기면 그 사이 팀원 메시지를 건너뛴다. */
export const applySent = (state: ChatState, sent: ChatMessage): ChatState => ({
  messages: mergeMessages(state.messages, [sent]),
  cursor: state.cursor,
  cursorId: state.cursorId,
});

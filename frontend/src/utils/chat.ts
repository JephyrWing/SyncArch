import type { ChatCursor, ChatMessage } from '../types/index.ts';

// [채팅] 서버와 같은 (시각, id) 순서. 시각 문자열은 소수 자릿수가 달라질 수 있어 숫자로 비교한다.
const byTimeThenId = (a: ChatMessage, b: ChatMessage) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** [채팅] 서버는 같은 메시지를 다시 보낼 수 있다. id로 거르고 (시각, id) 순으로 붙인다. */
export const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const known = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort(byTimeThenId);
};

export interface ChatState {
  messages: ChatMessage[];
  // [채팅] 다음 조회 기준. 조회 결과로만 옮긴다.
  cursor?: ChatCursor;
}

/** [채팅] 조회 결과를 합치고 다음 조회 기준을 받은 마지막 메시지로 옮긴다. */
export const applyPolled = (state: ChatState, incoming: ChatMessage[]): ChatState => {
  const last = incoming[incoming.length - 1];
  return {
    messages: mergeMessages(state.messages, incoming),
    cursor: last ? { createdAt: last.createdAt, id: last.id } : state.cursor,
  };
};

/** [채팅] 내가 보낸 메시지는 바로 보여 주되 조회 기준은 그대로 둔다. 옮기면 그 사이 팀원 메시지를 건너뛴다. */
export const applySent = (state: ChatState, sent: ChatMessage): ChatState => ({
  messages: mergeMessages(state.messages, [sent]),
  cursor: state.cursor,
});

import { useEffect, useRef, useState } from 'react';
import { fetchMessages, sendMessage } from '../api/projects.ts';
import { applyPolled, applySent, type ChatState } from '../utils/chat.ts';
import type { ChatMessage } from '../types/index.ts';

// [채팅] 문서 폴링(1초)과 겹치지 않게 조금 느리게 확인한다.
const CHAT_POLL_MS = 1500;

/** [채팅] 프로젝트 대화를 불러오고 새 메시지를 폴링한다. */
export const useChat = (projectId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  // [채팅] 첫 응답 전에는 몇 개가 "지난 대화"인지 모른다. 읽음 표시 기준을 잡을 때 쓴다.
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef<ChatState>({ messages: [] });

  const commit = (next: ChatState) => {
    stateRef.current = next;
    setMessages(next.messages);
  };

  useEffect(() => {
    commit({ messages: [] });
    setLoaded(false);
    if (!projectId) return;
    let alive = true;
    const poll = async () => {
      try {
        const incoming = await fetchMessages(projectId, stateRef.current.cursor);
        if (alive) {
          commit(applyPolled(stateRef.current, incoming));
          setLoaded(true);
          setError('');
        }
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    };
    poll();
    const timer = window.setInterval(poll, CHAT_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projectId]);

  const send = async (body: string) => {
    if (!projectId) return;
    const sent = await sendMessage(projectId, body);
    commit(applySent(stateRef.current, sent));
  };

  return { messages, loaded, error, send };
};

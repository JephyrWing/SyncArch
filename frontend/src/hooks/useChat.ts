import { useEffect, useRef, useState } from 'react';
import { fetchMessages, sendMessage } from '../api/projects.ts';
import { applyPolled, applySent, type ChatState } from '../utils/chat.ts';
import type { ChatMessage } from '../types/index.ts';
import { isAccessError, type ProjectAccess } from './useProjectAccess.ts';

// [채팅] 문서 폴링(1초)과 겹치지 않게 조금 느리게 확인한다.
const CHAT_POLL_MS = 1500;

/** [채팅] 프로젝트 대화를 불러오고 새 메시지를 폴링한다. */
export const useChat = (projectId: string | null, access: ProjectAccess) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  // [채팅] 첫 응답 전에는 몇 개가 "지난 대화"인지 모른다. 읽음 표시 기준을 잡을 때 쓴다.
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef<ChatState>({ messages: [] });
  const generationRef = useRef(0);
  const pendingRef = useRef<{ body: string; id: string } | null>(null);

  const commit = (next: ChatState) => {
    stateRef.current = next;
    setMessages(next.messages);
  };

  useEffect(() => {
    commit({ messages: [] });
    setLoaded(false);
    setError('');
    pendingRef.current = null;
    const generation = ++generationRef.current;
    if (!projectId) return;
    let alive = true;
    let reading = false;
    const poll = async () => {
      if (!alive || reading || access.isStopped() || document.hidden) return;
      reading = true;
      try {
        for (let page = 0; page < 5; page++) {
          const incoming = await fetchMessages(projectId, stateRef.current.cursor, stateRef.current.cursorId);
          if (!alive || access.isStopped()) return;
          commit(applyPolled(stateRef.current, incoming));
          setLoaded(true);
          setError('');
          if (incoming.length < 200) break;
        }
      } catch (err) {
        if (alive) {
          if (isAccessError(err)) access.stop(err);
          setError((err as Error).message);
        }
      } finally {
        reading = false;
      }
    };
    poll();
    const timer = window.setInterval(poll, CHAT_POLL_MS);
    window.addEventListener('focus', poll);
    window.addEventListener('online', poll);
    return () => {
      alive = false;
      if (generationRef.current === generation) generationRef.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', poll);
      window.removeEventListener('online', poll);
    };
  }, [projectId, access]);

  const send = async (body: string) => {
    if (!projectId) return;
    access.check();
    const generation = generationRef.current;
    try {
      // 불명확한 이전 요청을 먼저 같은 ID/본문으로 확인한다. 새 초안은 그 뒤 새 ID를 쓴다.
      const previous = pendingRef.current;
      const pending = previous ?? { body, id: crypto.randomUUID() };
      pendingRef.current = pending;
      const sent = await sendMessage(projectId, pending.body, pending.id);
      if (generation !== generationRef.current || access.isStopped()) return;
      pendingRef.current = null;
      commit(applySent(stateRef.current, sent));
      if (pending.body !== body) {
        access.check();
        const next = { body, id: crypto.randomUUID() };
        pendingRef.current = next;
        const result = await sendMessage(projectId, next.body, next.id);
        if (generation === generationRef.current && !access.isStopped()) {
          pendingRef.current = null;
          commit(applySent(stateRef.current, result));
        }
      }
    } catch (err) {
      if (generation === generationRef.current && isAccessError(err)) access.stop(err);
      throw err;
    }
  };

  return { messages, loaded, error, send };
};

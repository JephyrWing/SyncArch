import { useEffect, useState } from 'react';
import { leavePresence, sendPresence } from '../api/projects.ts';
import type { PresenceEntry, StepNumber } from '../types/index.ts';

// [협업 상태] 서버는 15초 동안 신호가 없으면 오프라인으로 본다.
const PRESENCE_MS = 2000;

/** [협업 상태] 이 프로젝트를 열어 둔 동안 내 접속과 단계를 알리고, 접속 중인 멤버 목록을 돌려준다. */
export const usePresence = (projectId: string | null, step: StepNumber): PresenceEntry[] => {
  const [online, setOnline] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const beat = () => {
      sendPresence(projectId, step)
        .then((list) => alive && setOnline(list))
        // [협업 상태] 접속 표시는 부가 정보라 실패해도 편집을 막지 않고 다음 주기에 다시 보낸다.
        .catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, PRESENCE_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [projectId, step]);

  useEffect(() => {
    if (!projectId) return;
    return () => {
      setOnline([]);
      leavePresence(projectId).catch(() => undefined);
    };
  }, [projectId]);

  return online;
};

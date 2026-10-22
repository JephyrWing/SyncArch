import { useMemo, useSyncExternalStore } from 'react';
import { ApiError } from '../api/client.ts';

export const isAccessError = (error: unknown): error is ApiError & { status: 401 | 403 | 404 } =>
  error instanceof ApiError && [401, 403, 404].includes(error.status);

/** [협업 상태] 어느 요청에서든 권한 상실을 확인하면 같은 프로젝트의 후속 요청과 응답 적용을 함께 멈춘다. */
export const createProjectAccess = () => {
  let error: ApiError | null = null;
  let paused = false;
  const listeners = new Set<() => void>();
  return {
    getError: () => error,
    isStopped: () => Boolean(error) || paused,
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    stop: (reason: ApiError) => {
      if (error) return;
      error = reason;
      listeners.forEach((listener) => listener());
    },
    check: () => {
      if (error) throw error;
      if (paused) throw new Error('로그아웃 처리 중입니다.');
    },
  };
};

export type ProjectAccess = ReturnType<typeof createProjectAccess>;

export const useProjectAccess = (projectId: string | null) => {
  const access = useMemo(createProjectAccess, [projectId]);
  const error = useSyncExternalStore(access.subscribe, access.getError);
  return { access, error };
};

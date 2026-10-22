import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fetchActivity, fetchDashboard, type ProjectActivity, type ProjectDashboardData } from '../api/projects.ts';
import { isAccessError, type ProjectAccess } from './useProjectAccess.ts';

/** [협업 상태] 집계는 저장본에서 읽고, 현재 프로젝트/접근 상태가 바뀐 뒤의 응답은 버린다. */
export function useProjectDashboard(projectId: string, access: ProjectAccess, documentVersion = 0, parentAccess = access) {
  const blocked = useSyncExternalStore(access.subscribe, access.getError);
  const parentBlocked = useSyncExternalStore(parentAccess.subscribe, parentAccess.getError);
  const [data, setData] = useState<ProjectDashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => void>(() => {});
  const stopped = () => access.isStopped() || parentAccess.isStopped();

  useEffect(() => {
    let alive = true, busy = false, requested = false;
    setData(null);
    setError('');
    setLoading(true);
    const refresh = async () => {
      if (!alive || stopped() || document.hidden) return;
      if (busy) { requested = true; return; }
      busy = true;
      setLoading(true);
      try {
        const next = await fetchDashboard(projectId);
        if (!alive || stopped()) return;
        setData(previous => previous && previous.version > next.version ? previous : next);
        setError('');
      } catch (reason) {
        if (!alive || stopped()) return;
        if (isAccessError(reason)) {
          access.stop(reason);
          if (reason.status === 401) parentAccess.stop(reason);
        } else setError((reason as Error).message);
      } finally {
        busy = false;
        if (alive) setLoading(false);
        if (requested) { requested = false; void refresh(); }
      }
    };
    const wake = () => { void refresh(); };
    refreshRef.current = wake;
    wake();
    const timer = window.setInterval(wake, 5000);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [projectId, access, parentAccess]);

  useEffect(() => { refreshRef.current(); }, [documentVersion]);

  const [history, setHistory] = useState<ProjectActivity[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyEpoch = useRef(0);
  const historyBusy = useRef(false);

  // [협업 상태] 최신 집계 버전보다 뒤의 활동은 섞지 않는다. 갱신 시 이력도 같은 버전부터 다시 읽는다.
  useEffect(() => {
    historyEpoch.current += 1;
    historyBusy.current = false;
    setHistory([]);
    setCursor(data ? data.version + 1 : null);
    setHistoryError('');
    setHistoryLoading(false);
  }, [projectId, data?.version, access]);

  const loadMore = useCallback(async () => {
    if (cursor === null || historyBusy.current || access.isStopped() || parentAccess.isStopped()) return;
    const epoch = historyEpoch.current;
    historyBusy.current = true;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const page = await fetchActivity(projectId, cursor);
      if (epoch !== historyEpoch.current || access.isStopped() || parentAccess.isStopped()) return;
      setHistory(previous => [...new Map([...previous, ...page.items].map(item => [item.eventId, item])).values()]
        .sort((a, b) => b.version - a.version || b.eventId.localeCompare(a.eventId)));
      setCursor(page.nextBeforeVersion);
    } catch (reason) {
      if (epoch !== historyEpoch.current || access.isStopped() || parentAccess.isStopped()) return;
      if (isAccessError(reason)) {
        access.stop(reason);
        if (reason.status === 401) parentAccess.stop(reason);
      } else setHistoryError((reason as Error).message);
    } finally {
      if (epoch === historyEpoch.current) {
        historyBusy.current = false;
        setHistoryLoading(false);
      }
    }
  }, [projectId, cursor, access, parentAccess]);

  useEffect(() => {
    if (historyOpen && data && history.length === 0 && cursor !== null && !historyError) void loadMore();
  }, [historyOpen, data, history.length, cursor, historyError, loadMore]);
  useEffect(() => () => { historyEpoch.current += 1; }, [projectId, access]);

  return { data: data?.projectId === projectId ? data : null, error: blocked?.message || parentBlocked?.message || error,
    blocked: Boolean(blocked || parentBlocked), loading, refresh: () => refreshRef.current(),
    history, cursor, historyError, historyLoading, historyOpen, setHistoryOpen, loadMore };
}

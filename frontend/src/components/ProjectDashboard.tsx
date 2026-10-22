import React from 'react';
import { BarChart3, RefreshCw, X } from 'lucide-react';
import type { ProjectActivity } from '../api/projects.ts';
import { useProjectDashboard } from '../hooks/useProjectDashboard.ts';
import { useProjectAccess, type ProjectAccess } from '../hooks/useProjectAccess.ts';

const areas: Record<string, string> = { project: '프로젝트', ideas: '아이디어', features: '기능', nodes: '노드', connections: '연결선', tables: '테이블', architecture: '구성도', erd: 'ERD' };
const actions: Record<string, string> = { added: '추가', updated: '수정', removed: '삭제', created: '생성', deleted: '삭제', member_added: '멤버 추가', member_removed: '멤버 제외', role_changed: '역할 변경', archived: '보관', restored: '복원' };

function ActivityList({ items }: { items: ProjectActivity[] }) {
  return items.length === 0 ? <p className="text-xs text-slate-500">아직 저장된 활동이 없습니다.</p> : (
    <ol className="space-y-3" aria-label="프로젝트 활동 이력">
      {items.map(item => (
        <li key={item.eventId} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs" data-event-id={item.eventId}>
          <div className="flex flex-wrap items-center justify-between gap-1 text-slate-400">
            <span><strong className="text-slate-200">{item.actorName || '이름 없는 사용자'}</strong> · v{item.version}</span>
            <time dateTime={item.committedAt}>{new Date(item.committedAt).toLocaleString('ko-KR')}</time>
          </div>
          <ul className="mt-2 space-y-1 break-words text-slate-300">
            {item.changes.map((change, index) => <li key={index}>{areas[change.area] || change.area} · {change.label || change.entityType || '항목'} · {actions[change.action] || change.action}</li>)}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** [협업 상태] 로비의 집계와 편집 화면의 이력은 서버 저장본만 표시하고 개인 초안을 저장하지 않는다. */
export function ProjectDashboard({ projectId, access, parentAccess, documentVersion = 0, compact = false }: {
  projectId: string; access: ProjectAccess; parentAccess?: ProjectAccess; documentVersion?: number; compact?: boolean;
}) {
  const overview = useProjectDashboard(projectId, access, documentVersion, parentAccess);
  const data = overview.blocked ? null : overview.data;
  const details = overview.historyOpen;
  const stats = (expanded = false) => data && (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div><p className="text-xs text-slate-400">기능 완료율</p><p className="text-xl font-bold text-indigo-300" aria-label="기능 완료율">{Math.round(data.progress * 10) / 10}%</p></div>
        <p className="text-xs text-slate-400">완료 {data.featureStatuses.COMPLETED || 0} / 전체 {data.counts.features}개</p>
      </div>
      <div role="progressbar" aria-label="기능 진행률" aria-valuenow={data.progress} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-indigo-500" style={{ width: `${data.progress}%` }} /></div>
      <p className="text-[11px] text-slate-500">서버 저장본 v{data.version} 기준 · 미저장 편집 제외</p>
      {(!compact || expanded) && <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Object.entries(data.counts).map(([area, count]) => (
        <div key={area} className="rounded-lg bg-slate-800 p-2 text-center"><dt className="text-[11px] text-slate-400">{areas[area]}</dt><dd className="font-semibold text-slate-100">{count}</dd></div>
      ))}</dl>}
    </div>
  );
  return (
    <>
      {compact && <div className="mt-3 space-y-3 border-t border-slate-800 pt-3" aria-label="프로젝트 요약">
        {stats()}
        {!data && !overview.error && <p className="text-xs text-slate-500">현황을 불러오는 중…</p>}
        {data && <div><h3 className="mb-2 text-xs text-slate-400">최근 변경</h3><ActivityList items={data.recentActivity.slice(0, 2)} /></div>}
        {overview.error && <p role="alert" className="text-xs text-rose-300">{overview.error}{overview.blocked ? ' 현황 조회를 중단했습니다.' : ' 마지막으로 확인한 저장본입니다.'}</p>}
      </div>}
      <button type="button" onClick={() => overview.setHistoryOpen(true)} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white" aria-label="프로젝트 현황·활동 열기">
        <BarChart3 className="h-3.5 w-3.5" /><span>현황·활동</span>
      </button>
      {details && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 p-3" onKeyDown={event => { if (event.key === 'Escape') overview.setHistoryOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-label="프로젝트 현황·활동" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
          <header className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">프로젝트 현황·활동</h2><button autoFocus type="button" aria-label="현황 닫기" onClick={() => overview.setHistoryOpen(false)}><X className="h-4 w-4" /></button></header>
          {overview.error && <p role="alert" className="mb-3 text-xs text-rose-300">{overview.error}{overview.blocked ? ' 현황 조회를 중단했습니다. 로그인과 프로젝트 권한을 확인하세요.' : ' 마지막으로 확인한 저장본입니다.'}</p>}
          {!data && !overview.error && <p className="text-sm text-slate-400">현황을 불러오는 중…</p>}
          {!overview.blocked && <>
            {stats(true)}
            <button type="button" disabled={overview.loading} onClick={overview.refresh} className="my-4 flex items-center gap-1 text-xs text-indigo-300 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />현황 새로고침</button>
            {data && <section className="space-y-3"><h3 className="text-sm font-semibold">저장된 활동 이력</h3>
              {overview.historyLoading && overview.history.length === 0 ? <p role="status" className="text-xs text-slate-400">활동 이력을 불러오는 중…</p> : <ActivityList items={overview.history} />}
              {overview.historyError && <p role="alert" className="text-xs text-rose-300">{overview.historyError}</p>}
              {(overview.cursor !== null || overview.historyError) && <button type="button" onClick={overview.loadMore} disabled={overview.historyLoading} className="w-full rounded-lg border border-slate-700 p-2 text-xs text-slate-300 disabled:opacity-50">{overview.historyLoading ? '이력을 불러오는 중…' : overview.historyError ? '이력 다시 시도' : '이전 활동 더 보기'}</button>}
            </section>}
          </>}
        </section>
      </div>}
    </>
  );
}

/** [프로젝트] 목록의 한 프로젝트 접근 거부가 다른 프로젝트의 현황 조회까지 막지 않게 한다. */
export function LobbyProjectDashboard({ projectId, parentAccess }: { projectId: string; parentAccess: ProjectAccess }) {
  const { access } = useProjectAccess(projectId);
  return <ProjectDashboard projectId={projectId} access={access} parentAccess={parentAccess} compact />;
}

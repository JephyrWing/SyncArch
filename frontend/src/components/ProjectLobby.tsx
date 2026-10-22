import React, { useState } from 'react';
import { FolderOpen, KeyRound, Layers, LogOut, Plus } from 'lucide-react';
import type { ProjectSummary, SessionUser } from '../types/index.ts';
import { AccountSettings } from './AccountSettings.tsx';
import { LobbyProjectDashboard } from './ProjectDashboard.tsx';
import type { ProjectAccess } from '../hooks/useProjectAccess.ts';

interface ProjectLobbyProps {
  access: ProjectAccess;
  me: SessionUser;
  projects: ProjectSummary[];
  onOpen: (id: string) => void;
  onCreate: (title: string, summary: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onArchive: (id: string, archived: boolean) => Promise<void>;
  onLogout: () => void;
}

const card = 'rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3';
const input = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none';

/** [프로젝트] 로그인 직후 화면. 프로젝트를 만들면 팀장이 되고, 팀원은 팀장이 준 초대 코드로 참가한다. */
export const ProjectLobby: React.FC<ProjectLobbyProps> = ({ me, projects, onOpen, onCreate, onJoin, onArchive, onLogout, access }) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | 'archive' | null>(null);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const visibleProjects = projects.filter((project) => Boolean(project.archivedAt) === showArchived);

  const run = async (kind: 'create' | 'join' | 'archive', action: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-screen w-screen overflow-y-auto bg-slate-950 p-4 font-sans text-slate-100">
      <div className="mx-auto max-w-4xl space-y-5 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-indigo-400">
            <Layers className="h-5 w-5" />
            <span>SyncArch</span>
          </div>
          <div className="flex items-center gap-2"><AccountSettings />
          <button onClick={onLogout} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white">
            <LogOut className="h-3.5 w-3.5" />
            {me.displayName} 로그아웃
          </button>
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">어떤 프로젝트에서 작업할까요?</h1>
          <p className="text-xs text-slate-400">
            새 프로젝트를 만들면 팀장이 되어 초대 코드를 받습니다. 팀원은 그 코드로 참가하면 같은 화면을 함께 편집합니다.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/70 p-3 text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <form
            className={card}
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) run('create', () => onCreate(title.trim(), summary.trim()));
            }}
          >
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-white">
              <Plus className="h-4 w-4 text-indigo-400" />
              프로젝트 생성하기
            </h2>
            <p className="text-[11px] text-slate-400">만든 사람이 팀장이 됩니다. 만든 뒤 상단의 초대 코드를 팀원에게 보내세요.</p>
            <input aria-label="프로젝트 이름" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="프로젝트 이름" className={input} />
            <input aria-label="한 줄 소개" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} placeholder="한 줄 소개 (선택)" className={input} />
            <button
              type="submit"
              disabled={!title.trim() || busy !== null}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy === 'create' ? '만드는 중…' : '생성하고 팀장으로 시작'}
            </button>
          </form>

          <form
            className={card}
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) run('join', () => onJoin(code.trim()));
            }}
          >
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-white">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              참가하기
            </h2>
            <p className="text-[11px] text-slate-400">팀장에게 받은 8자리 초대 코드를 입력하세요. 하이픈과 대소문자는 상관없습니다.</p>
            <input
              aria-label="초대 코드"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={20}
              placeholder="예: ABCD-2345"
              className={`${input} font-mono tracking-widest`}
            />
            <button
              type="submit"
              disabled={!code.trim() || busy !== null}
              className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === 'join' ? '참가하는 중…' : '코드로 참가'}
            </button>
          </form>
        </div>

        <section className={card}>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-white">
            <FolderOpen className="h-4 w-4 text-sky-400" />
            내 프로젝트 ({visibleProjects.length})
          </h2>
          {/* [프로젝트] 보관본도 열어서 읽을 수 있으며 복원은 OWNER만 수행한다. */}
          <div className="flex gap-2 text-xs">
            <button type="button" aria-pressed={!showArchived} onClick={() => setShowArchived(false)} className="rounded border border-slate-700 px-2 py-1">사용 중 프로젝트</button>
            <button type="button" aria-pressed={showArchived} onClick={() => setShowArchived(true)} className="rounded border border-slate-700 px-2 py-1">보관된 프로젝트</button>
          </div>
          {visibleProjects.length === 0 ? (
            <p className="text-xs text-slate-500">{showArchived ? '보관된 프로젝트가 없습니다.' : '아직 참여한 프로젝트가 없습니다.'}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleProjects.map((project) => (
                <li key={project.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <button
                    onClick={() => onOpen(project.id)}
                    className="w-full rounded-lg text-left hover:text-indigo-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-white">{project.title}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          project.role === 'OWNER' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700/60 text-slate-300'
                        }`}
                      >
                        {project.role === 'OWNER' ? '팀장' : '팀원'}
                      </span>
                    </div>
                    {project.summary && <p className="mt-1 truncate text-[11px] text-slate-400">{project.summary}</p>}
                  </button>
                  {project.role === 'OWNER' && <button type="button" disabled={busy !== null}
                    aria-label={project.archivedAt ? '프로젝트 복원' : '프로젝트 보관'}
                    onClick={() => {
                      if (window.confirm(`'${project.title}' 프로젝트를 ${project.archivedAt ? '복원' : '보관'}할까요?`)) {
                        run('archive', () => onArchive(project.id, !project.archivedAt));
                      }
                    }} className="mt-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40">
                    {project.archivedAt ? '복원' : '보관'}
                  </button>}
                  <LobbyProjectDashboard projectId={project.id} parentAccess={access} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

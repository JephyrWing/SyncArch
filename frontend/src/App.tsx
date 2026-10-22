/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LayoutGrid, LogOut } from 'lucide-react';
import { Header } from './components/Header.tsx';
import { Step1IdeaBoard } from './components/Step1IdeaBoard.tsx';
import { Step2FeatureSpec } from './components/Step2FeatureSpec.tsx';
import { Step3Architecture } from './components/Step3Architecture.tsx';
import { Step4ErdStudio } from './components/Step4ErdStudio.tsx';
import { ExportModal } from './components/ExportModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { ProjectLobby } from './components/ProjectLobby.tsx';
import { InviteButton } from './components/InviteButton.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { AccountSettings } from './components/AccountSettings.tsx';
import { ProjectDashboard } from './components/ProjectDashboard.tsx';
import { CollabBanner, SaveStatusBadge, ToastStack, type Toast } from './components/CollabStatus.tsx';
import {
  cloneProject,
  createProject,
  fetchDocument,
  fetchMe,
  joinProject,
  listMembers,
  listProjects,
  logout,
  saveDocument,
} from './api/projects.ts';
import { ApiError } from './api/client.ts';
import { toTeamMembers } from './adapters/projectAdapter.ts';
import { SAFE_TO_LEAVE, useProjectDocument, type RemoteChange } from './hooks/useProjectDocument.ts';
import { usePresence } from './hooks/usePresence.ts';
import { isAccessError, useProjectAccess } from './hooks/useProjectAccess.ts';
import { clearReferences, findReferences, renameColumn, renameTable } from './utils/erdRename.ts';
import { isValidConnection } from './utils/architecture.ts';
import { voteCount } from './utils/votes.ts';
import { updateIdea } from './utils/ideas.ts';
import { ideaPlacement, removeIdeaSubtree } from './utils/ideaTree.ts';
import { featureCode } from './utils/features.ts';
import type {
  StepNumber,
  TeamMember,
  IdeaCard,
  FeatureSpec,
  ArchNode,
  ArchConnection,
  ErdTable,
  SnapshotHistory,
  ErdColumn,
  ProjectData,
  ProjectSummary,
  SessionUser,
  SqlDialect,
  ArchVersion
} from './types/index.ts';

export default function App() {
  // [구글 로그인] 세션 확인 중에는 undefined다.
  const [googleLinked, setGoogleLinked] = useState(() => window.location.pathname === '/auth/callback' && new URLSearchParams(window.location.search).get('linked') === 'true');
  const [me, setMe] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => setMe(null)).finally(() => {
      // [구글 로그인] 서버 콜백이 /auth/callback으로 돌려보낸다. 로그인 상태를 확인한 뒤 주소를 정리한다.
      if (window.location.pathname === '/auth/callback') window.history.replaceState(null, '', '/');
    });
  }, []);

  if (me === undefined) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">불러오는 중…</div>;
  }
  if (!me) return <LoginScreen onLogin={setMe} />;
  return <Workspace me={me} onLoggedOut={() => { setMe(null); setGoogleLinked(false); }} googleLinked={googleLinked} />;
}

// [기능 명세] 개수 + 1이 아니라 최댓값 + 1을 써서, FEAT-02를 지워도 다음 기능이 FEAT-03을 다시 쓰지 않게 한다(02 FEAT 03).
const nextFeatureNumber = (features: FeatureSpec[]): number =>
  Math.max(0, ...features.map((f) => Number(/^FEAT-(\d+)$/.exec(featureCode(f))?.[1] ?? 0))) + 1;

function Workspace({ me, onLoggedOut, googleLinked }: { me: SessionUser; onLoggedOut: () => void; googleLinked: boolean }) {
  // [프로젝트] 프로젝트는 서버에서 받고, currentStep은 개인 화면 상태다(02 VIEW 02).
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [isListLoaded, setIsListLoaded] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  // [ERD 설계] 서버 저장 계약은 mariadb만 받는다. 다른 DBMS는 SQL 미리보기·내보내기용 개인 화면 선택이다.
  const [previewDbms, setPreviewDbms] = useState<SqlDialect>('mariadb');
  const [toasts, setToasts] = useState<Toast[]>(() => googleLinked ? [{ id: Date.now(), text: 'Google 계정을 연결했습니다.', details: [] }] : []);

  const pushToast = (text: string, details: string[] = [], key?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.filter((t) => !key || t.key !== key).slice(-3), { id, key, text, details }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
  };

  const handleRemoteChange = (change: RemoteChange) => {
    pushToast(change.text, change.changes.slice(0, 4).map((c) => `${c.area} '${c.name}' ${c.kind}`), `remote:${change.actorId}`);
  };

  const { access, error: accessError } = useProjectAccess(currentProjectId);
  const doc = useProjectDocument(currentProjectId, { onRemoteChange: handleRemoteChange, onAuthExpired: onLoggedOut, access });
  // [프로젝트] 다른 프로젝트를 여는 동안 이전 프로젝트 문서를 잠깐이라도 보여 주지 않는다.
  const currentProject: ProjectData | null =
    doc.project && doc.project.id === currentProjectId ? { ...doc.project, currentStep } : null;
  const myRole = projectList.find((p) => p.id === currentProjectId)?.role;
  const canLeave = SAFE_TO_LEAVE.includes(doc.status);

  const refreshProjects = async (selectId?: string) => {
    const list = await listProjects();
    setProjectList(list);
    setIsListLoaded(true);
    // [프로젝트] await 뒤에 다시 확인한다. 요청 중에 생긴 편집을 두고 다른 프로젝트로 넘어가지 않는다.
    const target = selectId && doc.isSafeToLeave() ? selectId : undefined;
    if (selectId && !target) pushToast('새 프로젝트가 준비됐습니다', ['저장이 끝난 뒤 프로젝트 목록에서 여세요.']);
    // [프로젝트] 로그인 직후에는 바로 열지 않고 로비에서 생성·참가·선택하게 한다.
    setCurrentProjectId((prev) => target ?? (prev && list.some((p) => p.id === prev) ? prev : null));
  };

  useEffect(() => {
    refreshProjects().catch((error: Error) => {
      setIsListLoaded(true);
      pushToast('프로젝트 목록을 불러오지 못했습니다', [error.message]);
    });
  }, []);

  // [협업 상태] 접속 중인 멤버와 보고 있는 단계. 아바타를 누르면 그 멤버의 단계를 따라간다.
  const online = usePresence(currentProjectId, currentStep, access);

  // [멤버 관리] 예전 하드코딩 팀 목록 대신 실제 멤버를 쓴다.
  // 화면을 연 뒤 초대 코드로 참가한 팀원이 접속하면 목록에 없으므로 그때 다시 불러온다.
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const hasUnknownOnline = online.some((entry) => !teamMembers.some((member) => member.id === entry.userId));
  useEffect(() => {
    if (!currentProjectId || access.isStopped()) return;
    let alive = true;
    listMembers(currentProjectId).then((members) => {
      if (alive && !access.isStopped()) setTeamMembers(toTeamMembers(members));
    }).catch((error) => {
      if (!alive) return;
      if (isAccessError(error)) access.stop(error);
      setTeamMembers([]);
    });
    return () => { alive = false; };
  }, [currentProjectId, hasUnknownOnline, access]);
  const [followId, setFollowId] = useState<string | null>(null);
  const people: TeamMember[] = teamMembers.map((member) => {
    const entry = online.find((o) => o.userId === member.id);
    return { ...member, isOnline: Boolean(entry), currentStep: entry?.step ?? member.currentStep, isSpotlight: member.id === followId };
  });
  // [협업 상태] 처음 목록을 받기 전이거나 멤버에서 빠진 사람은 따라가지 않는다.
  const followed = people.find((member) => member.id === followId && member.isOnline) ?? null;
  useEffect(() => {
    if (followed) setCurrentStep(followed.currentStep);
  }, [followed?.currentStep]);
  useEffect(() => setFollowId(null), [currentProjectId]);

  // [구글 로그인] 같은 브라우저 창에서 다른 계정으로 로그인하면 세션 쿠키가 바뀐다. 이 탭이 모르고 남의 이름으로
  // 저장하지 않게, 창으로 돌아올 때와 10초마다 확인해서 바뀌었으면 새 계정으로 다시 연다.
  useEffect(() => {
    const check = () =>
      !access.isStopped() &&
      fetchMe()
        .then((user) => {
          if (user.id === me.id) return;
          access.stop(new ApiError(401, 'ACCOUNT_CHANGED', '이 브라우저에서 다른 계정으로 로그인했습니다.'));
        })
        .catch((error) => {
          if ((error as { status?: number }).status === 401) access.stop(new ApiError(401, 'AUTH_REQUIRED', '로그인이 만료되었습니다.'));
        });
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 10000);
    return () => {
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, [me.id, access]);

  useEffect(() => {
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (!canLeave) e.preventDefault();
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  }, [canLeave]);

  // [공통 화면] 스냅샷
  const [snapshots, setSnapshots] = useState<SnapshotHistory[]>([]);
  const [snapshotStore, setSnapshotStore] = useState<Record<string, any>>({});

  // [공통 화면] 반응형 화면 크기 감지(모바일 / 태블릿 / 데스크톱)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // [공통 화면] 크기 조절 사이드바와 반응형 상태(저장됨)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('syncarch_sidebar_width');
      return saved ? Math.min(65, Math.max(22, parseFloat(saved))) : 40;
    } catch {
      return 40;
    }
  });
  // 아키텍처는 캔버스 공간을 넓히고, 다른 Step의 개인 너비 설정과 분리한다.
  const [architectureSidebarWidth, setArchitectureSidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('syncarch_architecture_sidebar_width'));
      return Number.isFinite(saved) && saved > 0 ? Math.min(65, Math.max(20, saved)) : 30;
    } catch {
      return 30;
    }
  });
  const activeSidebarWidth = currentStep === 3 ? architectureSidebarWidth : sidebarWidth;
  const setActiveSidebarWidth = currentStep === 3 ? setArchitectureSidebarWidth : setSidebarWidth;
  const sidebarStorageKey = currentStep === 3 ? 'syncarch_architecture_sidebar_width' : 'syncarch_sidebar_width';
  const [mobileTab, setMobileTab] = useState<'editor' | 'canvas'>('editor');

  // [공통 화면] 드래그 크기 조절 처리
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = activeSidebarWidth;
    let latestWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const totalWidth = window.innerWidth;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / totalWidth) * 100;
      const newWidth = Math.min(65, Math.max(20, startWidth + deltaPercent));
      latestWidth = newWidth;
      setActiveSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      try {
        localStorage.setItem(sidebarStorageKey, latestWidth.toString());
      } catch {}
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetSidebarWidth = () => {
    const defaultWidth = currentStep === 3 ? 30 : 40;
    setActiveSidebarWidth(defaultWidth);
    try {
      localStorage.setItem(sidebarStorageKey, defaultWidth.toString());
    } catch {}
  };

  // [공통 화면] 모달
  const [isExportOpen, setIsExportOpen] = useState(false);

  // [문서 저장] 프로젝트 전환이나 로그아웃 때 저장 안 된 편집을 버리지 않는다(02 SAVE 03).
  const guardLeave = (): boolean => {
    if (canLeave) return true;
    pushToast('저장되지 않은 변경이 있습니다', ['상단에 "저장됨"이 표시된 뒤 다시 시도하세요. 실패·충돌이면 상단 안내에서 먼저 해결하세요.']);
    return false;
  };

  const handleLogout = async () => {
    if (!guardLeave()) return;
    access.pause();
    try {
      await logout();
    } catch (error) {
      // [로그인] 401은 서버 세션이 이미 없다는 뜻이다. 다른 실패면 세션은 살아 있다.
      if ((error as { status?: number }).status !== 401) {
        access.resume();
        doc.resumeSaving();
        pushToast('로그아웃하지 못했습니다', [(error as Error).message]);
        return;
      }
    }
    access.stop(new ApiError(401, 'AUTH_REQUIRED', '로그아웃했습니다.'));
    // [문서 저장] 요청 중에 생긴 편집은 화면에 남고, 그 저장은 백업 선택지와 함께 실패한다.
    if (!doc.isSafeToLeave()) {
      pushToast('로그아웃했지만 저장되지 않은 변경이 있어 화면을 유지합니다', ['상단 안내에서 내 변경을 백업한 뒤 새로고침하세요.']);
      return;
    }
    onLoggedOut();
  };

  // [프로젝트] 로비에서 만들면 팀장이 되고, 코드로 참가하면 편집자가 된다. 실패 메시지는 로비가 보여 준다.
  const handleLobbyCreate = async (title: string, summary: string) => {
    const created = await createProject(title, summary);
    await refreshProjects(created.id);
  };
  const handleLobbyJoin = async (code: string) => {
    const joined = await joinProject(code);
    await refreshProjects(joined.id);
    pushToast(`'${joined.title}'에 참가했습니다`, ['같은 화면을 팀원과 실시간으로 함께 편집합니다.']);
  };
  const handleBackToLobby = () => {
    if (!guardLeave()) return;
    setCurrentProjectId(null);
    refreshProjects().catch(() => undefined);
  };

  const statusSlot = (
    <div className="flex items-center gap-1.5">
      <SaveStatusBadge status={doc.status} version={doc.version} />
      {currentProjectId && <ProjectDashboard key={currentProjectId} projectId={currentProjectId} access={access} documentVersion={doc.version} />}
      <AccountSettings canNavigate={() => doc.isSafeToLeave()} />
      {myRole === 'OWNER' && currentProjectId && <InviteButton key={currentProjectId} projectId={currentProjectId} access={access} />}
      <button
        onClick={handleBackToLobby}
        className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
        title="프로젝트 목록(생성·참가)으로"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">목록</span>
      </button>
      <button
        onClick={handleLogout}
        className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
        title="로그아웃"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">{me.displayName}</span>
      </button>
    </div>
  );

  const toastStack = <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />;

  if (isListLoaded && !currentProjectId) {
    return (
      <>
        <ProjectLobby
          access={access}
          me={me}
          projects={projectList}
          onOpen={setCurrentProjectId}
          onCreate={handleLobbyCreate}
          onJoin={handleLobbyJoin}
          onLogout={handleLogout}
        />
        {toastStack}
      </>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-4 text-sm text-slate-300">
        {doc.status === 'error' ? (
          <>
            <p className="text-rose-300">{doc.message}</p>
            <div className="flex gap-2">
              <button onClick={accessError ? doc.reconnect : doc.reloadLatest} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white">{accessError ? '다시 연결' : '다시 불러오기'}</button>
              <button onClick={() => setCurrentProjectId(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300">목록으로</button>
            </div>
          </>
        ) : (
          <p>불러오는 중…</p>
        )}
        {toastStack}
      </div>
    );
  }

  // [공통 화면] 현재 프로젝트 데이터를 고치는 도우미
  const updateCurrentProject = (updatedFields: Partial<ProjectData>) => {
    doc.update(updatedFields);
  };

  // [프로젝트] 프로젝트 전환
  const handleSelectProject = (id: string) => {
    if (id === currentProjectId || !guardLeave()) return;
    setCurrentProjectId(id);
  };

  // [프로젝트] 새 프로젝트는 서버의 빈 문서에서 시작하고, 추가 정보는 첫 저장에 담는다.
  async function handleCreateProject(title: string, summary: string, categoryTag: string, targetDbms: SqlDialect) {
    if (!guardLeave()) return;
    try {
      // [프로젝트] 서버 저장 계약은 mariadb만 받아서 targetDbms는 보내지 않는다(projectAdapter 참고).
      const created = await createProject(title, summary, categoryTag);
      await refreshProjects(created.id);
    } catch (error) {
      pushToast('프로젝트를 만들지 못했습니다', [(error as Error).message]);
    }
  }

  // [프로젝트] 저장 안 된 로컬 편집이 아니라 서버에 저장된 버전을 내 소유의 새 프로젝트로 복제한다.
  const handleCloneProject = async (id: string) => {
    if (!guardLeave()) return;
    try {
      const source = await fetchDocument(id);
      if (!source) return;
      const cloned = await cloneProject(id, source.version, `${source.project.title} (복사본)`);
      await refreshProjects(cloned.id);
    } catch (error) {
      pushToast('프로젝트를 복사하지 못했습니다', [(error as Error).message]);
    }
  };

  const headerProjects: ProjectData[] = projectList.map((summary) =>
    summary.id === currentProject.id
      ? currentProject
      : { ...currentProject, ...summary, ideas: [], features: [], nodes: [], connections: [], tables: [], archVersions: [] }
  );

  // [공통 화면] 단계 잠금 전환
  // [공통 화면] 스냅샷 처리
  const handleSaveSnapshot = (name: string) => {
    const id = crypto.randomUUID();
    const newSnapshot: SnapshotHistory = {
      id,
      name: `[${currentProject.title}] ${name}`,
      timestamp: Date.now(),
      dateStr: '방금 전',
    };
    setSnapshots([newSnapshot, ...snapshots]);
    setSnapshotStore((prev) => ({
      ...prev,
      [id]: JSON.parse(JSON.stringify(currentProject)),
    }));
  };

  const handleRestoreSnapshot = (id: string) => {
    const saved = snapshotStore[id];
    if (!saved) return;
    // [공통 화면] 스냅샷은 프로젝트를 바꿔도 남는다. 다른 프로젝트의 스냅샷을 복원하면 지금 프로젝트 문서를 덮어쓰므로 막는다.
    if (saved.id !== currentProject.id) {
      pushToast('다른 프로젝트의 스냅샷입니다', [`'${saved.title}' 프로젝트를 연 뒤 복원하세요.`]);
      return;
    }
    updateCurrentProject(saved);
  };

  // [아이디어 보드] Step 1 처리. 서버는 로그인한 본인만 작성자·투표자·댓글 작성자로 받는다(계약 v2).
  const handleAddCard = (card: Omit<IdeaCard, 'id' | 'votes' | 'votedBy' | 'comments'>) => {
    const placement = ideaPlacement(currentProject.ideas, card.parentIdeaId ?? null, card.category);
    if (!placement || doc.status === 'readonly') {
      pushToast('아이디어를 추가할 수 없습니다', ['최신 부모 아이디어와 편집 권한을 확인하세요. 입력 내용은 유지됩니다.']);
      return false;
    }
    const newCard: IdeaCard = {
      ...card,
      ...placement,
      id: crypto.randomUUID(),
      author: me.displayName,
      authorId: me.id,
      votes: 0,
      votedBy: [],
      voterIds: [me.id],
      comments: [],
      ...(card.decidedBy ? { decidedBy: me.id } : {}),
    };
    updateCurrentProject({ ideas: [...currentProject.ideas, newCard] });
    return true;
  };

  const handleUpdateCard = (id: string, updated: Partial<IdeaCard>) => {
    // [아이디어 보드] 결정(상태·사유)을 바꾼 경우에만 로그인 사용자를 결정자로 기록한다. 그 밖에는 기존 결정자를 그대로 둔다.
    // 서버는 결정이 그대로인데 결정자가 바뀌면 거절한다(document_validation).
    const card = currentProject.ideas.find((c) => c.id === id);
    const { decidedBy: _picked, ...rest } = updated;
    const decisionChanged = !!card && (
      ('decisionStatus' in updated && updated.decisionStatus !== card.decisionStatus) ||
      ('decisionReason' in updated && updated.decisionReason !== card.decisionReason));
    const fields = decisionChanged ? { ...rest, decidedBy: me.id } : rest;
    updateCurrentProject({
      ideas: updateIdea(currentProject.ideas, id, fields),
    });
  };

  const handleDeleteCard = (id: string) => {
    updateCurrentProject(removeIdeaSubtree(currentProject.ideas, currentProject.features, id));
  };

  const handleVoteCard = (cardId: string) => {
    updateCurrentProject({
      ideas: currentProject.ideas.map((card) => {
        if (card.id !== cardId) return card;
        const voters = card.voterIds ?? [];
        return { ...card, voterIds: voters.includes(me.id) ? voters.filter((id) => id !== me.id) : [...voters, me.id] };
      }),
    });
  };

  const handleAddComment = (cardId: string, _author: string, text: string) => {
    updateCurrentProject({
      ideas: currentProject.ideas.map((card) => {
        if (card.id === cardId) {
          return {
            ...card,
            comments: [
              ...card.comments,
              {
                id: crypto.randomUUID(),
                author: me.displayName,
                authorId: me.id,
                text,
                // [아이디어 보드] 저장하면 서버 시각으로 바뀐다.
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }
        return card;
      }),
    });
  };

  // [기능 명세] Step 2 처리
  const handleAddFeature = (feat: Omit<FeatureSpec, 'id'>) => {
    const newFeature: FeatureSpec = {
      ...feat,
      id: crypto.randomUUID(),
      displayCode: `FEAT-${String(nextFeatureNumber(currentProject.features)).padStart(2, '0')}`,
    };
    updateCurrentProject({ features: [...currentProject.features, newFeature] });
  };

  const handleUpdateFeature = (id: string, updated: Partial<FeatureSpec>) => {
    updateCurrentProject({
      features: currentProject.features.map((f) => (f.id === id ? { ...f, ...updated } : f)),
    });
  };

  const handleDeleteFeature = (id: string) => {
    updateCurrentProject({
      features: currentProject.features.filter((f) => f.id !== id),
    });
  };

  const handleImportFromStep1 = () => {
    const highVoteIdeas = currentProject.ideas.filter((i) => voteCount(i) >= 4);
    const existingStoryIds = new Set(currentProject.features.map((f) => f.relatedStoryId).filter(Boolean));

    const newFeatures: FeatureSpec[] = [];
    let count = nextFeatureNumber(currentProject.features);

    highVoteIdeas.forEach((idea) => {
      if (!existingStoryIds.has(idea.id)) {
        newFeatures.push({
          id: crypto.randomUUID(),
          displayCode: `FEAT-${String(count).padStart(2, '0')}`,
          domain: idea.category === 'problems_goals' ? '정책' : idea.category === 'actors' ? '인증' : '비즈니스',
          name: idea.title,
          priority: 'P0',
          assignee: idea.author,
          method: 'POST',
          endpoint: `/api/v1/core/${idea.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          requestFields: 'payload: object, userId: UUID',
          responseFields: 'status: "SUCCESS"',
          summary: idea.description,
          status: 'PLANNED',
          relatedStoryId: idea.id,
        });
        count++;
      }
    });

    if (newFeatures.length > 0) {
      updateCurrentProject({ features: [...currentProject.features, ...newFeatures] });
    }
  };

  // [시스템 아키텍처] Step 3 처리와 버전 관리
  const handleAddNode = (node: Omit<ArchNode, 'id'>) => {
    const newNode: ArchNode = {
      ...node,
      id: crypto.randomUUID(),
    };
    updateCurrentProject({ nodes: [...currentProject.nodes, newNode] });
  };

  const handleUpdateNode = (id: string, updated: Partial<ArchNode>) => {
    updateCurrentProject({
      nodes: currentProject.nodes.map((n) => (n.id === id ? { ...n, ...updated } : n)),
    });
  };

  const handleUpdateNodePosition = (id: string, x: number, y: number) => {
    updateCurrentProject({
      nodes: currentProject.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    });
  };

  const handleDeleteNode = (id: string) => {
    updateCurrentProject({
      nodes: currentProject.nodes.filter((n) => n.id !== id),
      connections: currentProject.connections.filter((c) => c.sourceId !== id && c.targetId !== id),
    });
  };

  const handleAddConnection = (conn: Omit<ArchConnection, 'id'>) => {
    if (!isValidConnection(currentProject.nodes, conn.sourceId, conn.targetId)) return;
    const newConn: ArchConnection = {
      ...conn,
      id: crypto.randomUUID(),
    };
    updateCurrentProject({ connections: [...currentProject.connections, newConn] });
  };

  const handleUpdateConnection = (id: string, updated: Partial<ArchConnection>) => {
    updateCurrentProject({
      connections: currentProject.connections.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...updated };
        return isValidConnection(currentProject.nodes, next.sourceId, next.targetId) ? next : c;
      }),
    });
  };

  const handleDeleteConnection = (id: string) => {
    updateCurrentProject({
      connections: currentProject.connections.filter((c) => c.id !== id),
    });
  };

  // [ERD 설계] Step 4 처리와 대상 DBMS
  const handleChangeTargetDbms = (dbms: SqlDialect) => {
    setPreviewDbms(dbms);
  };

  const handleAddTable = (table: Omit<ErdTable, 'id'>) => {
    const newTable: ErdTable = {
      ...table,
      id: crypto.randomUUID(),
    };
    updateCurrentProject({ tables: [...currentProject.tables, newTable] });
  };

  const handleUpdateTable = (id: string, updated: Partial<ErdTable>) => {
    updateCurrentProject({
      tables: currentProject.tables.map((t) => (t.id === id ? { ...t, ...updated } : t)),
    });
  };

  const describeRefs = (refs: { tableName: string; columnName: string }[]) =>
    refs.map((r) => `${r.tableName}.${r.columnName}`).join(', ');

  // [ERD 설계] 팀원 요청: 테이블 이름을 바꾸면 그 테이블을 가리키는 FK도 같은 저장에서 모두 바꾼다.
  const handleRenameTable = (id: string, name: string) => {
    updateCurrentProject({ tables: renameTable(currentProject.tables, id, name) });
  };

  const handleDeleteTable = (id: string) => {
    const table = currentProject.tables.find((t) => t.id === id);
    if (!table) return;
    const refs = findReferences(currentProject.tables, table.name).filter((r) => r.tableId !== id);
    if (
      refs.length > 0 &&
      !window.confirm(
        `'${table.name}'을(를) 참조하는 FK ${refs.length}개(${describeRefs(refs)})의 FK 표시와 참조가 해제됩니다. 컬럼은 남습니다.\n휴지통이 없어 되돌릴 수 없습니다. 삭제할까요?`
      )
    ) {
      return;
    }
    updateCurrentProject({
      tables: clearReferences(currentProject.tables.filter((t) => t.id !== id), table.name),
    });
  };

  const handleAddColumn = (tableId: string, col: Omit<ErdColumn, 'id'>) => {
    const newCol: ErdColumn = {
      ...col,
      id: crypto.randomUUID(),
    };
    updateCurrentProject({
      tables: currentProject.tables.map((t) => (t.id === tableId ? { ...t, columns: [...t.columns, newCol] } : t)),
    });
  };

  const handleUpdateColumn = (tableId: string, colId: string, updated: Partial<ErdColumn>) => {
    const { name, ...rest } = updated;
    // [ERD 설계] 컬럼 이름을 바꾸면 입력할 때마다 FK 참조도 함께 바뀐다.
    const tables = name === undefined ? currentProject.tables : renameColumn(currentProject.tables, tableId, colId, name);
    updateCurrentProject({
      tables: tables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.map((c) => (c.id === colId ? { ...c, ...rest } : c)),
        };
      }),
    });
  };

  const handleDeleteColumn = (tableId: string, colId: string) => {
    const table = currentProject.tables.find((t) => t.id === tableId);
    const column = table?.columns.find((c) => c.id === colId);
    if (!table || !column) return;
    const refs = findReferences(currentProject.tables, table.name, column.name);
    if (
      refs.length > 0 &&
      !window.confirm(
        `'${table.name}.${column.name}'을(를) 참조하는 FK ${refs.length}개(${describeRefs(refs)})의 FK 표시와 참조가 해제됩니다. 삭제할까요?`
      )
    ) {
      return;
    }
    const cleared = clearReferences(currentProject.tables, table.name, column.name);
    updateCurrentProject({
      tables: cleared.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.filter((c) => c.id !== colId),
        };
      }),
    });
  };

  const handleUpdateTablePosition = (id: string, x: number, y: number) => {
    updateCurrentProject({
      tables: currentProject.tables.map((t) => (t.id === id ? { ...t, x, y } : t)),
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* [공통 화면] 프로젝트 전환이 있는 56px 전역 헤더 */}
      <Header
        projects={headerProjects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onCloneProject={handleCloneProject}
        title={currentProject.title}
        onUpdateTitle={(title) => updateCurrentProject({ title })}
        currentStep={currentProject.currentStep}
        onChangeStep={(step) => {
          setFollowId(null);
          setCurrentStep(step);
        }}
        stepLocks={currentProject.stepLocks}
        teamMembers={people}
        meId={me.id}
        onToggleSpotlight={(id) => setFollowId((prev) => (prev === id || id === me.id ? null : id))}
        activeSpotlightMember={followed}
        statusSlot={statusSlot}
        snapshots={snapshots}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onOpenExport={() => setIsExportOpen(true)}
      />

      <CollabBanner
        suspended={Boolean(accessError)}
        status={doc.status}
        message={doc.message}
        onRetry={doc.retry}
        onBackup={doc.downloadBackup}
        onReloadLatest={doc.reloadLatest}
        onReconnect={doc.reconnect}
      />

      {/* [공통 화면] 크기 조절 사이드바가 있는 분할 작업 공간 */}
      <main className="flex-1 flex overflow-hidden">
        {currentProject.currentStep === 1 && (
          <Step1IdeaBoard
            key={currentProject.id}
            features={currentProject.features}
            projectSummary={currentProject.summary}
            onUpdateSummary={(summary) => updateCurrentProject({ summary })}
            cards={currentProject.ideas}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onVoteCard={handleVoteCard}
            onAddComment={handleAddComment}
            teamMembers={teamMembers}
            isLocked={currentProject.stepLocks[1] || doc.status === 'readonly'}
            sidebarWidth={sidebarWidth}
            onStartResize={handleStartResize}
            onResetResize={handleResetSidebarWidth}
            mobileTab={mobileTab}
            onChangeMobileTab={setMobileTab}
            isDesktop={isDesktop}
          />
        )}

        {currentProject.currentStep === 2 && (
          <Step2FeatureSpec
            features={currentProject.features}
            onAddFeature={handleAddFeature}
            onUpdateFeature={handleUpdateFeature}
            onDeleteFeature={handleDeleteFeature}
            onImportFromStep1={handleImportFromStep1}
            ideas={currentProject.ideas}
            teamMembers={teamMembers}
            isLocked={currentProject.stepLocks[2]}
            excelUrl={`/api/projects/${currentProject.id}/api-spec.xlsx`}
            sidebarWidth={sidebarWidth}
            onStartResize={handleStartResize}
            onResetResize={handleResetSidebarWidth}
            mobileTab={mobileTab}
            onChangeMobileTab={setMobileTab}
            isDesktop={isDesktop}
          />
        )}

        {currentProject.currentStep === 3 && (
          <Step3Architecture
            nodes={currentProject.nodes}
            connections={currentProject.connections}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onUpdateNodePosition={handleUpdateNodePosition}
            onDeleteNode={handleDeleteNode}
            onAddConnection={handleAddConnection}
            onUpdateConnection={handleUpdateConnection}
            onDeleteConnection={handleDeleteConnection}
            isLocked={currentProject.stepLocks[3]}
            sidebarWidth={architectureSidebarWidth}
            onStartResize={handleStartResize}
            onResetResize={handleResetSidebarWidth}
            mobileTab={mobileTab}
            onChangeMobileTab={setMobileTab}
            isDesktop={isDesktop}
          />
        )}

        {currentProject.currentStep === 4 && (
          <Step4ErdStudio
            tables={currentProject.tables}
            features={currentProject.features}
            targetDbms={previewDbms}
            onChangeTargetDbms={handleChangeTargetDbms}
            onAddTable={handleAddTable}
            onUpdateTable={handleUpdateTable}
            onRenameTable={handleRenameTable}
            onDeleteTable={handleDeleteTable}
            onAddColumn={handleAddColumn}
            onUpdateColumn={handleUpdateColumn}
            onDeleteColumn={handleDeleteColumn}
            onUpdateTablePosition={handleUpdateTablePosition}
            isLocked={currentProject.stepLocks[4]}
            sidebarWidth={sidebarWidth}
            onStartResize={handleStartResize}
            onResetResize={handleResetSidebarWidth}
            mobileTab={mobileTab}
            onChangeMobileTab={setMobileTab}
            isDesktop={isDesktop}
          />
        )}
      </main>

      {/* [명세서 생성] 현재 프로젝트 DBMS를 쓰는 내보내기 모달(SQL DDL / Markdown) */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projectTitle={currentProject.title}
        projectSummary={currentProject.summary}
        ideas={currentProject.ideas}
        features={currentProject.features}
        nodes={currentProject.nodes}
        connections={currentProject.connections}
        tables={currentProject.tables}
        defaultDbms={previewDbms}
      />

      {/* [채팅] 편집하면서 팀원과 이야기하는 대화창 */}
      <ChatPanel
        access={access}
        key={currentProject.id}
        projectId={currentProject.id}
        meId={me.id}
        readOnly={doc.status === 'readonly'}
        names={Object.fromEntries(teamMembers.map((m) => [m.id, m.name]))}
      />

      {toastStack}
    </div>
  );
}

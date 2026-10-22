import React, { useState } from 'react';
import { 
  Layers, 
  Download, 
  Lock, 
  Unlock, 
  History, 
  Eye, 
  CheckCircle2, 
  Edit3, 
  Check, 
  Radio, 
  FileCode2, 
  FolderKanban, 
  ChevronDown, 
  Plus, 
  Briefcase, 
  Copy, 
  Trash2, 
  Database,
  Menu,
  X
} from 'lucide-react';
import type { StepNumber, TeamMember, SnapshotHistory, ProjectData, SqlDialect } from '../types/index.ts';

interface HeaderProps {
  projects: ProjectData[];
  currentProject: ProjectData;
  onSelectProject: (id: string) => void;
  onCreateProject: (title: string, summary: string, categoryTag: string, targetDbms: SqlDialect) => void;
  onCloneProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  title: string;
  onUpdateTitle: (title: string) => void;
  currentStep: StepNumber;
  onChangeStep: (step: StepNumber) => void;
  stepLocks: Record<StepNumber, boolean>;
  teamMembers: TeamMember[];
  /** [협업 상태] 내 아바타는 따라가기 대상에서 뺀다. */
  meId?: string;
  onToggleSpotlight: (memberId: string) => void;
  activeSpotlightMember: TeamMember | null;
  snapshots: SnapshotHistory[];
  onSaveSnapshot: (name: string) => void;
  onRestoreSnapshot: (id: string) => void;
  onOpenExport: () => void;
  /** [협업 상태] 팀 아바타 앞에 보이는 저장 상태와 계정 버튼. */
  statusSlot?: React.ReactNode;
}

const DBMS_OPTIONS: { id: SqlDialect; label: string }[] = [
  { id: 'postgres', label: 'PostgreSQL 16' },
  { id: 'mysql', label: 'MySQL 8.0' },
  { id: 'mariadb', label: 'MariaDB 11' },
  { id: 'oracle', label: 'Oracle 19c/21c' },
  { id: 'mssql', label: 'MS SQL Server' },
  { id: 'sqlite', label: 'SQLite 3' },
  { id: 'prisma', label: 'Prisma Schema' },
];

export const Header: React.FC<HeaderProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  onCloneProject,
  onDeleteProject,
  title,
  onUpdateTitle,
  currentStep,
  onChangeStep,
  stepLocks,
  teamMembers,
  meId,
  onToggleSpotlight,
  activeSpotlightMember,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onOpenExport,
  statusSlot,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [showSnapshotMenu, setShowSnapshotMenu] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');

  // [프로젝트] 프로젝트 전환 모달/드롭다운
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjSummary, setNewProjSummary] = useState('');
  const [newProjCategory, setNewProjCategory] = useState('사내 솔루션');
  const [newProjDbms, setNewProjDbms] = useState<SqlDialect>('postgres');

  const steps = [
    { num: 1 as StepNumber, label: '1. 아이디어', fullLabel: 'Step 1. 아이디어 보드' },
    { num: 2 as StepNumber, label: '2. API 명세', fullLabel: 'Step 2. 기능·API 명세' },
    { num: 3 as StepNumber, label: '3. 아키텍처', fullLabel: 'Step 3. 시스템 아키텍처' },
    { num: 4 as StepNumber, label: '4. DB 설계', fullLabel: 'Step 4. DB(ERD) 설계' },
  ];

  const handleTitleSubmit = () => {
    if (tempTitle.trim()) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
    setIsEditingTitle(false);
  };

  const handleCreateSnapshot = () => {
    const name = newSnapshotName.trim() || `스냅샷 #${snapshots.length + 1}`;
    onSaveSnapshot(name);
    setNewSnapshotName('');
    setShowSnapshotMenu(false);
  };

  const handleCreateNewProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim()) return;
    onCreateProject(
      newProjTitle.trim(),
      newProjSummary.trim() || `${newProjTitle} 시스템`,
      newProjCategory.trim() || '신규 프로젝트',
      newProjDbms
    );
    setNewProjTitle('');
    setNewProjSummary('');
    setShowNewProjectModal(false);
    setShowProjectDropdown(false);
  };

  return (
    // [공통 화면] 모바일에서는 2줄: 프로젝트·버튼 줄 아래에 단계 탭이 전체 폭으로 온다.
    <header className="min-h-14 lg:h-14 py-1.5 lg:py-0 flex-wrap lg:flex-nowrap bg-slate-900 border-b border-slate-800 text-slate-100 px-2 sm:px-4 flex items-center justify-between select-none relative z-50 shrink-0 gap-2 overflow-visible">
      {/* [공통 화면] 왼쪽: 브랜드, 프로젝트 전환, 상태 */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 lg:flex-none lg:shrink-0">
        {/* [공통 화면] 브랜드 */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 font-bold tracking-tight text-indigo-400 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/20">
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="hidden xl:inline text-sm sm:text-base bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
            SyncArch
          </span>
        </div>

        <div className="h-4 w-px bg-slate-700/80 mx-0.5 hidden sm:block" />

        {/* [프로젝트] 프로젝트 선택 드롭다운 */}
        <div className="relative min-w-0">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors max-w-full sm:max-w-[180px] lg:max-w-[130px] xl:max-w-[240px]"
            title="프로젝트 목록 조회 및 전환"
          >
            <FolderKanban className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">{currentProject.title}</span>
            <span className="hidden xl:inline-block text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/40 shrink-0 uppercase font-mono">
              {currentProject.targetDbms}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {showProjectDropdown && (
            <>
              {/* [프로젝트] 바깥을 누르면 드롭다운을 닫는 배경 */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowProjectDropdown(false)} 
              />
              <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-700/60">
                <div className="px-2 py-1.5 font-bold text-slate-300 flex items-center justify-between border-b border-slate-800 mb-1.5">
                  <span>등록된 설계 프로젝트 ({projects.length})</span>
                  <button
                    onClick={() => {
                      setShowProjectDropdown(false);
                      setShowNewProjectModal(true);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>새 프로젝트</span>
                  </button>
                </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {projects.map((proj) => {
                  const isSelected = proj.id === currentProject.id;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj.id);
                        setShowProjectDropdown(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-start justify-between gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/20 border border-indigo-500/50 text-white font-semibold shadow'
                          : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-xs text-slate-100">{proj.title}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 font-mono font-bold shrink-0">
                            {proj.targetDbms.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate">{proj.summary}</span>
                        {/* [프로젝트] 열린 프로젝트의 문서만 불러오므로 개수도 그 프로젝트만 있다. */}
                        {isSelected && (
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            테이블 {proj.tables?.length || 0}개 · 기능 {proj.features?.length || 0}개
                          </div>
                        )}
                      </div>

                      {/* [프로젝트] 복제·삭제 버튼 */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        {onCloneProject && (
                          <button
                            onClick={() => {
                              onCloneProject(proj.id);
                              setShowProjectDropdown(false);
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-300"
                            title="프로젝트 복제"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteProject && projects.length > 1 && (
                          <button
                            onClick={() => {
                              if (confirm(`'${proj.title}' 프로젝트를 삭제하시겠습니까?`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="프로젝트 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-800 mt-2.5 pt-2">
                <button
                  onClick={() => {
                    setShowProjectDropdown(false);
                    setShowNewProjectModal(true);
                  }}
                  className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-center text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>신규 설계 프로젝트 등록</span>
                </button>
              </div>
            </div>
            </>
          )}
        </div>

        {/* [공통 화면] 스냅샷 드롭다운 */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowSnapshotMenu(!showSnapshotMenu)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            title="스냅샷 히스토리 및 복원"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">스냅샷 ({snapshots.length})</span>
          </button>

          {showSnapshotMenu && (
            <>
              {/* [공통 화면] 바깥을 누르면 닫는 배경 */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowSnapshotMenu(false)} 
              />
              <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-700/60">
                <div className="font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>스냅샷 히스토리</span>
                  <span className="text-[10px] text-slate-500">{snapshots.length}개 저장됨</span>
                </div>
                <div className="flex gap-1.5 mb-3">
                  <input
                    type="text"
                    placeholder="새 스냅샷 이름..."
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleCreateSnapshot}
                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-[11px] shrink-0"
                  >
                    저장
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border-t border-slate-800 pt-2">
                  {snapshots.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-1">저장된 스냅샷이 없습니다.</p>
                  ) : (
                    snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800 group transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{snap.name}</span>
                          <span className="text-[10px] text-slate-500">{snap.dateStr}</span>
                        </div>
                        <button
                          onClick={() => {
                            onRestoreSnapshot(snap.id);
                            setShowSnapshotMenu(false);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded bg-slate-700 hover:bg-indigo-600 text-[10px] text-white font-medium transition-all"
                        >
                          복원
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* [공통 화면] 가운데: 4단계 전환 */}
      <nav className="order-last w-full lg:order-none lg:w-auto flex items-center min-w-0 overflow-x-auto bg-slate-950/70 p-0.5 sm:p-1 rounded-xl border border-slate-800/80 shadow-inner">
        {steps.map((st) => {
          const isActive = currentStep === st.num;
          const isLocked = stepLocks[st.num];

          return (
            <button
              key={st.num}
              onClick={() => onChangeStep(st.num)}
              aria-label={st.fullLabel}
              title={st.fullLabel}
              className={`relative flex-1 lg:flex-none justify-center px-2 sm:px-3 py-2.5 lg:py-1.5 rounded-lg text-sm lg:text-xs font-semibold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>{st.label}</span>
              {isLocked && <Lock className="w-3 h-3 text-amber-400 ml-0.5 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* [공통 화면] 오른쪽: 팀, 잠금, 내보내기 */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {statusSlot}

        {/* [공통 화면] 단계 잠금 전환 */}
        <button
          disabled
          className={`hidden xl:block p-1.5 rounded-lg border transition-colors opacity-40 cursor-not-allowed ${
            stepLocks[currentStep]
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="단계 잠금은 현재 지원하지 않습니다"
        >
          {stepLocks[currentStep] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        {/* [멤버 관리] 팀원 아바타 */}
        <div className="hidden lg:flex items-center gap-1 border-l border-slate-800 pl-2">
          {activeSpotlightMember && (
            <span className="mr-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 whitespace-nowrap">
              {activeSpotlightMember.name} 따라가는 중
            </span>
          )}
          {teamMembers.map((member) => {
            const isSpotlight = activeSpotlightMember?.id === member.id;
            const isMe = member.id === meId;
            // [협업 상태] 접속 중이면 초록 점과 보고 있는 단계 번호를 보여 준다.
            const where = member.isOnline ? `Step ${member.currentStep} 보는 중` : '오프라인';
            return (
              <button
                key={member.id}
                onClick={() => onToggleSpotlight(member.id)}
                disabled={isMe || !member.isOnline}
                aria-pressed={isSpotlight}
                className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-transform ${
                  member.avatarBg
                } ${
                  isSpotlight
                    ? 'ring-2 ring-amber-400 scale-110 shadow-lg shadow-amber-500/30'
                    : member.isOnline
                      ? 'hover:scale-105 opacity-95'
                      : 'opacity-35 grayscale'
                } disabled:cursor-default`}
                title={`${member.name}${isMe ? ' (나)' : ''} · ${member.role} · ${where}${isMe || !member.isOnline ? '' : isSpotlight ? ' · 눌러서 따라가기 끄기' : ' · 눌러서 이 사람 화면 따라가기'}`}
              >
                {member.name.charAt(0)}
                {member.isOnline && (
                  <>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
                    <span className="absolute -top-1.5 -right-1.5 min-w-[12px] h-3 px-0.5 rounded-full bg-slate-900 text-[8px] leading-3 text-slate-200 border border-slate-600">
                      {member.currentStep}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* [명세서 생성] 내보내기 모달 열기 버튼 */}
        <button
          onClick={onOpenExport}
          aria-label="내보내기 (SQL / MD)"
          className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">내보내기 (SQL / MD)</span>
          <span className="hidden sm:inline 2xl:hidden">내보내기</span>
        </button>
      </div>

      {/* [프로젝트] 새 프로젝트 등록 모달 */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 text-xs text-slate-100">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span>신규 설계 프로젝트 등록</span>
              </h3>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-slate-400 hover:text-white"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleCreateNewProjectSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300">프로젝트명</label>
                <input
                  type="text"
                  placeholder="예: 사내 기술 블로그 &amp; Q&amp;A 지식 허브"
                  value={newProjTitle}
                  onChange={(e) => setNewProjTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">프로젝트 한 줄 요약 / 목표</label>
                <input
                  type="text"
                  placeholder="예: 개발팀 내부 기술 지식 공유 및 검색 시스템"
                  value={newProjSummary}
                  onChange={(e) => setNewProjSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">카테고리</label>
                  <input
                    type="text"
                    placeholder="예: 생산성 / DevTools"
                    value={newProjCategory}
                    onChange={(e) => setNewProjCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Database className="w-3 h-3 text-sky-400" /> 목표 DBMS
                  </label>
                  <select
                    value={newProjDbms}
                    onChange={(e) => setNewProjDbms(e.target.value as SqlDialect)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none font-mono"
                  >
                    {DBMS_OPTIONS.map((db) => (
                      <option key={db.id} value={db.id}>
                        {db.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newProjTitle.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-bold shadow"
                >
                  프로젝트 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

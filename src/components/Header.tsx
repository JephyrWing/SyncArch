import React, { useState } from 'react';
import { 
  Layers, 
  Sparkles, 
  Download, 
  Lock, 
  Unlock, 
  History, 
  Eye, 
  CheckCircle2, 
  Edit3,
  Check,
  Radio,
  FileCode2
} from 'lucide-react';
import type { StepNumber, TeamMember, SnapshotHistory } from '../types/index.ts';

interface HeaderProps {
  title: string;
  onUpdateTitle: (title: string) => void;
  currentStep: StepNumber;
  onChangeStep: (step: StepNumber) => void;
  stepLocks: Record<StepNumber, boolean>;
  onToggleLock: (step: StepNumber) => void;
  teamMembers: TeamMember[];
  onToggleSpotlight: (memberId: string) => void;
  activeSpotlightMember: TeamMember | null;
  snapshots: SnapshotHistory[];
  onSaveSnapshot: (name: string) => void;
  onRestoreSnapshot: (id: string) => void;
  onOpenExport: () => void;
  onOpenAiDraft: () => void;
  isAiGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onUpdateTitle,
  currentStep,
  onChangeStep,
  stepLocks,
  onToggleLock,
  teamMembers,
  onToggleSpotlight,
  activeSpotlightMember,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onOpenExport,
  onOpenAiDraft,
  isAiGenerating,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [showSnapshotMenu, setShowSnapshotMenu] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');

  const steps = [
    { num: 1 as StepNumber, label: 'Step 1. 아이디어 보드' },
    { num: 2 as StepNumber, label: 'Step 2. 기능·API 명세' },
    { num: 3 as StepNumber, label: 'Step 3. 시스템 아키텍처' },
    { num: 4 as StepNumber, label: 'Step 4. DB(ERD) 설계' },
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

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 text-slate-100 px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand, Project Title & Sync Status */}
      <div className="flex items-center gap-3 min-w-[280px]">
        <div className="flex items-center gap-2 font-bold tracking-tight text-indigo-400">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-base bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
            SyncArch
          </span>
        </div>

        <div className="h-4 w-px bg-slate-700/80 mx-0.5" />

        {/* Project Title inline editor */}
        {isEditingTitle ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              onBlur={handleTitleSubmit}
              autoFocus
              className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-56 font-medium"
            />
            <button
              onClick={handleTitleSubmit}
              className="p-1 text-emerald-400 hover:text-emerald-300"
              title="저장"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setTempTitle(title);
              setIsEditingTitle(true);
            }}
            className="group flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white max-w-[220px] truncate px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            title="클릭하여 프로젝트명 수정"
          >
            <span className="truncate">{title}</span>
            <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-slate-300 opacity-60 group-hover:opacity-100 shrink-0" />
          </button>
        )}

        {/* Live Sync badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>CRDT Live</span>
        </div>

        {/* Snapshot Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSnapshotMenu(!showSnapshotMenu)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            title="스냅샷 히스토리 및 복원"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">스냅샷 ({snapshots.length})</span>
          </button>

          {showSnapshotMenu && (
            <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100">
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
                      <div className="truncate mr-2">
                        <div className="font-medium text-slate-200 truncate">{snap.name}</div>
                        <div className="text-[10px] text-slate-500">{snap.dateStr}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`'${snap.name}' 시점으로 복원하시겠습니까?`)) {
                            onRestoreSnapshot(snap.id);
                            setShowSnapshotMenu(false);
                          }
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/50 hover:bg-indigo-900/80 shrink-0"
                      >
                        복원
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: 4-Step Pipeline Switcher */}
      <nav aria-label="Pipeline Steps" className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 shadow-inner">
        {steps.map((s) => {
          const isActive = currentStep === s.num;
          const isLocked = stepLocks[s.num];
          return (
            <div key={s.num} className="flex items-center">
              <button
                data-testid={`step-btn-${s.num}`}
                onClick={() => onChangeStep(s.num)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLocked ? 'bg-amber-400 ring-2 ring-amber-500/30' : isActive ? 'bg-white' : 'bg-slate-600'
                  }`}
                />
                <span>{s.label}</span>
                {isLocked && <Lock className="w-3 h-3 text-amber-300 ml-0.5 inline shrink-0" />}
              </button>
              {s.num < 4 && <div className="w-2.5 h-0.5 bg-slate-800 mx-0.5 rounded-full" />}
            </div>
          );
        })}

        {/* Step Lock Toggle Button */}
        <div className="h-4 w-px bg-slate-800 mx-1.5" />
        <button
          onClick={() => onToggleLock(currentStep)}
          className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
            stepLocks[currentStep]
              ? 'bg-amber-950/70 text-amber-300 border border-amber-600/40 hover:bg-amber-900/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={stepLocks[currentStep] ? '현재 단계 잠금 해제' : '현재 단계 확정 잠금 (수정 방지)'}
        >
          {stepLocks[currentStep] ? (
            <>
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">잠김</span>
            </>
          ) : (
            <>
              <Unlock className="w-3 h-3" />
              <span className="hidden sm:inline">확정</span>
            </>
          )}
        </button>
      </nav>

      {/* Right: Team Avatars (5 Collaborators), Spotlight, AI Draft, Export */}
      <div className="flex items-center gap-2.5">
        {/* Spotlight Follow indicator banner if active */}
        {activeSpotlightMember && (
          <div className="hidden 2xl:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 animate-pulse">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeSpotlightMember.name} 팔로우 중 (Step {activeSpotlightMember.currentStep})</span>
          </div>
        )}

        {/* 5-Person Avatar Group */}
        <div className="flex items-center -space-x-1.5 hover:space-x-1 transition-all">
          {teamMembers.map((member) => {
            const isSpot = member.isSpotlight;
            return (
              <button
                key={member.id}
                onClick={() => onToggleSpotlight(member.id)}
                className={`relative group rounded-full transition-transform hover:scale-110 focus:outline-none ${
                  isSpot ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 z-10 scale-105' : 'hover:z-10'
                }`}
                title={`${member.name} (${member.role}) - 현재 Step ${member.currentStep} 작업 중\n클릭 시 팔로우(Spotlight) 모드 토글`}
              >
                <div
                  className={`w-7 h-7 rounded-full ${member.avatarBg} text-white font-bold text-[10px] flex items-center justify-center border-2 border-slate-900 shadow`}
                >
                  {member.name.slice(0, 1)}
                </div>
                {/* Step badge pill */}
                <span className="absolute -bottom-1 -right-1 bg-slate-900 text-slate-300 text-[9px] font-bold px-1 rounded-full border border-slate-700 leading-tight">
                  S{member.currentStep}
                </span>

                {/* Hover Tooltip */}
                <div className="absolute right-0 top-9 hidden group-hover:block bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded p-1.5 shadow-xl whitespace-nowrap z-50 pointer-events-none">
                  <div className="font-semibold text-white flex items-center gap-1">
                    <span>{member.name}</span>
                    <span className="text-[9px] px-1 py-0.2 bg-slate-700 rounded text-sky-300 font-mono">
                      {member.badge}
                    </span>
                  </div>
                  <div className="text-slate-400">{member.role}</div>
                  <div className="text-amber-400 font-medium mt-0.5">
                    {isSpot ? '★ 팔로우 활성화됨' : '클릭하여 화면 팔로우'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* AI Co-Architect Button */}
        <button
          data-testid="btn-ai-draft"
          onClick={onOpenAiDraft}
          disabled={isAiGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
          title="현재 단계에 대한 AI Co-Architect 초안 제안 생성 (Diff & Accept 방식)"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">AI 초안 생성</span>
        </button>

        {/* Export Button */}
        <button
          data-testid="btn-export"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-100 font-semibold text-xs active:scale-95 transition-all shadow-sm"
          title="PostgreSQL/MySQL/SQLite/Prisma DDL 및 Markdown 명세서 추출"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">내보내기 (SQL / MD)</span>
        </button>
      </div>
    </header>
  );
};

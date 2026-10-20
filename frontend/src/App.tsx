/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { Step1IdeaBoard } from './components/Step1IdeaBoard.tsx';
import { Step2FeatureSpec } from './components/Step2FeatureSpec.tsx';
import { Step3Architecture } from './components/Step3Architecture.tsx';
import { Step4ErdStudio } from './components/Step4ErdStudio.tsx';
import { ExportModal } from './components/ExportModal.tsx';
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
  SqlDialect,
  ArchVersion
} from './types/index.ts';
import { 
  INITIAL_MEMBERS, 
  INITIAL_PROJECTS 
} from './data/initialData.ts';

export default function App() {
  // Multi-Project State
  const [projects, setProjects] = useState<ProjectData[]>(INITIAL_PROJECTS);
  const [currentProjectId, setCurrentProjectId] = useState<string>(INITIAL_PROJECTS[0].id);

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  // 5 Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [activeSpotlightMemberId, setActiveSpotlightMemberId] = useState<string | null>(null);

  // Snapshots
  const [snapshots, setSnapshots] = useState<SnapshotHistory[]>([
    {
      id: 'snap-init',
      name: '초기 MVP 기획안 (v1.0)',
      timestamp: Date.now() - 3600000,
      dateStr: '1시간 전',
    },
  ]);
  const [snapshotStore, setSnapshotStore] = useState<Record<string, any>>({
    'snap-init': JSON.parse(JSON.stringify(INITIAL_PROJECTS[0])),
  });

  // Responsive Viewport Detection (Mobile / Tablet / Desktop)
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

  // Resizable Sidebar & Responsive State (persisted)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('syncarch_sidebar_width');
      return saved ? Math.min(65, Math.max(22, parseFloat(saved))) : 40;
    } catch {
      return 40;
    }
  });
  const [mobileTab, setMobileTab] = useState<'editor' | 'canvas'>('editor');

  // Drag resizer handler
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let latestWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const totalWidth = window.innerWidth;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / totalWidth) * 100;
      const newWidth = Math.min(65, Math.max(20, startWidth + deltaPercent));
      latestWidth = newWidth;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      try {
        localStorage.setItem('syncarch_sidebar_width', latestWidth.toString());
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
    setSidebarWidth(40);
    try {
      localStorage.setItem('syncarch_sidebar_width', '40');
    } catch {}
  };

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Helper to update current project data
  const updateCurrentProject = (updatedFields: Partial<ProjectData>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === currentProjectId ? { ...p, ...updatedFields, updatedAt: '방금 전' } : p))
    );
  };

  // Switch Project
  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
  };

  // Create New Project with specified DBMS
  const handleCreateProject = (
    title: string, 
    summary: string, 
    categoryTag: string, 
    targetDbms: SqlDialect = 'postgres'
  ) => {
    const newProjId = `proj-${Date.now()}`;
    const newProject: ProjectData = {
      id: newProjId,
      title,
      summary,
      categoryTag,
      targetDbms,
      currentStep: 1,
      stepLocks: { 1: false, 2: false, 3: false, 4: false },
      ideas: [
        {
          id: `idea-init-${Date.now()}`,
          category: 'problems_goals',
          title: `${title} 핵심 과제 정의`,
          description: summary,
          author: '현우',
          votes: 1,
          votedBy: ['현우'],
          rationale: `${title} 구축을 통해 기존의 비효율 문제를 해결하고자 함`,
          decisionStatus: 'REVIEW',
          comments: [],
        },
      ],
      features: [
        {
          id: 'FEAT-01',
          domain: '코어',
          name: `${title} 초기 데이터 조회`,
          priority: 'P0',
          assignee: '현우',
          method: 'GET',
          endpoint: '/api/v1/items',
          requestFields: 'page: number, limit: number',
          responseFields: 'items: array, total: number',
          summary: '기본 목록 조회',
          status: 'PLANNED',
        },
      ],
      nodes: [
        { id: `node-web-${Date.now()}`, category: 'Client', name: 'Web Dashboard', techStack: ['React', 'Tailwind'], x: 80, y: 150, description: '관리자 대시보드', assignedTeam: 'Frontend' },
        { id: `node-api-${Date.now()}`, category: 'Service', name: 'Core Backend API', techStack: ['NestJS', 'TypeScript'], x: 420, y: 150, description: '비즈니스 로직 처리', assignedTeam: 'Backend' },
        { id: `node-db-${Date.now()}`, category: 'DataStore', name: 'Primary DB', techStack: [targetDbms === 'mysql' ? 'MySQL 8.0' : targetDbms === 'oracle' ? 'Oracle 19c' : 'PostgreSQL 16'], x: 750, y: 150, description: '영구 스토리지', assignedTeam: 'Infra' },
      ],
      connections: [],
      archVersions: [
        {
          id: `ver-${Date.now()}`,
          versionNumber: 'v1.0 (초기 계획)',
          label: '기본 3-Tier 아키텍처',
          description: 'Client -> Service -> DB 기본 레이어',
          createdAt: '방금 전',
          nodes: [],
          connections: [],
        },
      ],
      currentArchVersionId: `ver-${Date.now()}`,
      tables: [
        {
          id: `tbl-${Date.now()}`,
          name: 'users',
          comment: '사용자 계정',
          relatedFeatureIds: ['FEAT-01'],
          x: 100,
          y: 100,
          columns: [
            { id: 'c1', name: 'id', dataType: targetDbms === 'mysql' ? 'VARCHAR(36)' : 'UUID', isPrimaryKey: true, isForeignKey: false, isUnique: true, isNullable: false, comment: '식별자' },
            { id: 'c2', name: 'created_at', dataType: targetDbms === 'mysql' ? 'DATETIME(6)' : 'TIMESTAMPTZ', isPrimaryKey: false, isForeignKey: false, isUnique: false, isNullable: false, defaultValue: 'CURRENT_TIMESTAMP', comment: '생성 시각' },
          ],
        },
      ],
      updatedAt: '방금 전',
    };

    setProjects([...projects, newProject]);
    setCurrentProjectId(newProjId);
  };

  // Clone Project
  const handleCloneProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    const clonedId = `proj-clone-${Date.now()}`;
    const cloned: ProjectData = {
      ...JSON.parse(JSON.stringify(target)),
      id: clonedId,
      title: `${target.title} (복사본)`,
      updatedAt: '방금 전',
    };
    setProjects([...projects, cloned]);
    setCurrentProjectId(clonedId);
  };

  // Delete Project
  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (currentProjectId === id) {
      setCurrentProjectId(remaining[0].id);
    }
  };

  // Step Lock Toggle
  const handleToggleLock = (step: StepNumber) => {
    updateCurrentProject({
      stepLocks: {
        ...currentProject.stepLocks,
        [step]: !currentProject.stepLocks[step],
      },
    });
  };

  // Spotlight Follow Mode
  const handleToggleSpotlight = (memberId: string) => {
    if (activeSpotlightMemberId === memberId) {
      setActiveSpotlightMemberId(null);
      setTeamMembers((prev) => prev.map((m) => ({ ...m, isSpotlight: false })));
    } else {
      setActiveSpotlightMemberId(memberId);
      const target = teamMembers.find((m) => m.id === memberId);
      if (target) {
        updateCurrentProject({ currentStep: target.currentStep });
      }
      setTeamMembers((prev) =>
        prev.map((m) => ({
          ...m,
          isSpotlight: m.id === memberId,
        }))
      );
    }
  };

  const activeSpotlightMember = teamMembers.find((m) => m.id === activeSpotlightMemberId) || null;

  // Snapshot Handlers
  const handleSaveSnapshot = (name: string) => {
    const id = `snap-${Date.now()}`;
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
    if (saved) {
      updateCurrentProject(saved);
    }
  };

  // Step 1 Handlers
  const handleAddCard = (card: Omit<IdeaCard, 'id' | 'votes' | 'votedBy' | 'comments'>) => {
    const newCard: IdeaCard = {
      ...card,
      id: `idea-${Date.now()}`,
      votes: 1,
      votedBy: [card.author],
      comments: [],
    };
    updateCurrentProject({ ideas: [newCard, ...currentProject.ideas] });
  };

  const handleUpdateCard = (id: string, updated: Partial<IdeaCard>) => {
    updateCurrentProject({
      ideas: currentProject.ideas.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    });
  };

  const handleDeleteCard = (id: string) => {
    updateCurrentProject({
      ideas: currentProject.ideas.filter((c) => c.id !== id),
    });
  };

  const handleVoteCard = (cardId: string, memberName: string) => {
    updateCurrentProject({
      ideas: currentProject.ideas.map((card) => {
        if (card.id === cardId) {
          const already = card.votedBy.includes(memberName);
          return {
            ...card,
            votes: already ? Math.max(0, card.votes - 1) : card.votes + 1,
            votedBy: already
              ? card.votedBy.filter((v) => v !== memberName)
              : [...card.votedBy, memberName],
          };
        }
        return card;
      }),
    });
  };

  const handleAddComment = (cardId: string, author: string, text: string) => {
    updateCurrentProject({
      ideas: currentProject.ideas.map((card) => {
        if (card.id === cardId) {
          return {
            ...card,
            comments: [
              ...card.comments,
              {
                id: `comm-${Date.now()}`,
                author,
                text,
                createdAt: '방금 전',
              },
            ],
          };
        }
        return card;
      }),
    });
  };

  // Step 2 Handlers
  const handleAddFeature = (feat: Omit<FeatureSpec, 'id'>) => {
    const newId = `FEAT-${String(currentProject.features.length + 1).padStart(2, '0')}`;
    const newFeature: FeatureSpec = {
      ...feat,
      id: newId,
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
    const highVoteIdeas = currentProject.ideas.filter((i) => i.votes >= 4);
    const existingStoryIds = new Set(currentProject.features.map((f) => f.relatedStoryId).filter(Boolean));

    const newFeatures: FeatureSpec[] = [];
    let count = currentProject.features.length + 1;

    highVoteIdeas.forEach((idea) => {
      if (!existingStoryIds.has(idea.id)) {
        newFeatures.push({
          id: `FEAT-${String(count).padStart(2, '0')}`,
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

  // Step 3 Handlers & Versioning
  const handleAddNode = (node: Omit<ArchNode, 'id'>) => {
    const newNode: ArchNode = {
      ...node,
      id: `node-${Date.now()}`,
    };
    updateCurrentProject({ nodes: [...currentProject.nodes, newNode] });
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
    const newConn: ArchConnection = {
      ...conn,
      id: `conn-${Date.now()}`,
    };
    updateCurrentProject({ connections: [...currentProject.connections, newConn] });
  };

  const handleDeleteConnection = (id: string) => {
    updateCurrentProject({
      connections: currentProject.connections.filter((c) => c.id !== id),
    });
  };

  const handleSwitchArchVersion = (versionId: string) => {
    const targetVer = currentProject.archVersions.find((v) => v.id === versionId);
    if (targetVer) {
      updateCurrentProject({
        currentArchVersionId: versionId,
        nodes: JSON.parse(JSON.stringify(targetVer.nodes)),
        connections: JSON.parse(JSON.stringify(targetVer.connections)),
      });
    }
  };

  const handleSaveNewArchVersion = (versionNumber: string, label: string, description: string) => {
    const newVerId = `ver-${Date.now()}`;
    const newVersion: ArchVersion = {
      id: newVerId,
      versionNumber,
      label,
      description,
      createdAt: new Date().toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      nodes: JSON.parse(JSON.stringify(currentProject.nodes)),
      connections: JSON.parse(JSON.stringify(currentProject.connections)),
    };

    updateCurrentProject({
      archVersions: [...currentProject.archVersions, newVersion],
      currentArchVersionId: newVerId,
    });
  };

  // Step 4 Handlers & Target DBMS
  const handleChangeTargetDbms = (dbms: SqlDialect) => {
    updateCurrentProject({ targetDbms: dbms });
  };

  const handleAddTable = (table: Omit<ErdTable, 'id'>) => {
    const newTable: ErdTable = {
      ...table,
      id: `tbl-${Date.now()}`,
    };
    updateCurrentProject({ tables: [...currentProject.tables, newTable] });
  };

  const handleUpdateTable = (id: string, updated: Partial<ErdTable>) => {
    updateCurrentProject({
      tables: currentProject.tables.map((t) => (t.id === id ? { ...t, ...updated } : t)),
    });
  };

  const handleDeleteTable = (id: string) => {
    updateCurrentProject({
      tables: currentProject.tables.filter((t) => t.id !== id),
    });
  };

  const handleAddColumn = (tableId: string, col: Omit<ErdColumn, 'id'>) => {
    const newCol: ErdColumn = {
      ...col,
      id: `col-${Date.now()}`,
    };
    updateCurrentProject({
      tables: currentProject.tables.map((t) => (t.id === tableId ? { ...t, columns: [...t.columns, newCol] } : t)),
    });
  };

  const handleUpdateColumn = (tableId: string, colId: string, updated: Partial<ErdColumn>) => {
    updateCurrentProject({
      tables: currentProject.tables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.map((c) => (c.id === colId ? { ...c, ...updated } : c)),
        };
      }),
    });
  };

  const handleDeleteColumn = (tableId: string, colId: string) => {
    updateCurrentProject({
      tables: currentProject.tables.map((t) => {
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
      {/* 56px Global Header with Project Switcher */}
      <Header
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onCloneProject={handleCloneProject}
        onDeleteProject={handleDeleteProject}
        title={currentProject.title}
        onUpdateTitle={(title) => updateCurrentProject({ title })}
        currentStep={currentProject.currentStep}
        onChangeStep={(step) => updateCurrentProject({ currentStep: step })}
        stepLocks={currentProject.stepLocks}
        onToggleLock={handleToggleLock}
        teamMembers={teamMembers}
        onToggleSpotlight={handleToggleSpotlight}
        activeSpotlightMember={activeSpotlightMember}
        snapshots={snapshots}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Split-View Workspace with Resizable Sidebar */}
      <main className="flex-1 flex overflow-hidden">
        {currentProject.currentStep === 1 && (
          <Step1IdeaBoard
            projectSummary={currentProject.summary}
            onUpdateSummary={(summary) => updateCurrentProject({ summary })}
            cards={currentProject.ideas}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onVoteCard={handleVoteCard}
            onAddComment={handleAddComment}
            teamMembers={teamMembers}
            isLocked={currentProject.stepLocks[1]}
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
            onUpdateNodePosition={handleUpdateNodePosition}
            onDeleteNode={handleDeleteNode}
            onAddConnection={handleAddConnection}
            onDeleteConnection={handleDeleteConnection}
            archVersions={currentProject.archVersions}
            currentVersionId={currentProject.currentArchVersionId || currentProject.archVersions[0]?.id || ''}
            onSwitchVersion={handleSwitchArchVersion}
            onSaveNewVersion={handleSaveNewArchVersion}
            isLocked={currentProject.stepLocks[3]}
            sidebarWidth={sidebarWidth}
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
            targetDbms={currentProject.targetDbms}
            onChangeTargetDbms={handleChangeTargetDbms}
            onAddTable={handleAddTable}
            onUpdateTable={handleUpdateTable}
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

      {/* Export Engine Modal (SQL DDL / Markdown) with current project's DBMS */}
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
        defaultDbms={currentProject.targetDbms}
      />
    </div>
  );
}

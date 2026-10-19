/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header.tsx';
import { Step1IdeaBoard } from './components/Step1IdeaBoard.tsx';
import { Step2FeatureSpec } from './components/Step2FeatureSpec.tsx';
import { Step3Architecture } from './components/Step3Architecture.tsx';
import { Step4ErdStudio } from './components/Step4ErdStudio.tsx';
import { AiDraftModal } from './components/AiDraftModal.tsx';
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
  ErdColumn
} from './types/index.ts';
import { 
  INITIAL_MEMBERS, 
  INITIAL_IDEAS, 
  INITIAL_FEATURES, 
  INITIAL_NODES, 
  INITIAL_CONNECTIONS, 
  INITIAL_TABLES 
} from './data/initialData.ts';

export default function App() {
  const [projectTitle, setProjectTitle] = useState('사내 스터디 매칭 & 출석 관리 플랫폼');
  const [projectSummary, setProjectSummary] = useState('보증금 제도와 동적 QR을 활용한 사내 스터디 출석 관리 플랫폼');
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [stepLocks, setStepLocks] = useState<Record<StepNumber, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });

  // 5 Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [activeSpotlightMemberId, setActiveSpotlightMemberId] = useState<string | null>(null);

  // Core Data
  const [ideas, setIdeas] = useState<IdeaCard[]>(INITIAL_IDEAS);
  const [features, setFeatures] = useState<FeatureSpec[]>(INITIAL_FEATURES);
  const [nodes, setNodes] = useState<ArchNode[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<ArchConnection[]>(INITIAL_CONNECTIONS);
  const [tables, setTables] = useState<ErdTable[]>(INITIAL_TABLES);

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
    'snap-init': {
      projectTitle: '사내 스터디 매칭 & 출석 관리 플랫폼',
      projectSummary: '보증금 제도와 동적 QR을 활용한 사내 스터디 출석 관리 플랫폼',
      ideas: INITIAL_IDEAS,
      features: INITIAL_FEATURES,
      nodes: INITIAL_NODES,
      connections: INITIAL_CONNECTIONS,
      tables: INITIAL_TABLES,
    },
  });

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiDraftData, setAiDraftData] = useState<any>(null);

  // Lock Toggle
  const handleToggleLock = (step: StepNumber) => {
    setStepLocks((prev) => ({
      ...prev,
      [step]: !prev[step],
    }));
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
        setCurrentStep(target.currentStep);
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
      name,
      timestamp: Date.now(),
      dateStr: '방금 전',
    };
    setSnapshots([newSnapshot, ...snapshots]);
    setSnapshotStore((prev) => ({
      ...prev,
      [id]: {
        projectTitle,
        projectSummary,
        ideas,
        features,
        nodes,
        connections,
        tables,
      },
    }));
  };

  const handleRestoreSnapshot = (id: string) => {
    const saved = snapshotStore[id];
    if (saved) {
      setProjectTitle(saved.projectTitle);
      setProjectSummary(saved.projectSummary);
      setIdeas(saved.ideas);
      setFeatures(saved.features);
      setNodes(saved.nodes);
      setConnections(saved.connections);
      setTables(saved.tables);
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
    setIdeas([newCard, ...ideas]);
  };

  const handleDeleteCard = (id: string) => {
    setIdeas(ideas.filter((c) => c.id !== id));
  };

  const handleVoteCard = (cardId: string, memberName: string) => {
    setIdeas(
      ideas.map((card) => {
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
      })
    );
  };

  const handleAddComment = (cardId: string, author: string, text: string) => {
    setIdeas(
      ideas.map((card) => {
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
      })
    );
  };

  // Step 2 Handlers
  const handleAddFeature = (feat: Omit<FeatureSpec, 'id'>) => {
    const newId = `FEAT-${String(features.length + 1).padStart(2, '0')}`;
    const newFeature: FeatureSpec = {
      ...feat,
      id: newId,
    };
    setFeatures([...features, newFeature]);
  };

  const handleUpdateFeature = (id: string, updated: Partial<FeatureSpec>) => {
    setFeatures(features.map((f) => (f.id === id ? { ...f, ...updated } : f)));
  };

  const handleDeleteFeature = (id: string) => {
    setFeatures(features.filter((f) => f.id !== id));
  };

  const handleImportFromStep1 = () => {
    const highVoteIdeas = ideas.filter((i) => i.votes >= 4);
    const existingStoryIds = new Set(features.map((f) => f.relatedStoryId).filter(Boolean));

    const newFeatures: FeatureSpec[] = [];
    let count = features.length + 1;

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
          relatedStoryId: idea.id,
        });
        count++;
      }
    });

    if (newFeatures.length > 0) {
      setFeatures([...features, ...newFeatures]);
    }
  };

  // Step 3 Handlers
  const handleAddNode = (node: Omit<ArchNode, 'id'>) => {
    const newNode: ArchNode = {
      ...node,
      id: `node-${Date.now()}`,
    };
    setNodes([...nodes, newNode]);
  };

  const handleUpdateNodePosition = (id: string, x: number, y: number) => {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, x, y } : n)));
  };

  const handleDeleteNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
    setConnections(connections.filter((c) => c.sourceId !== id && c.targetId !== id));
  };

  const handleAddConnection = (conn: Omit<ArchConnection, 'id'>) => {
    const newConn: ArchConnection = {
      ...conn,
      id: `conn-${Date.now()}`,
    };
    setConnections([...connections, newConn]);
  };

  const handleDeleteConnection = (id: string) => {
    setConnections(connections.filter((c) => c.id !== id));
  };

  // Step 4 Handlers
  const handleAddTable = (table: Omit<ErdTable, 'id'>) => {
    const newTable: ErdTable = {
      ...table,
      id: `tbl-${Date.now()}`,
    };
    setTables([...tables, newTable]);
  };

  const handleUpdateTable = (id: string, updated: Partial<ErdTable>) => {
    setTables(tables.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  };

  const handleDeleteTable = (id: string) => {
    setTables(tables.filter((t) => t.id !== id));
  };

  const handleAddColumn = (tableId: string, col: Omit<ErdColumn, 'id'>) => {
    const newCol: ErdColumn = {
      ...col,
      id: `col-${Date.now()}`,
    };
    setTables(
      tables.map((t) => (t.id === tableId ? { ...t, columns: [...t.columns, newCol] } : t))
    );
  };

  const handleUpdateColumn = (tableId: string, colId: string, updated: Partial<ErdColumn>) => {
    setTables(
      tables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.map((c) => (c.id === colId ? { ...c, ...updated } : c)),
        };
      })
    );
  };

  const handleDeleteColumn = (tableId: string, colId: string) => {
    setTables(
      tables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.filter((c) => c.id !== colId),
        };
      })
    );
  };

  const handleUpdateTablePosition = (id: string, x: number, y: number) => {
    setTables(tables.map((t) => (t.id === id ? { ...t, x, y } : t)));
  };

  // AI Co-Architect Call
  const handleTriggerAiDraft = async () => {
    setIsAiGenerating(true);
    setIsAiModalOpen(true);

    try {
      const prevContext = {
        step1Cards: ideas.slice(0, 5),
        step2Features: features.slice(0, 5),
        step3Nodes: nodes.slice(0, 6),
      };

      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: currentStep,
          projectSummary,
          previousContext: prevContext,
        }),
      });

      const data = await res.json();
      if (data.draft) {
        setAiDraftData(data.draft);
      }
    } catch (err) {
      console.error('Failed to generate AI draft:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Accept selected AI items
  const handleAcceptAiItems = (acceptedItems: any[]) => {
    if (currentStep === 1) {
      const mapped = acceptedItems.map((item: any) => ({
        id: item.id || `idea-ai-${Date.now()}-${Math.random()}`,
        category: item.category || 'user_stories',
        title: item.title,
        description: item.description,
        author: item.author || 'AI Co-Architect',
        votes: 3,
        votedBy: ['현우', '지훈'],
        comments: [],
        isAiDraft: true,
      }));
      setIdeas([...mapped, ...ideas]);
    } else if (currentStep === 2) {
      const mapped = acceptedItems.map((item: any, idx: number) => ({
        id: item.id || `FEAT-AI-${idx + 1}`,
        domain: item.domain || '추천 기능',
        name: item.name,
        priority: item.priority || 'P1',
        assignee: item.assignee || '현우',
        method: item.method || 'POST',
        endpoint: item.endpoint || '/api/v1/ai',
        requestFields: item.requestFields || 'params',
        responseFields: item.responseFields || 'data',
        summary: item.summary || item.name,
        isAiDraft: true,
      }));
      setFeatures([...features, ...mapped]);
    } else if (currentStep === 3) {
      const mapped = acceptedItems.map((item: any, idx: number) => ({
        id: item.id || `node-ai-${idx + 1}`,
        category: item.category || 'Service',
        name: item.name,
        techStack: item.techStack || ['Node.js'],
        x: 450 + idx * 160,
        y: 260 + (idx % 2) * 90,
        description: item.description || 'AI 제안 컴포넌트',
        isAiDraft: true,
      }));
      setNodes([...nodes, ...mapped]);
    } else if (currentStep === 4) {
      const mapped = acceptedItems.map((item: any, idx: number) => ({
        id: item.id || `tbl-ai-${idx + 1}`,
        name: item.name,
        comment: item.comment,
        relatedFeatureIds: item.relatedFeatureIds || ['FEAT-02'],
        columns: item.columns || [],
        x: 450 + idx * 80,
        y: 350 + idx * 60,
        isAiDraft: true,
      }));
      setTables([...tables, ...mapped]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* 56px Global Header */}
      <Header
        title={projectTitle}
        onUpdateTitle={setProjectTitle}
        currentStep={currentStep}
        onChangeStep={setCurrentStep}
        stepLocks={stepLocks}
        onToggleLock={handleToggleLock}
        teamMembers={teamMembers}
        onToggleSpotlight={handleToggleSpotlight}
        activeSpotlightMember={activeSpotlightMember}
        snapshots={snapshots}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenAiDraft={handleTriggerAiDraft}
        isAiGenerating={isAiGenerating}
      />

      {/* Main Split-View Workspace according to current Step */}
      <main className="flex-1 flex overflow-hidden">
        {currentStep === 1 && (
          <Step1IdeaBoard
            projectSummary={projectSummary}
            onUpdateSummary={setProjectSummary}
            cards={ideas}
            onAddCard={handleAddCard}
            onDeleteCard={handleDeleteCard}
            onVoteCard={handleVoteCard}
            onAddComment={handleAddComment}
            teamMembers={teamMembers}
            isLocked={stepLocks[1]}
            onTriggerAiDraft={handleTriggerAiDraft}
          />
        )}

        {currentStep === 2 && (
          <Step2FeatureSpec
            features={features}
            onAddFeature={handleAddFeature}
            onUpdateFeature={handleUpdateFeature}
            onDeleteFeature={handleDeleteFeature}
            onImportFromStep1={handleImportFromStep1}
            ideas={ideas}
            teamMembers={teamMembers}
            isLocked={stepLocks[2]}
            onTriggerAiDraft={handleTriggerAiDraft}
          />
        )}

        {currentStep === 3 && (
          <Step3Architecture
            nodes={nodes}
            connections={connections}
            onAddNode={handleAddNode}
            onUpdateNodePosition={handleUpdateNodePosition}
            onDeleteNode={handleDeleteNode}
            onAddConnection={handleAddConnection}
            onDeleteConnection={handleDeleteConnection}
            isLocked={stepLocks[3]}
            onTriggerAiDraft={handleTriggerAiDraft}
          />
        )}

        {currentStep === 4 && (
          <Step4ErdStudio
            tables={tables}
            features={features}
            onAddTable={handleAddTable}
            onUpdateTable={handleUpdateTable}
            onDeleteTable={handleDeleteTable}
            onAddColumn={handleAddColumn}
            onUpdateColumn={handleUpdateColumn}
            onDeleteColumn={handleDeleteColumn}
            onUpdateTablePosition={handleUpdateTablePosition}
            isLocked={stepLocks[4]}
            onTriggerAiDraft={handleTriggerAiDraft}
          />
        )}
      </main>

      {/* Non-destructive AI Draft Modal */}
      <AiDraftModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        step={currentStep}
        draftData={aiDraftData}
        onAcceptItems={handleAcceptAiItems}
        isGenerating={isAiGenerating}
      />

      {/* Export Engine Modal (SQL DDL / Markdown) */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projectTitle={projectTitle}
        projectSummary={projectSummary}
        ideas={ideas}
        features={features}
        nodes={nodes}
        connections={connections}
        tables={tables}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { ArrowRight, LayoutList, Workflow } from 'lucide-react';
import type { FeatureSpec, FeatureProgressStatus, TeamMember, IdeaCard } from '../types/index.ts';
import { FeatureSidebarToolbar } from './step2/FeatureSidebarToolbar.tsx';
import { AddFeatureForm } from './step2/AddFeatureForm.tsx';
import { FeatureList } from './step2/FeatureList.tsx';
import { FeatureDetail } from './step2/FeatureDetail.tsx';
import { ApiDocModal } from './step2/ApiDocModal.tsx';
import { EditFeatureModal } from './step2/EditFeatureModal.tsx';
import { ImportIdeasModal } from './step2/ImportIdeasModal.tsx';

interface Step2FeatureSpecProps {
  features: FeatureSpec[];
  onAddFeature: (feature: Omit<FeatureSpec, 'id'>) => void;
  onUpdateFeature: (id: string, updated: Partial<FeatureSpec>) => void;
  onDeleteFeature: (id: string) => void;
  onImportFromStep1: (ids: string[]) => void;
  ideas: IdeaCard[];
  teamMembers: TeamMember[];
  isLocked: boolean;
  excelUrl?: string;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  onResetResize?: () => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
}

export const Step2FeatureSpec: React.FC<Step2FeatureSpecProps> = ({
  features,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  onImportFromStep1,
  ideas,
  teamMembers,
  isLocked,
  excelUrl,
  sidebarWidth,
  onStartResize,
  onResetResize,
  mobileTab,
  onChangeMobileTab,
  isDesktop = true,
}) => {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(features[0]?.id || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showApiDocModal, setShowApiDocModal] = useState(false);
  const [editing, setEditing] = useState<FeatureSpec | null>(null);
  const [showImport, setShowImport] = useState(false);

  // [기능 명세] 필터
  const [filterStatus, setFilterStatus] = useState<FeatureProgressStatus | 'ALL'>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');

  const availableIdeasCount = ideas.filter(i => !features.some(f => f.relatedStoryId === i.id)).length;

  // [기능 명세] 전체 진행률 계산
  const totalCount = features.length;
  const completedCount = features.filter((f) => f.status === 'COMPLETED').length;
  const inProgressCount = features.filter((f) => f.status === 'IN_PROGRESS').length;
  const qaCount = features.filter((f) => f.status === 'QA').length;
  const plannedCount = totalCount - completedCount - inProgressCount - qaCount;
  const progressPercent = totalCount > 0 ? Math.round(((completedCount * 1.0 + qaCount * 0.75 + inProgressCount * 0.4) / totalCount) * 100) : 0;

  const filteredFeatures = features.filter((f) => {
    if (filterStatus !== 'ALL' && f.status !== filterStatus) return false;
    if (filterAssignee !== 'ALL' && f.assignee !== filterAssignee) return false;
    return true;
  });

  const selectedFeature = features.find((f) => f.id === selectedFeatureId) || filteredFeatures[0] || features[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* [기능 명세] 모바일·태블릿 화면 전환 */}
      <div className="lg:hidden flex items-center justify-center p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full max-w-sm">
          <button
            onClick={() => onChangeMobileTab('editor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'editor'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>기능 목록 &amp; 진행상황</span>
          </button>
          <button
            onClick={() => onChangeMobileTab('canvas')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'canvas'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>API 상세 &amp; 시퀀스</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* [기능 명세] 왼쪽 패널: 크기 조절 기능 명세 표와 진행 현황 */}
        <div
          style={isDesktop ? { width: `${sidebarWidth}%` } : undefined}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            isDesktop ? 'flex' : (mobileTab === 'editor' ? 'w-full flex' : 'hidden')
          }`}
        >
          {/* [기능 명세] 헤더 버튼 줄 */}
          <FeatureSidebarToolbar
            featureCount={features.length}
            isLocked={isLocked}
            onOpenApiDoc={() => setShowApiDocModal(true)}
            excelUrl={excelUrl}
            onToggleAddForm={() => setShowAddForm(!showAddForm)}
            progressPercent={progressPercent}
            totalCount={totalCount}
            completedCount={completedCount}
            qaCount={qaCount}
            inProgressCount={inProgressCount}
            plannedCount={plannedCount}
            filterStatus={filterStatus}
            onChangeFilterStatus={setFilterStatus}
            filterAssignee={filterAssignee}
            onChangeFilterAssignee={setFilterAssignee}
            teamMembers={teamMembers}
          />

          {/* [기능 명세] 기능 추가 모달 / 펼침 폼 */}
          <AddFeatureForm
            open={showAddForm}
            teamMembers={teamMembers}
            isLocked={isLocked}
            onAddFeature={onAddFeature}
            onClose={() => setShowAddForm(false)}
          />

          {/* [기능 명세] 상태 빠른 전환이 있는 기능 목록 */}
          <FeatureList
            features={filteredFeatures}
            selectedFeatureId={selectedFeature?.id}
            isLocked={isLocked}
            onSelectFeature={setSelectedFeatureId}
            onUpdateFeature={onUpdateFeature}
            onDeleteFeature={onDeleteFeature}
          />

          {/* [기능 명세] Step 1 아이디어 가져오기 배너 */}
          <div className="p-3 bg-indigo-950/40 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-slate-300">
                가져올 수 있는 아이디어: <strong className="text-indigo-300">{availableIdeasCount}건</strong>
              </span>
            </div>
            <button
              onClick={() => setShowImport(true)}
              disabled={ideas.length === 0 || isLocked}
              className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 disabled:opacity-40 border border-indigo-500/40 text-indigo-200 rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              <span>아이디어 선택하여 가져오기</span>
            </button>
          </div>
        </div>

        {/* [기능 명세] 왼쪽·오른쪽 패널 크기 조절 구분선 */}
        <div
          onMouseDown={onStartResize}
          onDoubleClick={onResetResize}
          className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
          title="드래그하여 사이드바 너비 조절 (더블클릭 시 40% 리셋)"
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* [기능 명세] 오른쪽 패널: API 상세와 시퀀스 흐름 캔버스 */}
        <div
          className={`flex-col h-full bg-slate-950/60 overflow-hidden ${
            isDesktop ? 'flex-1 min-w-0 flex' : (mobileTab === 'canvas' ? 'w-full flex' : 'hidden')
          }`}
        >
          <FeatureDetail feature={selectedFeature} onEdit={isLocked ? undefined : () => selectedFeature && setEditing(selectedFeature)} />
        </div>
      </div>

      {/* [기능 명세] API 문서 자동 생성 모달 */}
      <ApiDocModal open={showApiDocModal} features={features} onClose={() => setShowApiDocModal(false)} />
      {editing && <EditFeatureModal feature={editing} members={teamMembers} onSave={onUpdateFeature} onClose={() => setEditing(null)} />}
      {showImport && <ImportIdeasModal ideas={ideas} features={features} onImport={onImportFromStep1} onClose={() => setShowImport(false)} />}
    </div>
  );
};

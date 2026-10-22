import React from 'react';
import { Filter, GitBranch, History, Link, Network, Plus, Save, Search, X } from 'lucide-react';
import type { ArchCategory, ArchVersion, TeamOrg } from '../../types/index.ts';

interface ArchSidebarToolbarProps {
  nodeCount: number;
  connectionCount: number;
  isLocked: boolean;
  archVersions: ArchVersion[];
  currentVersionId: string;
  onSwitchVersion: (versionId: string) => void;
  onOpenSaveVersion: () => void;
  onOpenVersionList: () => void;
  onToggleAddConn: () => void;
  onToggleAddNode: () => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  filterOrg: TeamOrg;
  onChangeFilterOrg: (org: TeamOrg) => void;
  filterLayer: ArchCategory | 'All';
  onChangeFilterLayer: (layer: ArchCategory | 'All') => void;
}

export const ArchSidebarToolbar: React.FC<ArchSidebarToolbarProps> = ({
  nodeCount,
  connectionCount,
  isLocked,
  archVersions,
  currentVersionId,
  onSwitchVersion,
  onOpenSaveVersion,
  onOpenVersionList,
  onToggleAddConn,
  onToggleAddNode,
  searchQuery,
  onChangeSearchQuery,
  filterOrg,
  onChangeFilterOrg,
  filterLayer,
  onChangeFilterLayer,
}) => (
  <div className="p-3 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-2">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          <Network className="w-4 h-4" />
          Step 3. 시스템 아키텍처 &amp; 버전 관리
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">총 {nodeCount}개 노드 / {connectionCount}개 통신선</div>
      </div>

      <div className="flex items-center gap-1.5">
        {!isLocked && (
          <>
            <button
              onClick={onOpenSaveVersion}
              className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              title="현재 아키텍처 상태를 새 버전으로 스냅샷 저장"
            >
              <Save className="w-3.5 h-3.5 text-indigo-400" />
              <span>버전 저장</span>
            </button>
            <button
              onClick={onToggleAddConn}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
            >
              <Link className="w-3.5 h-3.5" />
              <span>연결선</span>
            </button>
            <button
              onClick={onToggleAddNode}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>노드 추가</span>
            </button>
          </>
        )}
      </div>
    </div>

    {/* [시스템 아키텍처] 아키텍처 버전 선택 */}
    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 font-medium text-slate-300">
        <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="font-semibold text-slate-400">아키텍처 버전:</span>
        <select
          value={currentVersionId}
          onChange={(e) => onSwitchVersion(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-0.5 text-white font-semibold focus:outline-none cursor-pointer max-w-[200px]"
        >
          {archVersions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.versionNumber} ({v.label})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onOpenVersionList}
        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
      >
        <History className="w-3 h-3" />
        <span>히스토리</span>
      </button>
    </div>

    {/* [시스템 아키텍처] 검색창과 조직·계층 필터 */}
    <div className="space-y-1.5 pt-0.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          placeholder="컴포넌트 이름 또는 기술스택 검색 (예: NestJS, Redis, React)..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        {searchQuery && (
          <button
            onClick={() => onChangeSearchQuery('')}
            className="absolute right-2.5 top-1.5 text-slate-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Filter className="w-3 h-3 text-sky-400" />
          <span>조직:</span>
          {(['All', 'Backend', 'Frontend', 'Infra'] as TeamOrg[]).map((org) => (
            <button
              key={org}
              onClick={() => onChangeFilterOrg(org)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterOrg === org
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {org === 'All' ? '전체' : org === 'Backend' ? 'BE' : org === 'Frontend' ? 'FE' : 'Infra'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>계층:</span>
          <select
            value={filterLayer}
            onChange={(e) => onChangeFilterLayer(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
          >
            <option value="All">전체</option>
            <option value="Client">Client</option>
            <option value="Service">Service</option>
            <option value="Messaging">Queue/Cache</option>
            <option value="DataStore">DataStore (DB)</option>
            <option value="Infra">Infra/Proxy</option>
          </select>
        </div>
      </div>
    </div>
  </div>
);

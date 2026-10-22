import React, { useState } from 'react';
import { Layers, Network } from 'lucide-react';
import type { ArchNode, ArchConnection, ArchCategory, ArchProtocol, TeamOrg } from '../types/index.ts';
import { ArchSidebarToolbar } from './step3/ArchSidebarToolbar.tsx';
import { AddConnectionForm } from './step3/AddConnectionForm.tsx';
import { AddNodeForm } from './step3/AddNodeForm.tsx';
import { ArchItemList } from './step3/ArchItemList.tsx';
import { ArchCanvas } from './step3/ArchCanvas.tsx';
import { EditNodeModal } from './step3/EditNodeModal.tsx';
import { EditConnectionModal } from './step3/EditConnectionModal.tsx';

interface Step3ArchitectureProps {
  nodes: ArchNode[];
  connections: ArchConnection[];
  onAddNode: (node: Omit<ArchNode, 'id'>) => void;
  onUpdateNode: (id: string, updated: Partial<ArchNode>) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onAddConnection: (conn: Omit<ArchConnection, 'id'>) => void;
  onUpdateConnection: (id: string, updated: Partial<ArchConnection>) => void;
  onDeleteConnection: (id: string) => void;
  isLocked: boolean;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  onResetResize?: () => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
}

export const Step3Architecture: React.FC<Step3ArchitectureProps> = ({
  nodes,
  connections,
  onAddNode,
  onUpdateNode,
  onUpdateNodePosition,
  onDeleteNode,
  onAddConnection,
  onUpdateConnection,
  onDeleteConnection,
  isLocked,
  sidebarWidth,
  onStartResize,
  onResetResize,
  mobileTab,
  onChangeMobileTab,
  isDesktop = true,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddConn, setShowAddConn] = useState(false);
  // [시스템 아키텍처] 편집 중인 항목은 id로 들고 있어서, 팀원이 그 사이 지우거나 Step 3를 잠그면 모달이 닫힌다.
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  // [시스템 아키텍처] 필터
  const [filterOrg, setFilterOrg] = useState<TeamOrg>('All');
  const [filterLayer, setFilterLayer] = useState<ArchCategory | 'All'>('All');
  const [filterProtocol, setFilterProtocol] = useState<ArchProtocol | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // [시스템 아키텍처] 노드 필터 검사
  const isNodeVisible = (node: ArchNode) => {
    if (filterOrg !== 'All' && node.assignedTeam !== filterOrg) return false;
    if (filterLayer !== 'All' && node.category !== filterLayer) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = node.name.toLowerCase().includes(q);
      const matchTech = node.techStack.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchTech) return false;
    }
    return true;
  };

  const filteredConnections = connections.filter((c) => {
    if (filterProtocol !== 'All' && c.protocol !== filterProtocol) return false;
    return true;
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const editingNode = nodes.find((n) => n.id === editingNodeId);
  const editingConnection = connections.find((c) => c.id === editingConnectionId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* [시스템 아키텍처] 모바일·태블릿 화면 전환 */}
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
            <Layers className="w-3.5 h-3.5" />
            <span>컴포넌트 &amp; 필터</span>
          </button>
          <button
            onClick={() => onChangeMobileTab('canvas')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'canvas'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>아키텍처 캔버스</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* [시스템 아키텍처] 왼쪽 패널: 크기 조절 컴포넌트 목록과 필터 */}
        <div
          aria-label="아키텍처 편집 패널"
          style={isDesktop ? { width: `${sidebarWidth}%` } : undefined}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            isDesktop ? 'flex' : (mobileTab === 'editor' ? 'w-full flex' : 'hidden')
          }`}
        >
          <ArchSidebarToolbar
            nodeCount={nodes.length}
            connectionCount={connections.length}
            isLocked={isLocked}
            onToggleAddConn={() => setShowAddConn(!showAddConn)}
            onToggleAddNode={() => setShowAddNode(!showAddNode)}
            searchQuery={searchQuery}
            onChangeSearchQuery={setSearchQuery}
            filterOrg={filterOrg}
            onChangeFilterOrg={setFilterOrg}
            filterLayer={filterLayer}
            onChangeFilterLayer={setFilterLayer}
          />

          {/* [시스템 아키텍처] 연결선 추가 폼 */}
          <AddConnectionForm
            open={showAddConn}
            nodes={nodes}
            isLocked={isLocked}
            onAddConnection={onAddConnection}
            onClose={() => setShowAddConn(false)}
          />

          {/* [시스템 아키텍처] 노드 추가 폼 */}
          <AddNodeForm
            open={showAddNode}
            isLocked={isLocked}
            onAddNode={onAddNode}
            onClose={() => setShowAddNode(false)}
          />

          {/* [시스템 아키텍처] 노드와 연결선 목록 */}
          <ArchItemList
            nodes={nodes}
            connections={filteredConnections}
            selectedNodeId={selectedNode?.id}
            isNodeVisible={isNodeVisible}
            isLocked={isLocked}
            onSelectNode={setSelectedNodeId}
            onEditNode={setEditingNodeId}
            onEditConnection={setEditingConnectionId}
            onDeleteNode={onDeleteNode}
            onDeleteConnection={onDeleteConnection}
          />
        </div>

        {/* [시스템 아키텍처] 왼쪽·오른쪽 패널 크기 조절 구분선 */}
        <div
          onMouseDown={onStartResize}
          onDoubleClick={onResetResize}
          className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
          title="드래그하여 사이드바 너비 조절 (더블클릭 시 30% 리셋)"
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* [시스템 아키텍처] 오른쪽 패널: 색상별 SVG 연결선이 있는 계층 아키텍처 캔버스 */}
        <div
          className={`flex-col h-full bg-slate-950/60 overflow-hidden relative ${
            isDesktop ? 'flex-1 min-w-0 flex' : (mobileTab === 'canvas' ? 'w-full flex' : 'hidden')
          }`}
        >
          <ArchCanvas
            nodes={nodes}
            connections={filteredConnections}
            filterProtocol={filterProtocol}
            onChangeFilterProtocol={setFilterProtocol}
            selectedNodeId={selectedNode?.id}
            onSelectNode={setSelectedNodeId}
            isNodeVisible={isNodeVisible}
            isLocked={isLocked}
            onUpdateNodePosition={onUpdateNodePosition}
            onEditNode={setEditingNodeId}
            onEditConnection={setEditingConnectionId}
          />
        </div>
      </div>

      {/* [시스템 아키텍처] 노드·연결선 속성 편집 모달. key로 다른 항목을 열 때 입력값을 새로 채운다. */}
      {editingNode && !isLocked && (
        <EditNodeModal
          key={editingNode.id}
          node={editingNode}
          onSave={(updated) => onUpdateNode(editingNode.id, updated)}
          onClose={() => setEditingNodeId(null)}
        />
      )}
      {editingConnection && !isLocked && (
        <EditConnectionModal
          key={editingConnection.id}
          connection={editingConnection}
          nodes={nodes}
          onSave={(updated) => onUpdateConnection(editingConnection.id, updated)}
          onClose={() => setEditingConnectionId(null)}
        />
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { 
  Network, 
  Plus, 
  Trash2, 
  Sparkles, 
  Database, 
  Server, 
  Monitor, 
  Radio, 
  Cpu, 
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Link,
  Layers,
  Lock,
  GitBranch,
  Filter,
  Save,
  Clock,
  Check,
  Tag,
  Search,
  X,
  History,
  Eye,
  CheckCircle2
} from 'lucide-react';
import type { ArchNode, ArchConnection, ArchCategory, ArchProtocol, ArchVersion, TeamOrg } from '../types/index.ts';

interface Step3ArchitectureProps {
  nodes: ArchNode[];
  connections: ArchConnection[];
  onAddNode: (node: Omit<ArchNode, 'id'>) => void;
  onUpdateNode?: (id: string, updated: Partial<ArchNode>) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onAddConnection: (conn: Omit<ArchConnection, 'id'>) => void;
  onUpdateConnection?: (id: string, updated: Partial<ArchConnection>) => void;
  onDeleteConnection: (id: string) => void;
  archVersions: ArchVersion[];
  currentVersionId: string;
  onSwitchVersion: (versionId: string) => void;
  onSaveNewVersion: (versionNumber: string, label: string, description: string) => void;
  isLocked: boolean;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  onResetResize?: () => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
}

const CATEGORY_META: Record<
  ArchCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; border: string; bg: string }
> = {
  Client: { label: 'Client Tier', icon: Monitor, color: 'text-sky-400', border: 'border-sky-500/40', bg: 'bg-sky-500/10' },
  Service: { label: 'Service / Gateway', icon: Server, color: 'text-indigo-400', border: 'border-indigo-500/40', bg: 'bg-indigo-500/10' },
  Messaging: { label: 'Cache / Message Queue', icon: Radio, color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  DataStore: { label: 'Database Storage', icon: Database, color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  Infra: { label: 'Infra / Proxy', icon: Cpu, color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
};

// Distinctive Vivid Protocol Styling (Color, Line pattern, Badge styling)
const PROTOCOL_CONFIG: Record<
  ArchProtocol,
  { stroke: string; strokeWidth: number; dash?: string; bg: string; text: string; label: string; desc: string }
> = {
  REST: { 
    stroke: '#38bdf8', 
    strokeWidth: 2.5, 
    bg: 'bg-sky-950', 
    text: 'text-sky-300', 
    label: 'REST (HTTPS)', 
    desc: '동기식 HTTP REST API 요청' 
  },
  WebSocket: { 
    stroke: '#f59e0b', 
    strokeWidth: 2.5, 
    dash: '8 4', 
    bg: 'bg-amber-950', 
    text: 'text-amber-300', 
    label: 'WebSocket (WSS)', 
    desc: '실시간 양방향 웹소켓 통신' 
  },
  gRPC: { 
    stroke: '#c084fc', 
    strokeWidth: 2.5, 
    bg: 'bg-purple-950', 
    text: 'text-purple-300', 
    label: 'gRPC / HTTP/2', 
    desc: '고성능 내부 마이크로서비스 RPC' 
  },
  'Pub/Sub': { 
    stroke: '#fb7185', 
    strokeWidth: 2.5, 
    dash: '4 4', 
    bg: 'bg-rose-950', 
    text: 'text-rose-300', 
    label: 'Pub/Sub Event', 
    desc: '비동기 이벤트 메시징 브로커' 
  },
  SQL: { 
    stroke: '#34d399', 
    strokeWidth: 2.5, 
    bg: 'bg-emerald-950', 
    text: 'text-emerald-300', 
    label: 'SQL (DB Driver)', 
    desc: '관계형 데이터베이스 드라이버 쿼리' 
  },
  Redis: { 
    stroke: '#fb923c', 
    strokeWidth: 2.5, 
    dash: '6 3', 
    bg: 'bg-orange-950', 
    text: 'text-orange-300', 
    label: 'Redis Cache', 
    desc: '인메모리 캐시 및 세션 세마포어' 
  },
  Kafka: { 
    stroke: '#06b6d4', 
    strokeWidth: 2.5, 
    dash: '8 3 2 3', 
    bg: 'bg-cyan-950', 
    text: 'text-cyan-300', 
    label: 'Kafka Stream', 
    desc: '분산 이벤트 스트리밍 파이프라인' 
  },
};

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
  archVersions,
  currentVersionId,
  onSwitchVersion,
  onSaveNewVersion,
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
  const [showSaveVersionModal, setShowSaveVersionModal] = useState(false);
  const [showVersionListModal, setShowVersionListModal] = useState(false);

  // Filtering
  const [filterOrg, setFilterOrg] = useState<TeamOrg>('All');
  const [filterLayer, setFilterLayer] = useState<ArchCategory | 'All'>('All');
  const [filterProtocol, setFilterProtocol] = useState<ArchProtocol | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // New Version Form
  const [newVersionNum, setNewVersionNum] = useState(`v${archVersions.length + 1}.0`);
  const [newVersionLabel, setNewVersionLabel] = useState('이벤트 기반 MSA 확장');
  const [newVersionDesc, setNewVersionDesc] = useState('고성능 트래픽 대응을 위한 비동기 이벤트 스트리밍 아키텍처 스냅샷');

  // Form State
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeCategory, setNewNodeCategory] = useState<ArchCategory>('Service');
  const [newTechStack, setNewTechStack] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newAssignedTeam, setNewAssignedTeam] = useState<'Frontend' | 'Backend' | 'Infra'>('Backend');

  // Connection State
  const [sourceNodeId, setSourceNodeId] = useState(nodes[0]?.id || '');
  const [targetNodeId, setTargetNodeId] = useState(nodes[1]?.id || '');
  const [protocol, setProtocol] = useState<ArchProtocol>('REST');
  const [connLabel, setConnLabel] = useState('');
  const [connDescription, setConnDescription] = useState('');

  // Node Edit Modal State
  const [editingNode, setEditingNode] = useState<ArchNode | null>(null);
  const [editNodeName, setEditNodeName] = useState('');
  const [editNodeCategory, setEditNodeCategory] = useState<ArchCategory>('Service');
  const [editNodeAssignedTeam, setEditNodeAssignedTeam] = useState<'Frontend' | 'Backend' | 'Infra' | 'Common'>('Backend');
  const [editTechStack, setEditTechStack] = useState('');
  const [editNodeDesc, setEditNodeDesc] = useState('');

  // Connection Edit Modal State
  const [editingConnection, setEditingConnection] = useState<ArchConnection | null>(null);
  const [editConnSourceId, setEditConnSourceId] = useState('');
  const [editConnTargetId, setEditConnTargetId] = useState('');
  const [editConnProtocol, setEditConnProtocol] = useState<ArchProtocol>('REST');
  const [editConnLabel, setEditConnLabel] = useState('');
  const [editConnDesc, setEditConnDesc] = useState('');

  // Canvas Dragging & Zoom
  const [zoom, setZoom] = useState(1);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleNodeMouseDown = (e: React.MouseEvent, node: ArchNode) => {
    if (isLocked) return;
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setSelectedNodeId(node.id);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const newX = Math.max(20, Math.min(1150, Math.round(e.clientX - dragOffset.x)));
      const newY = Math.max(20, Math.min(750, Math.round(e.clientY - dragOffset.y)));
      onUpdateNodePosition(draggingNodeId, newX, newY);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim() || isLocked) return;

    onAddNode({
      name: newNodeName.trim(),
      category: newNodeCategory,
      techStack: newTechStack.split(',').map((s) => s.trim()).filter(Boolean),
      x: 100 + Math.floor(Math.random() * 250),
      y: 100 + Math.floor(Math.random() * 250),
      description: newNodeDesc.trim() || '아키텍처 컴포넌트',
      assignedTeam: newAssignedTeam,
    });

    setNewNodeName('');
    setNewTechStack('');
    setNewNodeDesc('');
    setShowAddNode(false);
  };

  const handleCreateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || sourceNodeId === targetNodeId) return;

    onAddConnection({
      sourceId: sourceNodeId,
      targetId: targetNodeId,
      protocol,
      label: connLabel.trim() || undefined,
      description: connDescription.trim() || '',
    });

    setConnLabel('');
    setConnDescription('');
    setShowAddConn(false);
  };

  const handleOpenEditNode = (node: ArchNode) => {
    setEditingNode(node);
    setEditNodeName(node.name);
    setEditNodeCategory(node.category);
    setEditNodeAssignedTeam(node.assignedTeam || 'Backend');
    setEditTechStack(node.techStack.join(', '));
    setEditNodeDesc(node.description || '');
  };

  const handleSaveEditNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || !editNodeName.trim()) return;

    if (onUpdateNode) {
      onUpdateNode(editingNode.id, {
        name: editNodeName.trim(),
        category: editNodeCategory,
        assignedTeam: editNodeAssignedTeam,
        techStack: editTechStack.split(',').map((s) => s.trim()).filter(Boolean),
        description: editNodeDesc.trim() || '아키텍처 컴포넌트',
      });
    }
    setEditingNode(null);
  };

  const handleOpenEditConnection = (conn: ArchConnection) => {
    setEditingConnection(conn);
    setEditConnSourceId(conn.sourceId);
    setEditConnTargetId(conn.targetId);
    setEditConnProtocol(conn.protocol);
    setEditConnLabel(conn.label || '');
    setEditConnDesc(conn.description || '');
  };

  const handleSaveEditConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnection || editConnSourceId === editConnTargetId) return;

    if (onUpdateConnection) {
      onUpdateConnection(editingConnection.id, {
        sourceId: editConnSourceId,
        targetId: editConnTargetId,
        protocol: editConnProtocol,
        label: editConnLabel.trim() || undefined,
        description: editConnDesc.trim() || '',
      });
    }
    setEditingConnection(null);
  };

  const handleSaveVersionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionNum.trim()) return;
    onSaveNewVersion(newVersionNum.trim(), newVersionLabel.trim() || '신규 버전', newVersionDesc.trim());
    setShowSaveVersionModal(false);
  };

  // Node filtering check
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
  const currentVersion = archVersions.find((v) => v.id === currentVersionId) || archVersions[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Mobile / Tablet Segmented View Switcher */}
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
        {/* LEFT PANEL: Resizable Component List & Filtering Dashboard */}
        <div 
          style={isDesktop ? { width: `${sidebarWidth}%` } : undefined}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            isDesktop ? 'flex' : (mobileTab === 'editor' ? 'w-full flex' : 'hidden')
          }`}
        >
        {/* Header Action Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Network className="w-4 h-4" />
                Step 3. 시스템 아키텍처 &amp; 버전 관리
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">총 {nodes.length}개 노드 / {connections.length}개 통신선</div>
            </div>

            <div className="flex items-center gap-1.5">
              {!isLocked && (
                <>
                  <button
                    onClick={() => setShowSaveVersionModal(true)}
                    className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                    title="현재 아키텍처 상태를 새 버전으로 스냅샷 저장"
                  >
                    <Save className="w-3.5 h-3.5 text-indigo-400" />
                    <span>버전 저장</span>
                  </button>
                  <button
                    onClick={() => setShowAddConn(!showAddConn)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>연결선</span>
                  </button>
                  <button
                    onClick={() => setShowAddNode(!showAddNode)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>노드 추가</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Architecture Version Selector Pill */}
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
              onClick={() => setShowVersionListModal(true)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <History className="w-3 h-3" />
              <span>히스토리</span>
            </button>
          </div>

          {/* Search bar & Org/Layer Filters */}
          <div className="space-y-1.5 pt-0.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="컴포넌트 이름 또는 기술스택 검색 (예: NestJS, Redis, React)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
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
                    onClick={() => setFilterOrg(org)}
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
                  onChange={(e) => setFilterLayer(e.target.value as any)}
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

        {/* Add Connection Form */}
        {showAddConn && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/90 shrink-0 animate-in fade-in duration-100">
            <form onSubmit={handleCreateConnection} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                <span>컴포넌트 간 통신 연결선(Connection) 생성</span>
                <button
                  type="button"
                  onClick={() => setShowAddConn(false)}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  닫기
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400">출발 컴포넌트(Source)</label>
                  <select
                    value={sourceNodeId}
                    onChange={(e) => setSourceNodeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">도착 컴포넌트(Target)</label>
                  <select
                    value={targetNodeId}
                    onChange={(e) => setTargetNodeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">통신 프로토콜</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as ArchProtocol)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs font-mono"
                  >
                    <option value="REST">REST (Sky Blue - HTTPS)</option>
                    <option value="WebSocket">WebSocket (Amber - 실시간 WSS)</option>
                    <option value="gRPC">gRPC (Purple - 내부 RPC)</option>
                    <option value="Pub/Sub">Pub/Sub (Rose - 이벤트 큐)</option>
                    <option value="SQL">SQL (Emerald - DB 커넥션)</option>
                    <option value="Redis">Redis (Orange - 캐시 커맨드)</option>
                    <option value="Kafka">Kafka (Cyan - 스트리밍)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">라벨 이름 (옵션)</label>
                  <input
                    type="text"
                    placeholder="예: 실시간 QR 인증 이벤트"
                    value={connLabel}
                    onChange={(e) => setConnLabel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400">상세 설명 / 프로토콜 규격 (description)</label>
                <input
                  type="text"
                  placeholder="예: WSS 양방향 동기화 및 heartbeat 30초 주기"
                  value={connDescription}
                  onChange={(e) => setConnDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={sourceNodeId === targetNodeId}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded text-xs font-semibold"
                >
                  연결선 등록
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Node Form */}
        {showAddNode && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/90 shrink-0 animate-in fade-in duration-100">
            <form onSubmit={handleCreateNode} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
                <span>신규 아키텍처 노드 추가</span>
                <button
                  type="button"
                  onClick={() => setShowAddNode(false)}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  닫기
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">컴포넌트 이름</label>
                  <input
                    type="text"
                    placeholder="예: Notification Worker"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">레이어</label>
                  <select
                    value={newNodeCategory}
                    onChange={(e) => setNewNodeCategory(e.target.value as ArchCategory)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                  >
                    <option value="Client">Client</option>
                    <option value="Service">Service</option>
                    <option value="Messaging">Messaging</option>
                    <option value="DataStore">DataStore</option>
                    <option value="Infra">Infra</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">담당 조직</label>
                  <select
                    value={newAssignedTeam}
                    onChange={(e) => setNewAssignedTeam(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                  >
                    <option value="Backend">Backend</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Infra">Infra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400">기술 스택 (쉼표 구분)</label>
                <input
                  type="text"
                  placeholder="예: Node.js, BullMQ, FCM"
                  value={newTechStack}
                  onChange={(e) => setNewTechStack(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400">역할 및 설명</label>
                <input
                  type="text"
                  placeholder="컴포넌트의 핵심 책임 기술..."
                  value={newNodeDesc}
                  onChange={(e) => setNewNodeDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!newNodeName.trim()}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-semibold"
                >
                  노드 생성
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Nodes and Connections List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          <div className="p-3 bg-slate-900/40">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              컴포넌트 목록 ({nodes.filter(isNodeVisible).length}/{nodes.length})
            </span>
          </div>

          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const visible = isNodeVisible(node);
            const meta = CATEGORY_META[node.category];

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                onDoubleClick={() => !isLocked && handleOpenEditNode(node)}
                title="더블클릭하여 노드 속성 수정"
                className={`p-3 cursor-pointer transition-all ${
                  visible ? 'opacity-100' : 'opacity-25'
                } ${
                  isSelected
                    ? 'bg-slate-800/90 border-l-4 border-indigo-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded flex items-center justify-center ${meta.bg} ${meta.color} border ${meta.border}`}>
                      <meta.icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{node.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {node.category} · {node.assignedTeam}
                      </div>
                    </div>
                  </div>

                  {!isLocked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      className="text-slate-600 hover:text-rose-400 p-0.5"
                      title="노드 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {node.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Connections Section */}
          <div className="p-3 bg-slate-900/40">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              프로토콜 연결선 목록 ({filteredConnections.length})
            </span>
          </div>

          <div className="p-2 space-y-1.5">
            {filteredConnections.map((c) => {
              const src = nodes.find((n) => n.id === c.sourceId);
              const tgt = nodes.find((n) => n.id === c.targetId);
              const cfg = PROTOCOL_CONFIG[c.protocol] || PROTOCOL_CONFIG.REST;

              return (
                <div
                  key={c.id}
                  onDoubleClick={() => !isLocked && handleOpenEditConnection(c)}
                  title="더블클릭하여 연결선 속성 수정"
                  className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px] cursor-pointer hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border ${cfg.bg} ${cfg.text}`}
                      style={{ borderColor: cfg.stroke }}
                    >
                      {c.protocol}
                    </span>
                    <span className="text-slate-300 truncate font-medium">
                      {src?.name || 'Unknown'} → {tgt?.name || 'Unknown'}
                    </span>
                    {c.label && <span className="text-slate-500 text-[10px]">({c.label})</span>}
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => onDeleteConnection(c.id)}
                      className="text-slate-600 hover:text-rose-400 p-0.5"
                      title="연결선 삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resizer Divider between Left and Right Panel */}
      <div
        onMouseDown={onStartResize}
        onDoubleClick={onResetResize}
        className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
        title="드래그하여 사이드바 너비 조절 (더블클릭 시 40% 리셋)"
      >
        <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
      </div>

      {/* RIGHT PANEL: Layered Architecture Canvas with Multi-Color SVG Connections */}
      <div 
        className={`flex-col h-full bg-slate-950/60 overflow-hidden relative ${
          isDesktop ? 'flex-1 min-w-0 flex' : (mobileTab === 'canvas' ? 'w-full flex' : 'hidden')
        }`}
      >
        {/* Canvas Toolbar & Protocol Legend */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">
                {currentVersion.versionNumber} ({currentVersion.label})
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                · {currentVersion.description}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom buttons */}
              <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-300">
                <button
                  onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                  className="p-1 hover:text-white"
                  title="확대"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                  className="p-1 hover:text-white"
                  title="축소"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setZoom(1)} className="p-1 hover:text-white" title="배율 초기화">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Protocol Legend Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto text-[10px] pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 font-semibold shrink-0">프로토콜 식별선:</span>
            <button
              onClick={() => setFilterProtocol('All')}
              className={`px-2 py-0.5 rounded transition-all shrink-0 ${
                filterProtocol === 'All'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              전체 보기
            </button>
            {(Object.keys(PROTOCOL_CONFIG) as ArchProtocol[]).map((proto) => {
              const cfg = PROTOCOL_CONFIG[proto];
              const isSelected = filterProtocol === proto;

              return (
                <button
                  key={proto}
                  onClick={() => setFilterProtocol(isSelected ? 'All' : proto)}
                  className={`px-2 py-0.5 rounded flex items-center gap-1.5 transition-all shrink-0 border ${
                    isSelected ? 'ring-1 ring-white font-bold scale-105' : 'opacity-85 hover:opacity-100'
                  } ${cfg.bg} ${cfg.text}`}
                  style={{ borderColor: cfg.stroke }}
                  title={cfg.desc}
                >
                  <span
                    className="w-2.5 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.stroke }}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas Area with Colored SVG Connections */}
        <div
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 overflow-auto relative select-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
        >
          {/* Layer Headers Guide */}
          <div className="absolute top-2 left-6 right-6 flex justify-between pointer-events-none opacity-40 text-[11px] font-mono uppercase tracking-widest text-slate-500">
            <span>[Client Tier]</span>
            <span>[Gateway &amp; Core Services]</span>
            <span>[Cache &amp; Message Queue]</span>
            <span>[Data Persistence]</span>
          </div>

          {/* SVG Connection Lines with protocol colors */}
          <svg className="absolute inset-0 w-[1300px] h-[900px] pointer-events-none z-0">
            <defs>
              {(Object.keys(PROTOCOL_CONFIG) as ArchProtocol[]).map((proto) => {
                const cfg = PROTOCOL_CONFIG[proto];
                return (
                  <marker
                    key={`arrow-${proto}`}
                    id={`arrow-${proto}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={cfg.stroke} />
                  </marker>
                );
              })}
            </defs>

            {filteredConnections.map((c) => {
              const source = nodes.find((n) => n.id === c.sourceId);
              const target = nodes.find((n) => n.id === c.targetId);
              if (!source || !target) return null;

              const cfg = PROTOCOL_CONFIG[c.protocol] || PROTOCOL_CONFIG.REST;

              const sx = source.x + 100;
              const sy = source.y + 40;
              const tx = target.x + 100;
              const ty = target.y + 40;

              const midX = (sx + tx) / 2;
              const midY = (sy + ty) / 2;

              return (
                <g key={c.id}>
                  {/* Glowing background line */}
                  <path
                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={cfg.strokeWidth + 3}
                    opacity="0.18"
                  />
                  {/* Main Protocol Line */}
                  <path
                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={cfg.strokeWidth}
                    strokeDasharray={cfg.dash || 'none'}
                    markerEnd={`url(#arrow-${c.protocol})`}
                  />
                  {/* Protocol Badge Tag (Double-click to edit) */}
                  <g
                    className="cursor-pointer pointer-events-auto"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!isLocked) handleOpenEditConnection(c);
                    }}
                  >
                    <title>{c.label ? `${c.label} (${c.protocol})${c.description ? ' - ' + c.description : ''} (더블클릭하여 편집)` : `${c.protocol} 연결선 (더블클릭하여 편집)`}</title>
                    <rect
                      x={midX - 35}
                      y={midY - 10}
                      width="70"
                      height="20"
                      rx="5"
                      fill="#020617"
                      stroke={cfg.stroke}
                      strokeWidth="1.5"
                      className="hover:stroke-white transition-colors"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      textAnchor="middle"
                      fill={cfg.stroke}
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {c.protocol}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Draggable Node Cards */}
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="absolute inset-0 w-[1300px] h-[900px]"
          >
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isVisible = isNodeVisible(node);
              const meta = CATEGORY_META[node.category];

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!isLocked) handleOpenEditNode(node);
                  }}
                  title="더블클릭하여 노드 속성(이름, 역할설명, 기술스택, 조직) 수정"
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className={`absolute w-52 p-3 rounded-xl border bg-slate-900/95 shadow-xl cursor-move transition-opacity ${
                    isVisible ? 'opacity-100' : 'opacity-20 pointer-events-none'
                  } ${
                    isSelected
                      ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-indigo-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${meta.bg} ${meta.color} ${meta.border}`}>
                      {node.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {node.assignedTeam}
                    </span>
                  </div>

                  <h5 className="text-xs font-bold text-white mb-1 truncate">{node.name}</h5>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                    {node.description}
                  </p>

                  <div className="flex items-center gap-1 flex-wrap">
                    {node.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[9px] text-slate-300 font-mono"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* Edit Architecture Node Modal (TC-ARCH-01) */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">아키텍처 노드 속성 편집</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID 보존: {editingNode.id} (좌표 및 기존 연결관계 유지)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditNode} className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">컴포넌트 이름</label>
                  <input
                    type="text"
                    value={editNodeName}
                    onChange={(e) => setEditNodeName(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">계층 (Category)</label>
                  <select
                    value={editNodeCategory}
                    onChange={(e) => setEditNodeCategory(e.target.value as ArchCategory)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Client">Client</option>
                    <option value="Service">Service</option>
                    <option value="Messaging">Messaging</option>
                    <option value="DataStore">DataStore</option>
                    <option value="Infra">Infra</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">담당 조직</label>
                  <select
                    value={editNodeAssignedTeam}
                    onChange={(e) => setEditNodeAssignedTeam(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Backend">Backend</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Infra">Infra</option>
                    <option value="Common">Common</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">기술 스택 (쉼표로 구분)</label>
                <input
                  type="text"
                  placeholder="예: React 19, TypeScript, Vite"
                  value={editTechStack}
                  onChange={(e) => setEditTechStack(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">역할 및 상세 설명 (description)</label>
                <textarea
                  rows={3}
                  placeholder="컴포넌트의 책임과 역할을 기술합니다."
                  value={editNodeDesc}
                  onChange={(e) => setEditNodeDesc(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingNode(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!editNodeName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  속성 저장 (ID 보존)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Architecture Connection Modal (TC-ARCH-02) */}
      {editingConnection && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <Link className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">통신 연결선 속성 편집</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID 보존: {editingConnection.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingConnection(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditConnection} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">출발 노드 (Source)</label>
                  <select
                    value={editConnSourceId}
                    onChange={(e) => setEditConnSourceId(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">도착 노드 (Target)</label>
                  <select
                    value={editConnTargetId}
                    onChange={(e) => setEditConnTargetId(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">통신 프로토콜</label>
                  <select
                    value={editConnProtocol}
                    onChange={(e) => setEditConnProtocol(e.target.value as ArchProtocol)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                  >
                    <option value="REST">REST (Sky Blue - HTTPS)</option>
                    <option value="WebSocket">WebSocket (Amber - 실시간 WSS)</option>
                    <option value="gRPC">gRPC (Purple - 내부 RPC)</option>
                    <option value="Pub/Sub">Pub/Sub (Rose - 이벤트 큐)</option>
                    <option value="SQL">SQL (Emerald - DB 커넥션)</option>
                    <option value="Redis">Redis (Orange - 캐시 커맨드)</option>
                    <option value="Kafka">Kafka (Cyan - 스트리밍)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">라벨 이름 (옵션)</label>
                  <input
                    type="text"
                    placeholder="예: 실시간 QR 인증 이벤트"
                    value={editConnLabel}
                    onChange={(e) => setEditConnLabel(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">상세 설명 / 프로토콜 규격 (description)</label>
                <textarea
                  rows={2}
                  placeholder="통신 방식, 방향성, 주기 또는 페이로드 규격을 기재합니다."
                  value={editConnDesc}
                  onChange={(e) => setEditConnDesc(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingConnection(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={editConnSourceId === editConnTargetId}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 transition-colors shadow-lg shadow-sky-600/20"
                >
                  속성 저장 (ID 보존)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save New Architecture Version Modal */}
      {showSaveVersionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Save className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">아키텍처 신규 버전 스냅샷 저장</h4>
                  <p className="text-[11px] text-slate-400">
                    현재 캔버스의 노드 배치 및 연결선을 버전으로 박제합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveVersionModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVersionSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300">버전 식별 번호</label>
                <input
                  type="text"
                  value={newVersionNum}
                  onChange={(e) => setNewVersionNum(e.target.value)}
                  placeholder="예: v2.0 (Kafka 마이크로서비스)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">버전 핵심 라벨</label>
                <input
                  type="text"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  placeholder="예: 비동기 큐 분리"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">변경 사유 및 설명</label>
                <textarea
                  rows={3}
                  value={newVersionDesc}
                  onChange={(e) => setNewVersionDesc(e.target.value)}
                  placeholder="이번 아키텍처 개편에서 무엇이 변경되었는지 기록하세요..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSaveVersionModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>새 버전으로 저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionListModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">아키텍처 버전 히스토리</h4>
                  <p className="text-[11px] text-slate-400">저장된 버전 스냅샷을 확인하고 원하는 버전으로 전환합니다.</p>
                </div>
              </div>
              <button
                onClick={() => setShowVersionListModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 divide-y divide-slate-800 max-h-[60vh] overflow-y-auto space-y-3">
              {archVersions.map((ver) => {
                const isActive = ver.id === currentVersionId;
                return (
                  <div key={ver.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{ver.versionNumber}</span>
                        <span className="text-xs text-indigo-300 font-semibold">{ver.label}</span>
                        {isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40">
                            현재 활성
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{ver.description}</p>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        작성 일시: {ver.createdAt} · 노드 {ver.nodes.length}개 · 연결선 {ver.connections.length}개
                      </div>
                    </div>

                    {!isActive && (
                      <button
                        onClick={() => {
                          onSwitchVersion(ver.id);
                          setShowVersionListModal(false);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold shrink-0 transition-colors"
                      >
                        이 버전 불러오기
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

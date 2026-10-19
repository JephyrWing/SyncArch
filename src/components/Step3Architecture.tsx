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
  Lock
} from 'lucide-react';
import type { ArchNode, ArchConnection, ArchCategory, ArchProtocol } from '../types/index.ts';

interface Step3ArchitectureProps {
  nodes: ArchNode[];
  connections: ArchConnection[];
  onAddNode: (node: Omit<ArchNode, 'id'>) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onAddConnection: (conn: Omit<ArchConnection, 'id'>) => void;
  onDeleteConnection: (id: string) => void;
  isLocked: boolean;
  onTriggerAiDraft: () => void;
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

const PROTOCOL_COLORS: Record<ArchProtocol, { bg: string; text: string }> = {
  REST: { bg: 'bg-blue-900/80', text: 'text-blue-300' },
  gRPC: { bg: 'bg-purple-900/80', text: 'text-purple-300' },
  WebSocket: { bg: 'bg-amber-900/80', text: 'text-amber-300' },
  'Pub/Sub': { bg: 'bg-rose-900/80', text: 'text-rose-300' },
  SQL: { bg: 'bg-emerald-900/80', text: 'text-emerald-300' },
  Redis: { bg: 'bg-red-900/80', text: 'text-red-300' },
};

export const Step3Architecture: React.FC<Step3ArchitectureProps> = ({
  nodes,
  connections,
  onAddNode,
  onUpdateNodePosition,
  onDeleteNode,
  onAddConnection,
  onDeleteConnection,
  isLocked,
  onTriggerAiDraft,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddConn, setShowAddConn] = useState(false);

  // Form State
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeCategory, setNewNodeCategory] = useState<ArchCategory>('Service');
  const [newTechStack, setNewTechStack] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');

  // Connection State
  const [sourceNodeId, setSourceNodeId] = useState(nodes[0]?.id || '');
  const [targetNodeId, setTargetNodeId] = useState(nodes[1]?.id || '');
  const [protocol, setProtocol] = useState<ArchProtocol>('REST');
  const [connLabel, setConnLabel] = useState('');

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
      const newX = Math.max(20, Math.min(1100, Math.round(e.clientX - dragOffset.x)));
      const newY = Math.max(20, Math.min(700, Math.round(e.clientY - dragOffset.y)));
      onUpdateNodePosition(draggingNodeId, newX, newY);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim() || isLocked) return;

    const stacks = newTechStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onAddNode({
      category: newNodeCategory,
      name: newNodeName.trim(),
      techStack: stacks.length > 0 ? stacks : ['TypeScript'],
      x: 350 + Math.floor(Math.random() * 80),
      y: 200 + Math.floor(Math.random() * 80),
      description: newNodeDesc.trim() || '서비스 컴포넌트',
    });

    setNewNodeName('');
    setNewTechStack('');
    setNewNodeDesc('');
    setShowAddNode(false);
  };

  const handleCreateConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId || isLocked) return;

    onAddConnection({
      sourceId: sourceNodeId,
      targetId: targetNodeId,
      protocol,
      label: connLabel.trim() || undefined,
    });

    setConnLabel('');
    setShowAddConn(false);
  };

  const handleQuickAddPreset = (category: ArchCategory, name: string, stack: string[]) => {
    if (isLocked) return;
    onAddNode({
      category,
      name,
      techStack: stack,
      x: category === 'Client' ? 60 : category === 'Service' ? 380 : category === 'Messaging' ? 660 : 920,
      y: 120 + Math.floor(Math.random() * 180),
      description: `${name} 인스턴스`,
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* LEFT PANEL: 42% Structured Component & Connection Editor */}
      <div className="w-[42%] border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Network className="w-4 h-4" />
              Step 3. 시스템 아키텍처 설계
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              컴포넌트 {nodes.length}개 / 연결선 {connections.length}개
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isLocked && (
              <>
                <button
                  onClick={() => setShowAddConn(!showAddConn)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-[11px] font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                >
                  <Link className="w-3 h-3" />
                  <span>연결선 추가</span>
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

        {/* Add Connection Form */}
        {showAddConn && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/90 shrink-0">
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
                    <option value="REST">REST / HTTPS</option>
                    <option value="gRPC">gRPC</option>
                    <option value="WebSocket">WebSocket / WSS</option>
                    <option value="Pub/Sub">Pub/Sub Message</option>
                    <option value="SQL">SQL (PostgreSQL/MySQL)</option>
                    <option value="Redis">Redis Command</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">라벨 설명 (옵션)</label>
                  <input
                    type="text"
                    placeholder="예: 실시간 출석 이벤트"
                    value={connLabel}
                    onChange={(e) => setConnLabel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                  />
                </div>
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
          <div className="p-3 border-b border-slate-800 bg-slate-950/90 shrink-0">
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

              <div className="grid grid-cols-2 gap-2">
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
                  <label className="text-[10px] text-slate-400">레이어 카테고리</label>
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
                <label className="text-[10px] text-slate-400">컴포넌트 역할 설명</label>
                <input
                  type="text"
                  placeholder="예: 스터디 시작 30분 전 푸시 알림 비동기 처리"
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

        {/* Nodes and Connections list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
          <div className="p-3 bg-slate-900/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            컴포넌트 목록 ({nodes.length})
          </div>

          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const meta = CATEGORY_META[node.category];

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`p-3 cursor-pointer transition-colors group ${
                  isSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${meta.bg} ${meta.border} ${meta.color} flex items-center gap-1`}>
                      <meta.icon className="w-2.5 h-2.5" />
                      {node.category}
                    </span>
                    <span className="text-xs font-bold text-white">{node.name}</span>
                  </div>

                  {!isLocked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      className="text-slate-600 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mb-2">{node.description}</p>

                <div className="flex items-center gap-1 flex-wrap">
                  {node.techStack.map((tech, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Connections sub-list */}
          <div className="p-3 bg-slate-900/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            등록된 프로토콜 연결선 ({connections.length})
          </div>

          <div className="p-2 space-y-1.5">
            {connections.map((c) => {
              const src = nodes.find((n) => n.id === c.sourceId)?.name || c.sourceId;
              const tgt = nodes.find((n) => n.id === c.targetId)?.name || c.targetId;
              const pMeta = PROTOCOL_COLORS[c.protocol];

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2 rounded bg-slate-950/70 border border-slate-800 text-xs text-slate-300 group"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-white">{src}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${pMeta.bg} ${pMeta.text}`}>
                      {c.protocol}
                    </span>
                    <span className="font-semibold text-white">{tgt}</span>
                    {c.label && <span className="text-[10px] text-slate-500">({c.label})</span>}
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => onDeleteConnection(c.id)}
                      className="text-slate-600 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="연결선 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: 58% Visual Architecture Block Diagram & Canvas */}
      <div className="w-[58%] flex flex-col h-full bg-slate-950/80 overflow-hidden relative">
        {/* Top Preset Component Palette */}
        <div className="h-11 px-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">프리셋 추가:</span>
            <button
              onClick={() => handleQuickAddPreset('Service', 'Auth Service', ['Node.js', 'JWT'])}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium border border-slate-700"
            >
              + Auth
            </button>
            <button
              onClick={() => handleQuickAddPreset('Messaging', 'Kafka Cluster', ['Apache Kafka', 'Zookeeper'])}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium border border-slate-700"
            >
              + Kafka
            </button>
            <button
              onClick={() => handleQuickAddPreset('Infra', 'Cloud CDN & WAF', ['Cloudflare', 'TLS 1.3'])}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium border border-slate-700"
            >
              + CDN / WAF
            </button>
            <button
              onClick={() => handleQuickAddPreset('DataStore', 'ElasticSearch', ['Lucene', 'Kibana'])}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium border border-slate-700"
            >
              + Search DB
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-slate-400">
              <button
                onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
                className="p-1 hover:text-white"
                title="확대"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
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
            <button
              onClick={onTriggerAiDraft}
              className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI 아키텍처 제안</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
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

          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 w-[1200px] h-[800px] pointer-events-none z-0">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>

            {connections.map((c) => {
              const source = nodes.find((n) => n.id === c.sourceId);
              const target = nodes.find((n) => n.id === c.targetId);
              if (!source || !target) return null;

              const sx = source.x + 100;
              const sy = source.y + 40;
              const tx = target.x + 100;
              const ty = target.y + 40;

              const midX = (sx + tx) / 2;
              const midY = (sy + ty) / 2;

              return (
                <g key={c.id}>
                  <path
                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="2"
                    strokeDasharray={c.protocol === 'WebSocket' ? '4 4' : 'none'}
                    markerEnd="url(#arrow)"
                  />
                  {/* Protocol Badge at center of line */}
                  <rect
                    x={midX - 25}
                    y={midY - 10}
                    width="50"
                    height="18"
                    rx="4"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {c.protocol}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Draggable Architecture Nodes */}
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="w-[1200px] h-[800px] relative"
          >
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const meta = CATEGORY_META[node.category];

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{ left: node.x, top: node.y }}
                  className={`absolute w-52 p-3.5 rounded-xl border-2 bg-slate-900 shadow-2xl cursor-grab active:cursor-grabbing transition-shadow z-10 ${
                    isSelected
                      ? 'border-indigo-500 ring-4 ring-indigo-500/20 shadow-indigo-500/20'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${meta.bg} ${meta.border} ${meta.color} flex items-center gap-1`}>
                      <meta.icon className="w-3 h-3" />
                      {node.category}
                    </span>
                    <Move className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                  </div>

                  <h4 className="text-xs font-bold text-white mb-1">{node.name}</h4>
                  <p className="text-[10px] text-slate-400 leading-tight mb-2.5 line-clamp-2">
                    {node.description}
                  </p>

                  <div className="flex items-center gap-1 flex-wrap">
                    {node.techStack.map((tech, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-300"
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
  );
};

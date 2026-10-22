import React, { useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ArchConnection, ArchNode, ArchProtocol, ArchVersion } from '../../types/index.ts';
import { CATEGORY_META, PROTOCOL_CONFIG } from './archConfig.ts';

interface ArchCanvasProps {
  nodes: ArchNode[];
  connections: ArchConnection[];
  currentVersion?: ArchVersion;
  filterProtocol: ArchProtocol | 'All';
  onChangeFilterProtocol: (protocol: ArchProtocol | 'All') => void;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
  isNodeVisible: (node: ArchNode) => boolean;
  isLocked: boolean;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onEditNode: (id: string) => void;
  onEditConnection: (id: string) => void;
}

export const ArchCanvas: React.FC<ArchCanvasProps> = ({
  nodes,
  connections,
  currentVersion,
  filterProtocol,
  onChangeFilterProtocol,
  selectedNodeId,
  onSelectNode,
  isNodeVisible,
  isLocked,
  onUpdateNodePosition,
  onEditNode,
  onEditConnection,
}) => {
  // [시스템 아키텍처] 캔버스 드래그와 확대·축소
  const [zoom, setZoom] = useState(1);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleNodeMouseDown = (e: React.MouseEvent, node: ArchNode) => {
    if (isLocked) return;
    e.stopPropagation();
    setDraggingNodeId(node.id);
    onSelectNode(node.id);
    // [시스템 아키텍처] 마우스 좌표를 zoom으로 나눠 캔버스 좌표로 맞춘다.
    setDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const newX = Math.max(20, Math.min(1150, Math.round(e.clientX / zoom - dragOffset.x)));
      const newY = Math.max(20, Math.min(750, Math.round(e.clientY / zoom - dragOffset.y)));
      onUpdateNodePosition(draggingNodeId, newX, newY);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  return (
    <>
      {/* [시스템 아키텍처] 캔버스 툴바와 프로토콜 범례 */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* [시스템 아키텍처] 서버에서 만든 프로젝트는 저장된 버전 없이 시작한다. */}
            {currentVersion && (
              <>
                <span className="text-xs font-semibold text-slate-200">
                  {currentVersion.versionNumber} ({currentVersion.label})
                </span>
                <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                  · {currentVersion.description}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* [시스템 아키텍처] 확대·축소 버튼 */}
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

        {/* [시스템 아키텍처] 프로토콜 범례 필터 바 */}
        <div className="flex items-center gap-2 overflow-x-auto text-[10px] pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold shrink-0">프로토콜 식별선:</span>
          <button
            onClick={() => onChangeFilterProtocol('All')}
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
                onClick={() => onChangeFilterProtocol(isSelected ? 'All' : proto)}
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

      {/* [시스템 아키텍처] 색상 SVG 연결선이 있는 캔버스 영역 */}
      <div
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        className="flex-1 overflow-auto relative select-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {/* [시스템 아키텍처] 계층 헤더 안내 */}
        <div className="absolute top-2 left-6 right-6 flex justify-between pointer-events-none opacity-40 text-[11px] font-mono uppercase tracking-widest text-slate-500">
          <span>[Client Tier]</span>
          <span>[Gateway &amp; Core Services]</span>
          <span>[Cache &amp; Message Queue]</span>
          <span>[Data Persistence]</span>
        </div>

        {/* [시스템 아키텍처] 확대·축소 레이어. 연결선과 노드가 같이 커져야 선이 노드에서 어긋나지 않는다. */}
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="absolute inset-0 w-[1300px] h-[900px]"
        >
          {/* [시스템 아키텍처] 프로토콜 색상 SVG 연결선 */}
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

            {connections.map((c) => {
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
                  {/* [시스템 아키텍처] 빛나는 배경선 */}
                  <path
                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={cfg.strokeWidth + 3}
                    opacity="0.18"
                  />
                  {/* [시스템 아키텍처] 주 프로토콜 선 */}
                  <path
                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                    fill="none"
                    stroke={cfg.stroke}
                    strokeWidth={cfg.strokeWidth}
                    strokeDasharray={cfg.dash || 'none'}
                    markerEnd={`url(#arrow-${c.protocol})`}
                  />
                  {/* [시스템 아키텍처] 프로토콜 배지(더블클릭하면 편집). svg가 pointer-events-none이라 배지만 다시 켠다. */}
                  <g
                    className="cursor-pointer pointer-events-auto"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!isLocked) onEditConnection(c.id);
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

          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isVisible = isNodeVisible(node);
            const meta = CATEGORY_META[node.category];

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!isLocked) onEditNode(node.id);
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
    </>
  );
};

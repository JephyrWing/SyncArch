import React, { useRef, useState } from 'react';
import { Maximize, Pencil, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ArchConnection, ArchNode, ArchProtocol } from '../../types/index.ts';
import { CATEGORY_META, PROTOCOL_CONFIG } from './archConfig.ts';

interface ArchCanvasProps {
  nodes: ArchNode[];
  connections: ArchConnection[];
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
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const { zoom } = view;
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasPoint = (e: React.MouseEvent) => {
    const viewport = viewportRef.current!;
    const rect = viewport.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left + viewport.scrollLeft - view.x) / zoom,
      y: (e.clientY - rect.top + viewport.scrollTop - view.y) / zoom,
    };
  };

  const resetView = () => {
    setView({ zoom: 1, x: 0, y: 0 });
    viewportRef.current?.scrollTo(0, 0);
  };

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 화면 중앙의 지점을 유지하며 확대한다. 보기 변경은 노드 좌표를 저장하지 않는다.
    const centerX = viewport.clientWidth / 2 + viewport.scrollLeft;
    const centerY = viewport.clientHeight / 2 + viewport.scrollTop;
    setView((previous) => {
      const next = Math.min(1.5, Math.max(0.01, previous.zoom * factor));
      const ratio = next / previous.zoom;
      return { zoom: next, x: centerX - (centerX - previous.x) * ratio, y: centerY - (centerY - previous.y) * ratio };
    });
  };

  const fitAll = () => {
    const viewport = viewportRef.current;
    const cards = Array.from(layerRef.current?.querySelectorAll<HTMLElement>('[data-arch-node]') ?? []);
    if (!viewport || !cards.length || viewport.clientWidth <= 64 || viewport.clientHeight <= 64) return;
    // 내용 높이는 실제 카드 크기로 구한다. 기술 스택이 여러 줄이어도 잘리지 않는다.
    const left = Math.min(...cards.map((card) => card.offsetLeft));
    const top = Math.min(...cards.map((card) => card.offsetTop));
    const right = Math.max(...cards.map((card) => card.offsetLeft + card.offsetWidth));
    const bottom = Math.max(...cards.map((card) => card.offsetTop + card.offsetHeight));
    const next = Math.min(1.5, (viewport.clientWidth - 64) / (right - left), (viewport.clientHeight - 64) / (bottom - top));
    viewport.scrollTo(0, 0);
    setView({ zoom: next, x: (viewport.clientWidth - (right - left) * next) / 2 - left * next,
      y: (viewport.clientHeight - (bottom - top) * next) / 2 - top * next });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: ArchNode) => {
    if (isLocked) return;
    e.stopPropagation();
    setDraggingNodeId(node.id);
    onSelectNode(node.id);
    const point = canvasPoint(e);
    setDragOffset({
      x: point.x - node.x,
      y: point.y - node.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const point = canvasPoint(e);
      const newX = Math.max(20, Math.min(1150, Math.round(point.x - dragOffset.x)));
      const newY = Math.max(20, Math.min(750, Math.round(point.y - dragOffset.y)));
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">현재 아키텍처</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fitAll}
              disabled={nodes.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              title="모든 노드가 화면에 들어오도록 맞추기"
            >
              <Maximize className="w-3.5 h-3.5" />
              캔버스 전체 보기
            </button>
            {/* [시스템 아키텍처] 확대·축소 버튼 */}
            <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-300">
              <button
                onClick={() => zoomBy(1.1)}
                className="p-1 hover:text-white"
                title="확대"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => zoomBy(1 / 1.1)}
                className="p-1 hover:text-white"
                title="축소"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button onClick={resetView} className="p-1 hover:text-white" title="배율 초기화">
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
        ref={viewportRef}
        aria-label="아키텍처 캔버스"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
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
          ref={layerRef}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${zoom})`, transformOrigin: 'top left' }}
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
                data-arch-node={node.id}
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
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-mono">{node.assignedTeam ?? '미지정'}</span>
                    {!isLocked && (
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onEditNode(node.id); }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800"
                        title={`${node.name} 캔버스 노드 편집`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
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

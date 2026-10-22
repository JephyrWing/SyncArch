import React, { useState } from 'react';
import { Database, Key, Link2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ErdTable } from '../../types/index.ts';

interface ErdCanvasProps {
  tables: ErdTable[];
  selectedTableId?: string;
  onSelectTable: (id: string) => void;
  isLocked: boolean;
  onUpdateTablePosition: (id: string, x: number, y: number) => void;
}

export const ErdCanvas: React.FC<ErdCanvasProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
  isLocked,
  onUpdateTablePosition,
}) => {
  // [ERD 설계] 캔버스 확대·축소와 이동
  const [zoom, setZoom] = useState(1);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleTableMouseDown = (e: React.MouseEvent, table: ErdTable) => {
    if (isLocked) return;
    e.stopPropagation();
    setDraggingTableId(table.id);
    onSelectTable(table.id);
    // [ERD 설계] 마우스 좌표를 zoom으로 나눠 캔버스 좌표로 맞춘다.
    setDragOffset({
      x: e.clientX / zoom - table.x,
      y: e.clientY / zoom - table.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingTableId) {
      const newX = Math.max(20, Math.min(1200, Math.round(e.clientX / zoom - dragOffset.x)));
      const newY = Math.max(20, Math.min(800, Math.round(e.clientY / zoom - dragOffset.y)));
      onUpdateTablePosition(draggingTableId, newX, newY);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingTableId(null);
  };

  return (
    <>
      {/* [ERD 설계] 캔버스 툴바 */}
      <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">Crow's Foot ERD 관계 캔버스</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">· 1:N 외래키 관계선 자동 연결</span>
        </div>

        <div className="flex items-center gap-2">
          {/* [ERD 설계] 확대·축소 버튼 */}
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

      {/* [ERD 설계] FK 선이 있는 캔버스 영역 */}
      <div
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        className="flex-1 overflow-auto relative select-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {/* [ERD 설계] 확대·축소 레이어. FK 선과 카드가 같이 커져야 선이 카드에서 어긋나지 않는다. */}
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="absolute inset-0 w-[1400px] h-[1000px]"
        >
          {/* [ERD 설계] FK를 잇는 SVG 선 */}
          <svg className="absolute inset-0 w-[1400px] h-[1000px] pointer-events-none z-0">
            <defs>
              <marker
                id="crow-foot"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
              </marker>
            </defs>

            {tables.map((childTable) => {
              return childTable.columns.map((col) => {
                if (!col.isForeignKey || !col.references) return null;
                const [parentTableName] = col.references.split('.');
                const parentTable = tables.find(
                  (t) => t.name.toLowerCase() === parentTableName?.toLowerCase()
                );
                if (!parentTable) return null;

                // [ERD 설계] 테이블 중심 좌표 계산
                const px = parentTable.x + 140;
                const py = parentTable.y + 60;
                const cx = childTable.x + 140;
                const cy = childTable.y + 60;

                const midX = (px + cx) / 2;
                const midY = (py + cy) / 2;

                return (
                  <g key={`${childTable.id}-${col.id}`}>
                    {/* [ERD 설계] 빛나는 선 */}
                    <path
                      d={`M ${px} ${py} C ${midX} ${py}, ${midX} ${cy}, ${cx} ${cy}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="4"
                      opacity="0.15"
                    />
                    {/* [ERD 설계] 관계 연결선 */}
                    <path
                      d={`M ${px} ${py} C ${midX} ${py}, ${midX} ${cy}, ${cx} ${cy}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      markerEnd="url(#crow-foot)"
                    />
                    {/* [ERD 설계] 까마귀발 배지 */}
                    <rect
                      x={midX - 25}
                      y={midY - 8}
                      width="50"
                      height="16"
                      rx="4"
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      1 : N
                    </text>
                  </g>
                );
              });
            })}
          </svg>

          {tables.map((table) => {
            const isSelected = selectedTableId === table.id;

            return (
              <div
                key={table.id}
                onMouseDown={(e) => handleTableMouseDown(e, table)}
                style={{ left: `${table.x}px`, top: `${table.y}px` }}
                className={`absolute w-72 rounded-xl border bg-slate-900/95 shadow-2xl overflow-hidden cursor-move transition-shadow ${
                  isSelected
                    ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-indigo-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* [ERD 설계] 테이블 카드 헤더 */}
                <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <Database className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-xs font-bold text-white font-mono truncate">{table.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {table.columns.length} cols
                  </span>
                </div>

                {/* [ERD 설계] 테이블 컬럼 목록 */}
                <div className="p-2 space-y-1 font-mono text-xs max-h-56 overflow-y-auto">
                  {table.columns.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {col.isPrimaryKey ? (
                          <span title="Primary Key"><Key className="w-3 h-3 text-amber-400 shrink-0" /></span>
                        ) : col.isForeignKey ? (
                          <span title="Foreign Key"><Link2 className="w-3 h-3 text-sky-400 shrink-0" /></span>
                        ) : (
                          <span className="w-3 h-3 block shrink-0" />
                        )}
                        <span
                          className={`truncate ${
                            col.isPrimaryKey ? 'font-bold text-white' : 'text-slate-300'
                          }`}
                        >
                          {col.name}
                        </span>
                      </div>

                      <span className="text-[10px] text-indigo-400 shrink-0">{col.dataType}</span>
                    </div>
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

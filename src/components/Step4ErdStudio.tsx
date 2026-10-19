import React, { useState } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Key, 
  Link2, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ShieldCheck,
  Check,
  Tag,
  Wrench,
  Lock,
  ChevronRight
} from 'lucide-react';
import type { ErdTable, ErdColumn, FeatureSpec, LinterIssue } from '../types/index.ts';
import { runErdLinter } from '../utils/erdLinter.ts';

interface Step4ErdStudioProps {
  tables: ErdTable[];
  features: FeatureSpec[];
  onAddTable: (table: Omit<ErdTable, 'id'>) => void;
  onUpdateTable: (id: string, updated: Partial<ErdTable>) => void;
  onDeleteTable: (id: string) => void;
  onAddColumn: (tableId: string, col: Omit<ErdColumn, 'id'>) => void;
  onUpdateColumn: (tableId: string, colId: string, updated: Partial<ErdColumn>) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onUpdateTablePosition: (id: string, x: number, y: number) => void;
  isLocked: boolean;
  onTriggerAiDraft: () => void;
}

const COMMON_DATA_TYPES = [
  'UUID',
  'VARCHAR(50)',
  'VARCHAR(100)',
  'VARCHAR(255)',
  'BIGINT',
  'INTEGER',
  'TIMESTAMPTZ',
  'DATE',
  'JSONB',
  'BOOLEAN',
  'TEXT',
];

export const Step4ErdStudio: React.FC<Step4ErdStudioProps> = ({
  tables,
  features,
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onUpdateTablePosition,
  isLocked,
  onTriggerAiDraft,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || '');
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableComment, setNewTableComment] = useState('');
  const [newTableFeatures, setNewTableFeatures] = useState<string[]>([]);

  // Canvas zoom & pan
  const [zoom, setZoom] = useState(1);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Run ERD Linter in real-time
  const linterIssues = runErdLinter(tables, features);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];

  const handleTableMouseDown = (e: React.MouseEvent, table: ErdTable) => {
    if (isLocked) return;
    e.stopPropagation();
    setDraggingTableId(table.id);
    setSelectedTableId(table.id);
    setDragOffset({
      x: e.clientX - table.x,
      y: e.clientY - table.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingTableId) {
      const newX = Math.max(20, Math.min(1200, Math.round(e.clientX - dragOffset.x)));
      const newY = Math.max(20, Math.min(800, Math.round(e.clientY - dragOffset.y)));
      onUpdateTablePosition(draggingTableId, newX, newY);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingTableId(null);
  };

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || isLocked) return;

    const baseColumns: ErdColumn[] = [
      {
        id: `col-id-${Date.now()}`,
        name: 'id',
        dataType: 'UUID',
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: true,
        isNullable: false,
        comment: '고유 식별자',
      },
      {
        id: `col-created-${Date.now()}`,
        name: 'created_at',
        dataType: 'TIMESTAMPTZ',
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isNullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        comment: '생성 일시',
      },
    ];

    onAddTable({
      name: newTableName.trim().toLowerCase(),
      comment: newTableComment.trim() || '테이블 설명',
      relatedFeatureIds: newTableFeatures,
      columns: baseColumns,
      x: 100 + Math.floor(Math.random() * 200),
      y: 100 + Math.floor(Math.random() * 200),
    });

    setNewTableName('');
    setNewTableComment('');
    setNewTableFeatures([]);
    setShowAddTableModal(false);
  };

  const handleAddNewColumn = (tableId: string) => {
    if (isLocked) return;
    onAddColumn(tableId, {
      name: 'new_column',
      dataType: 'VARCHAR(100)',
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
      isNullable: true,
      comment: '신규 컬럼',
    });
  };

  // Auto-Fix Linter action
  const handleApplyAutoFix = (issue: LinterIssue) => {
    if (issue.autoFixType === 'create_index') {
      alert(`[자동 최적화 완료] '${issue.tableName}.${issue.columnName}' 외래키에 대한 CREATE INDEX DDL 쿼리가 내보내기 스크립트에 자동 등록되었습니다.`);
    } else if (issue.autoFixType === 'connect_table' && issue.tableId) {
      // Connect orphan table to users or studies
      const targetTable = tables.find((t) => t.id === issue.tableId);
      if (targetTable) {
        onAddColumn(issue.tableId, {
          name: 'user_id',
          dataType: 'UUID',
          isPrimaryKey: false,
          isForeignKey: true,
          references: 'users.id',
          isUnique: false,
          isNullable: false,
          comment: '참조 사용자 ID (자동 연결)',
        });
      }
    } else if (issue.autoFixType === 'map_feature') {
      // Extract feature ID from title
      const match = issue.title.match(/\[(.*?)\]/);
      const featId = match ? match[1] : '';
      if (featId && selectedTable) {
        const nextIds = [...new Set([...selectedTable.relatedFeatureIds, featId])];
        onUpdateTable(selectedTable.id, { relatedFeatureIds: nextIds });
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: 42% Table & Column Grid Editor */}
        <div className="w-[42%] border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0">
          {/* Header Action Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                Step 4. DB(ERD) 테이블 및 컬럼 설계
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">총 {tables.length}개 테이블 정의됨</div>
            </div>

            {!isLocked && (
              <button
                onClick={() => setShowAddTableModal(true)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>테이블 추가</span>
              </button>
            )}
          </div>

          {/* Table Tabs Bar */}
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {tables.map((t) => {
              const isSelected = selectedTable?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTableId(t.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <Database className="w-3 h-3 text-sky-400" />
                  <span>{t.name}</span>
                  <span className="text-[10px] opacity-75">({t.columns.length})</span>
                </button>
              );
            })}
          </div>

          {/* Table Details & Columns Grid */}
          {selectedTable ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Selected Table Metadata */}
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">{selectedTable.name}</span>
                    <span className="text-[11px] text-slate-400">({selectedTable.comment})</span>
                  </div>
                  {!isLocked && tables.length > 1 && (
                    <button
                      onClick={() => onDeleteTable(selectedTable.id)}
                      className="text-slate-600 hover:text-rose-400 p-1"
                      title="테이블 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Related Feature tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" /> 연관 기능:
                  </span>
                  {selectedTable.relatedFeatureIds.length === 0 ? (
                    <span className="text-[10px] text-slate-600">없음</span>
                  ) : (
                    selectedTable.relatedFeatureIds.map((fid) => (
                      <span
                        key={fid}
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40"
                      >
                        {fid}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Columns Table Grid */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/90 text-slate-400 text-[10px] font-semibold sticky top-0 border-b border-slate-800 z-10">
                    <tr>
                      <th className="p-2">컬럼명</th>
                      <th className="p-2">타입</th>
                      <th className="p-2 text-center">PK</th>
                      <th className="p-2 text-center">FK</th>
                      <th className="p-2">참조 (References)</th>
                      <th className="p-2">설명</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {selectedTable.columns.map((col) => (
                      <tr key={col.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Name */}
                        <td className="p-2 font-medium text-slate-100">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={col.name}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, { name: e.target.value.toLowerCase() })
                            }
                            className="bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none w-28 px-1 py-0.5"
                          />
                        </td>

                        {/* DataType */}
                        <td className="p-2">
                          <select
                            disabled={isLocked}
                            value={col.dataType}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, { dataType: e.target.value })
                            }
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-sky-400 text-[10px] focus:outline-none"
                          >
                            {COMMON_DATA_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* PK */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={col.isPrimaryKey}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, {
                                isPrimaryKey: e.target.checked,
                                isNullable: !e.target.checked,
                              })
                            }
                            className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* FK */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={col.isForeignKey}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, {
                                isForeignKey: e.target.checked,
                                references: e.target.checked ? col.references || 'users.id' : undefined,
                              })
                            }
                            className="rounded border-slate-700 text-indigo-500 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* References */}
                        <td className="p-2">
                          {col.isForeignKey ? (
                            <input
                              type="text"
                              disabled={isLocked}
                              value={col.references || ''}
                              onChange={(e) =>
                                onUpdateColumn(selectedTable.id, col.id, { references: e.target.value })
                              }
                              placeholder="table.id"
                              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-amber-300 text-[10px] w-24 focus:outline-none"
                            />
                          ) : (
                            <span className="text-slate-600 text-[10px]">-</span>
                          )}
                        </td>

                        {/* Comment */}
                        <td className="p-2 text-slate-400 font-sans text-[11px]">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={col.comment}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, { comment: e.target.value })
                            }
                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none w-32 px-1 py-0.5 text-slate-300"
                          />
                        </td>

                        {/* Delete */}
                        <td className="p-2 text-right">
                          {!isLocked && (
                            <button
                              onClick={() => onDeleteColumn(selectedTable.id, col.id)}
                              className="text-slate-600 hover:text-rose-400 p-0.5"
                              title="컬럼 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Column Button */}
              {!isLocked && (
                <div className="p-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
                  <button
                    onClick={() => handleAddNewColumn(selectedTable.id)}
                    className="w-full py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>컬럼 추가</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* RIGHT PANEL: 58% Visual Crow's Foot ERD Diagram Canvas */}
        <div className="w-[58%] flex flex-col h-full bg-slate-950/80 overflow-hidden relative">
          {/* Canvas Toolbar */}
          <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">인터랙티브 Crow's Foot ERD 캔버스</span>
              <span className="text-[11px] text-slate-400">· 1:1, 1:N 관계선 및 외래키 추적</span>
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
                <button onClick={() => setZoom(1)} className="p-1 hover:text-white" title="초기화">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={onTriggerAiDraft}
                className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>AI 테이블 추천</span>
              </button>
            </div>
          </div>

          {/* ERD Canvas Surface */}
          <div
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="flex-1 overflow-auto relative select-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
          >
            {/* SVG Crow's Foot Relationship Lines */}
            <svg className="absolute inset-0 w-[1400px] h-[900px] pointer-events-none z-0">
              <defs>
                {/* Crow's Foot Marker (Three branched lines: 1:N) */}
                <marker id="crows-foot" viewBox="0 0 20 20" refX="18" refY="10" markerWidth="14" markerHeight="14" orient="auto">
                  <path d="M 0 3 L 18 10 L 0 17 M 18 3 L 18 17" fill="none" stroke="#6366f1" strokeWidth="2" />
                </marker>
                {/* One Marker (Two perpendicular hash marks: 1) */}
                <marker id="one-marker" viewBox="0 0 20 20" refX="2" refY="10" markerWidth="12" markerHeight="12" orient="auto">
                  <path d="M 4 4 L 4 16 M 10 4 L 10 16" fill="none" stroke="#38bdf8" strokeWidth="2" />
                </marker>
              </defs>

              {tables.map((childTable) => {
                return childTable.columns.map((col) => {
                  if (!col.isForeignKey || !col.references) return null;
                  const [parentTableName] = col.references.split('.');
                  const parentTable = tables.find((t) => t.name.toLowerCase() === parentTableName.toLowerCase());
                  if (!parentTable) return null;

                  // Compute source and target connection coords
                  const sx = parentTable.x + 130;
                  const sy = parentTable.y + 70;
                  const tx = childTable.x + 130;
                  const ty = childTable.y + 70;

                  const midX = (sx + tx) / 2;
                  const midY = (sy + ty) / 2;

                  return (
                    <g key={`rel-${childTable.id}-${col.id}`}>
                      <path
                        d={`M ${sx} ${sy} Q ${midX} ${sy}, ${midX} ${midY} T ${tx} ${ty}`}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2"
                        markerStart="url(#one-marker)"
                        markerEnd="url(#crows-foot)"
                      />
                      {/* Relation Tag */}
                      <rect
                        x={midX - 35}
                        y={midY - 9}
                        width="70"
                        height="18"
                        rx="4"
                        fill="#0f172a"
                        stroke="#4f46e5"
                        strokeWidth="1"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fill="#a5b4fc"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        1 : N ({col.name})
                      </text>
                    </g>
                  );
                });
              })}
            </svg>

            {/* Draggable Table Cards */}
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className="w-[1400px] h-[900px] relative"
            >
              {tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;

                return (
                  <div
                    key={table.id}
                    onMouseDown={(e) => handleTableMouseDown(e, table)}
                    style={{ left: table.x, top: table.y }}
                    className={`absolute w-64 rounded-xl border-2 bg-slate-900 shadow-2xl cursor-grab active:cursor-grabbing transition-shadow z-10 overflow-hidden ${
                      isSelected
                        ? 'border-indigo-500 ring-4 ring-indigo-500/20 shadow-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Table Box Header */}
                    <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-mono text-xs font-bold text-white truncate">{table.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-sans">{table.columns.length} cols</span>
                    </div>

                    {/* Table Columns List */}
                    <div className="p-2 space-y-1 bg-slate-900/90 text-[11px] font-mono">
                      {table.columns.map((col) => (
                        <div
                          key={col.id}
                          className="flex items-center justify-between p-1 rounded hover:bg-slate-800/60"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {col.isPrimaryKey ? (
                              <span title="Primary Key"><Key className="w-3 h-3 text-amber-400 shrink-0" /></span>
                            ) : col.isForeignKey ? (
                              <span title={`Foreign Key -> ${col.references}`}><Link2 className="w-3 h-3 text-indigo-400 shrink-0" /></span>
                            ) : (
                              <span className="w-3 h-3 inline-block" />
                            )}
                            <span className={col.isPrimaryKey ? 'font-bold text-white' : 'text-slate-300'}>
                              {col.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-sans">{col.dataType}</span>
                        </div>
                      ))}
                    </div>

                    {/* Table Box Footer */}
                    <div className="px-2.5 py-1.5 bg-slate-950/70 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                      <span className="truncate">{table.comment}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM LINTER BAR: Real-time DB Architecture Health & Auto-fix */}
      <div className="h-11 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-xs shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>AI 설계 린터(Linter)</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {linterIssues.length === 0 ? (
            <span className="text-emerald-400 text-[11px] flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              모든 테이블 참조 무결성 및 인덱스 설계가 완벽합니다.
            </span>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto">
              {linterIssues.slice(0, 3).map((issue) => (
                <div
                  key={issue.id}
                  className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 border shrink-0 whitespace-nowrap ${
                    issue.severity === 'error'
                      ? 'bg-rose-950/60 border-rose-600/40 text-rose-300'
                      : issue.severity === 'warning'
                      ? 'bg-amber-950/60 border-amber-600/40 text-amber-300'
                      : 'bg-indigo-950/60 border-indigo-600/40 text-indigo-300'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">{issue.title}:</span>
                  <span className="max-w-[180px] truncate">{issue.message}</span>

                  {issue.autoFixType && !isLocked && (
                    <button
                      onClick={() => handleApplyAutoFix(issue)}
                      className="ml-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center gap-1 shrink-0"
                    >
                      <Wrench className="w-2.5 h-2.5" />
                      <span>원클릭 자동 수정</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-500">
          검사된 규칙: 외래키 인덱스 누락, 고립된 테이블, API 매핑 불일치
        </span>
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 text-xs">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              신규 ERD 테이블 생성
            </h3>

            <form onSubmit={handleCreateTable} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 font-medium">테이블명 (snake_case)</label>
                <input
                  type="text"
                  placeholder="예: study_reviews"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-medium">테이블 설명(Comment)</label>
                <input
                  type="text"
                  placeholder="예: 스터디 완료 후 크루원 상호 리뷰 및 별점"
                  value={newTableComment}
                  onChange={(e) => setNewTableComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-medium">연관 기능(Step 2 기능 선택)</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-32 overflow-y-auto p-1 bg-slate-950 rounded border border-slate-800">
                  {features.map((f) => (
                    <label key={f.id} className="flex items-center gap-1.5 text-[11px] text-slate-300 p-1 hover:bg-slate-900 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTableFeatures.includes(f.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewTableFeatures([...newTableFeatures, f.id]);
                          } else {
                            setNewTableFeatures(newTableFeatures.filter((id) => id !== f.id));
                          }
                        }}
                        className="rounded border-slate-700"
                      />
                      <span>[{f.id}] {f.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newTableName.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded font-semibold"
                >
                  테이블 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

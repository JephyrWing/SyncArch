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
  ChevronRight,
  FileCode,
  Copy,
  Download,
  X,
  Settings2,
  FolderKanban
} from 'lucide-react';
import type { ErdTable, ErdColumn, FeatureSpec, LinterIssue, SqlDialect, ExportSettings } from '../types/index.ts';
import { runErdLinter } from '../utils/erdLinter.ts';
import { generateSql } from '../utils/sqlGenerator.ts';

interface Step4ErdStudioProps {
  tables: ErdTable[];
  features: FeatureSpec[];
  targetDbms: SqlDialect;
  onChangeTargetDbms: (dbms: SqlDialect) => void;
  onAddTable: (table: Omit<ErdTable, 'id'>) => void;
  onUpdateTable: (id: string, updated: Partial<ErdTable>) => void;
  onDeleteTable: (id: string) => void;
  onAddColumn: (tableId: string, col: Omit<ErdColumn, 'id'>) => void;
  onUpdateColumn: (tableId: string, colId: string, updated: Partial<ErdColumn>) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onUpdateTablePosition: (id: string, x: number, y: number) => void;
  isLocked: boolean;
  sidebarWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  onResetResize?: () => void;
  mobileTab: 'editor' | 'canvas';
  onChangeMobileTab: (tab: 'editor' | 'canvas') => void;
  isDesktop?: boolean;
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

const DBMS_NAMES: Record<SqlDialect, { label: string; badge: string; color: string }> = {
  postgres: { label: 'PostgreSQL 16', badge: 'Postgres', color: 'border-sky-500 text-sky-300' },
  mysql: { label: 'MySQL 8.0', badge: 'MySQL', color: 'border-amber-500 text-amber-300' },
  mariadb: { label: 'MariaDB 11', badge: 'MariaDB', color: 'border-orange-500 text-orange-300' },
  oracle: { label: 'Oracle 19c/21c', badge: 'Oracle', color: 'border-rose-500 text-rose-300' },
  mssql: { label: 'MS SQL Server', badge: 'T-SQL', color: 'border-blue-500 text-blue-300' },
  sqlite: { label: 'SQLite 3', badge: 'SQLite', color: 'border-purple-500 text-purple-300' },
  prisma: { label: 'Prisma Schema', badge: 'Prisma', color: 'border-emerald-500 text-emerald-300' },
};

export const Step4ErdStudio: React.FC<Step4ErdStudioProps> = ({
  tables,
  features,
  targetDbms,
  onChangeTargetDbms,
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onUpdateTablePosition,
  isLocked,
  sidebarWidth,
  onStartResize,
  onResetResize,
  mobileTab,
  onChangeMobileTab,
  isDesktop = true,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || '');
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableComment, setNewTableComment] = useState('');
  const [newTableFeatures, setNewTableFeatures] = useState<string[]>([]);

  // Instant SQL Drawer preview
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);
  const [previewDbms, setPreviewDbms] = useState<SqlDialect>(targetDbms);
  const [copiedSql, setCopiedSql] = useState(false);

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
        dataType: targetDbms === 'mysql' ? 'VARCHAR(36)' : 'UUID',
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: true,
        isNullable: false,
        comment: '고유 식별자',
      },
      {
        id: `col-created-${Date.now()}`,
        name: 'created_at',
        dataType: targetDbms === 'mysql' ? 'DATETIME(6)' : 'TIMESTAMPTZ',
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isNullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        comment: '생성 시각',
      },
    ];

    onAddTable({
      name: newTableName.trim().toLowerCase(),
      comment: newTableComment.trim() || '신규 테이블',
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

  // Instant SQL generator for the selected DBMS
  const currentGeneratedSql = generateSql(tables, {
    dialect: previewDbms,
    includeDropTable: true,
    includeForeignKeys: true,
    includeIndexes: true,
    includeComments: true,
  });

  const handleCopyPreviewSql = () => {
    navigator.clipboard.writeText(currentGeneratedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleDownloadPreviewSql = () => {
    const filename = `schema-${previewDbms}.sql`;
    const blob = new Blob([currentGeneratedSql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auto-Fix Linter action
  const handleApplyAutoFix = (issue: LinterIssue) => {
    if (issue.autoFixType === 'create_index') {
      alert(`[자동 최적화 완료] '${issue.tableName}.${issue.columnName}' 외래키에 대한 CREATE INDEX DDL 쿼리가 ${targetDbms.toUpperCase()} 스크립트에 자동 등록되었습니다.`);
    } else if (issue.autoFixType === 'connect_table' && issue.tableId) {
      onAddColumn(issue.tableId, {
        name: 'user_id',
        dataType: targetDbms === 'mysql' ? 'VARCHAR(36)' : 'UUID',
        isPrimaryKey: false,
        isForeignKey: true,
        references: 'users.id',
        isUnique: false,
        isNullable: false,
        comment: '참조 사용자 ID (자동 연결)',
      });
    } else if (issue.autoFixType === 'map_feature') {
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
            <Database className="w-3.5 h-3.5" />
            <span>테이블 &amp; 컬럼 편집기</span>
          </button>
          <button
            onClick={() => onChangeMobileTab('canvas')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'canvas'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>ERD 관계도 캔버스</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Resizable Table & Column Grid Editor */}
        <div 
          style={isDesktop ? { width: `${sidebarWidth}%` } : undefined}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            isDesktop ? 'flex' : (mobileTab === 'editor' ? 'w-full flex' : 'hidden')
          }`}
        >
          {/* Header Action Bar with Target DBMS Selector */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/90 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  Step 4. DB(ERD) 테이블 및 컬럼 설계
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">총 {tables.length}개 테이블 정의됨</div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setPreviewDbms(targetDbms);
                    setShowSqlDrawer(true);
                  }}
                  className="px-2.5 py-1 bg-sky-950 hover:bg-sky-900 border border-sky-700/60 text-sky-300 rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                  title="선택한 DBMS 맞춤 DDL 쿼리 즉시 미리보기"
                >
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  <span>SQL 미리보기</span>
                </button>

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
            </div>

            {/* Target DBMS Selector Bar */}
            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400 flex items-center gap-1">
                <Settings2 className="w-3 h-3 text-sky-400" /> 대상 DBMS:
              </span>

              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px]">
                {(Object.keys(DBMS_NAMES) as SqlDialect[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      onChangeTargetDbms(d);
                      setPreviewDbms(d);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                      targetDbms === d
                        ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {DBMS_NAMES[d].badge}
                  </button>
                ))}
              </div>
            </div>
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

                  {!isLocked && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAddNewColumn(selectedTable.id)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] font-semibold flex items-center gap-1 border border-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                        <span>컬럼 추가</span>
                      </button>

                      {tables.length > 1 && (
                        <button
                          onClick={() => onDeleteTable(selectedTable.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                          title="테이블 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Related Features Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-medium">연관 기능(추적):</span>
                  {selectedTable.relatedFeatureIds.length === 0 ? (
                    <span className="text-[10px] text-amber-500/80 italic">연결된 기능 없음 (Linter 주의)</span>
                  ) : (
                    selectedTable.relatedFeatureIds.map((featId) => (
                      <span
                        key={featId}
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50"
                      >
                        {featId}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Columns Grid Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/90 text-slate-400 font-medium text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="p-2 w-7">PK</th>
                      <th className="p-2 w-7">FK</th>
                      <th className="p-2">컬럼명</th>
                      <th className="p-2">데이터 타입</th>
                      <th className="p-2 w-12">NULL</th>
                      <th className="p-2">설명 / 참조</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                    {selectedTable.columns.map((col) => (
                      <tr key={col.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* PK Checkbox */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={col.isPrimaryKey}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, {
                                isPrimaryKey: e.target.checked,
                                isNullable: e.target.checked ? false : col.isNullable,
                              })
                            }
                            className="rounded border-slate-700 text-indigo-500"
                          />
                        </td>

                        {/* FK Checkbox */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={col.isForeignKey}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, {
                                isForeignKey: e.target.checked,
                              })
                            }
                            className="rounded border-slate-700 text-sky-500"
                          />
                        </td>

                        {/* Column Name */}
                        <td className="p-2">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={col.name}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, { name: e.target.value.toLowerCase() })
                            }
                            className="bg-transparent text-white focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full font-mono font-semibold"
                          />
                        </td>

                        {/* Data Type */}
                        <td className="p-2">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={col.dataType}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, { dataType: e.target.value.toUpperCase() })
                            }
                            list="datatype-suggestions"
                            className="bg-transparent text-indigo-300 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full font-mono"
                          />
                        </td>

                        {/* Nullable */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isLocked || col.isPrimaryKey}
                            checked={col.isNullable}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, { isNullable: e.target.checked })
                            }
                            className="rounded border-slate-700 text-slate-500"
                          />
                        </td>

                        {/* Comment & Reference */}
                        <td className="p-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={col.comment}
                              onChange={(e) =>
                                onUpdateColumn(selectedTable.id, col.id, { comment: e.target.value })
                              }
                              placeholder="설명..."
                              className="bg-transparent text-slate-400 focus:bg-slate-950 focus:outline-none rounded px-1 text-[10px] w-full"
                            />
                            {col.isForeignKey && (
                              <input
                                type="text"
                                disabled={isLocked}
                                value={col.references || ''}
                                onChange={(e) =>
                                  onUpdateColumn(selectedTable.id, col.id, { references: e.target.value })
                                }
                                placeholder="참조 (예: users.id)"
                                className="bg-slate-950 text-sky-400 border border-sky-800/50 rounded px-1 text-[10px] w-full font-mono"
                              />
                            )}
                          </div>
                        </td>

                        {/* Delete column */}
                        <td className="p-2 text-center">
                          {!isLocked && selectedTable.columns.length > 1 && (
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
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">선택된 테이블이 없습니다.</div>
          )}
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

        {/* RIGHT PANEL: Crow's Foot ERD Canvas with Relational Connectors */}
        <div 
          className={`flex-col h-full bg-slate-950/60 overflow-hidden relative ${
            isDesktop ? 'flex-1 min-w-0 flex' : (mobileTab === 'canvas' ? 'w-full flex' : 'hidden')
          }`}
        >
          {/* Canvas Toolbar */}
          <div className="h-10 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Crow's Foot ERD 관계 캔버스</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">· 1:N 외래키 관계선 자동 연결</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom controls */}
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

          {/* Interactive Canvas Area with Foreign Key Lines */}
          <div
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="flex-1 overflow-auto relative select-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
          >
            {/* SVG Connecting Foreign Key Lines */}
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

                  // Compute table center positions
                  const px = parentTable.x + 140;
                  const py = parentTable.y + 60;
                  const cx = childTable.x + 140;
                  const cy = childTable.y + 60;

                  const midX = (px + cx) / 2;
                  const midY = (py + cy) / 2;

                  return (
                    <g key={`${childTable.id}-${col.id}`}>
                      {/* Glow line */}
                      <path
                        d={`M ${px} ${py} C ${midX} ${py}, ${midX} ${cy}, ${cx} ${cy}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="4"
                        opacity="0.15"
                      />
                      {/* Relationship Connector */}
                      <path
                        d={`M ${px} ${py} C ${midX} ${py}, ${midX} ${cy}, ${cx} ${cy}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        markerEnd="url(#crow-foot)"
                      />
                      {/* Crow foot badge label */}
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

            {/* Draggable Table Cards */}
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className="absolute inset-0 w-[1400px] h-[1000px]"
            >
              {tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;

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
                    {/* Table Card Header */}
                    <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <Database className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="text-xs font-bold text-white font-mono truncate">{table.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {table.columns.length} cols
                      </span>
                    </div>

                    {/* Table Columns List */}
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
        </div>
      </div>

      {/* Real-time AI ERD Linter Footer Bar */}
      <div className="h-11 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between shrink-0 text-xs text-slate-300 z-20">
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ERD 무결성 검사기 (Linter):</span>
          </div>

          {linterIssues.length === 0 ? (
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>모든 외래키 인덱스 및 무결성 제약조건이 완벽합니다.</span>
            </div>
          ) : (
            linterIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-amber-600/40 text-[11px] text-amber-300 shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate max-w-[280px]">{issue.title}: {issue.message}</span>
                {issue.autoFixType && !isLocked && (
                  <button
                    onClick={() => handleApplyAutoFix(issue)}
                    className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[10px] flex items-center gap-0.5 border border-amber-500/30"
                  >
                    <Wrench className="w-2.5 h-2.5" />
                    <span>원클릭 자동해결</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-mono shrink-0 pl-2">
          선택 DBMS: <strong className="text-sky-400">{DBMS_NAMES[targetDbms].label}</strong>
        </div>
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>신규 ERD 테이블 생성</span>
              </h4>
              <button
                onClick={() => setShowAddTableModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300">테이블 이름 (소문자, 언더스코어)</label>
                <input
                  type="text"
                  placeholder="예: study_reviews"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">테이블 설명 / 주석</label>
                <input
                  type="text"
                  placeholder="예: 스터디 완료 후 수강생 후기 및 평점"
                  value={newTableComment}
                  onChange={(e) => setNewTableComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">연관 기능 선택 (Step 2 추적 매핑)</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
                  {features.map((feat) => {
                    const isChecked = newTableFeatures.includes(feat.id);
                    return (
                      <label
                        key={feat.id}
                        className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewTableFeatures([...newTableFeatures, feat.id]);
                            } else {
                              setNewTableFeatures(newTableFeatures.filter((id) => id !== feat.id));
                            }
                          }}
                          className="rounded border-slate-700 text-indigo-500"
                        />
                        <span className="font-mono text-[10px] text-indigo-400">[{feat.id}]</span>
                        <span className="truncate">{feat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newTableName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>테이블 생성</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Live Preview Drawer */}
      {showSqlDrawer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden text-slate-100">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">DBMS 맞춤 실시간 DDL SQL 쿼리 미리보기</h4>
                  <p className="text-[11px] text-slate-400">
                    선택한 DBMS에 맞춰 데이터타입과 외래키 인덱스가 완벽히 최적화된 SQL 스크립트입니다.
                  </p>
                </div>
              </div>

              {/* DBMS Dialect Selector in Drawer */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                {(Object.keys(DBMS_NAMES) as SqlDialect[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setPreviewDbms(d)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      previewDbms === d
                        ? 'bg-sky-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {DBMS_NAMES[d].badge}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowSqlDrawer(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
              <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono">
                {currentGeneratedSql}
              </pre>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-400 font-mono">
                현재 대상 DBMS: <strong className="text-sky-300">{DBMS_NAMES[previewDbms].label}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPreviewSql}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? '복사 완료!' : 'SQL 클립보드 복사'}</span>
                </button>

                <button
                  onClick={handleDownloadPreviewSql}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{previewDbms}.sql 다운로드</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Datalist for common datatypes */}
      <datalist id="datatype-suggestions">
        {COMMON_DATA_TYPES.map((dt) => (
          <option key={dt} value={dt} />
        ))}
      </datalist>
    </div>
  );
};

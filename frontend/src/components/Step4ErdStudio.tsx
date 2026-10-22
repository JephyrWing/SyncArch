import React, { useState } from 'react';
import { Database, Link2 } from 'lucide-react';
import type { ErdTable, ErdColumn, FeatureSpec, LinterIssue, SqlDialect } from '../types/index.ts';
import { runErdLinter } from '../utils/erdLinter.ts';
import { COMMON_DATA_TYPES } from './step4/erdConfig.ts';
import { ErdSidebarToolbar } from './step4/ErdSidebarToolbar.tsx';
import { TableTabs } from './step4/TableTabs.tsx';
import { TableDetail } from './step4/TableDetail.tsx';
import { ErdCanvas } from './step4/ErdCanvas.tsx';
import { LinterBar } from './step4/LinterBar.tsx';
import { AddTableModal } from './step4/AddTableModal.tsx';
import { SqlPreviewDrawer } from './step4/SqlPreviewDrawer.tsx';

interface Step4ErdStudioProps {
  tables: ErdTable[];
  features: FeatureSpec[];
  targetDbms: SqlDialect;
  onChangeTargetDbms: (dbms: SqlDialect) => void;
  onAddTable: (table: Omit<ErdTable, 'id'>) => void;
  onUpdateTable: (id: string, updated: Partial<ErdTable>) => void;
  /** [ERD 설계] 테이블 이름과 그 테이블을 가리키는 모든 FK 참조를 바꾼다. */
  onRenameTable: (id: string, name: string) => void;
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

export const Step4ErdStudio: React.FC<Step4ErdStudioProps> = ({
  tables,
  features,
  targetDbms,
  onChangeTargetDbms,
  onAddTable,
  onUpdateTable,
  onRenameTable,
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

  // [SQL 생성] SQL 미리보기 서랍
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);
  const [previewDbms, setPreviewDbms] = useState<SqlDialect>(targetDbms);

  // [ERD 린터] ERD 린터를 실시간으로 실행
  const linterIssues = runErdLinter(tables, features);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];

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

  // [ERD 린터] 린터 자동 수정
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
      {/* [ERD 설계] 모바일·태블릿 화면 전환 */}
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
        {/* [ERD 설계] 왼쪽 패널: 크기 조절 테이블·컬럼 편집기 */}
        <div
          style={isDesktop ? { width: `${sidebarWidth}%` } : undefined}
          className={`border-r border-slate-800 bg-slate-900/70 flex flex-col h-full overflow-hidden shrink-0 ${
            isDesktop ? 'flex' : (mobileTab === 'editor' ? 'w-full flex' : 'hidden')
          }`}
        >
          {/* [ERD 설계] 대상 DBMS 선택이 있는 헤더 버튼 줄 */}
          <ErdSidebarToolbar
            tableCount={tables.length}
            isLocked={isLocked}
            targetDbms={targetDbms}
            onSelectDbms={(d) => {
              onChangeTargetDbms(d);
              setPreviewDbms(d);
            }}
            onOpenSqlPreview={() => {
              setPreviewDbms(targetDbms);
              setShowSqlDrawer(true);
            }}
            onOpenAddTable={() => setShowAddTableModal(true)}
          />

          {/* [ERD 설계] 테이블 탭 */}
          <TableTabs tables={tables} selectedTableId={selectedTable?.id} onSelectTable={setSelectedTableId} />

          {/* [ERD 설계] 테이블 상세와 컬럼 표 */}
          {selectedTable ? (
            <TableDetail
              table={selectedTable}
              tables={tables}
              features={features}
              isLocked={isLocked}
              onRenameTable={onRenameTable}
              onDeleteTable={onDeleteTable}
              onAddNewColumn={handleAddNewColumn}
              onUpdateColumn={onUpdateColumn}
              onDeleteColumn={onDeleteColumn}
            />
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">선택된 테이블이 없습니다.</div>
          )}
        </div>

        {/* [ERD 설계] 왼쪽·오른쪽 패널 크기 조절 구분선 */}
        <div
          onMouseDown={onStartResize}
          onDoubleClick={onResetResize}
          className="hidden lg:flex w-1.5 hover:w-2 bg-slate-800 hover:bg-indigo-500 cursor-col-resize transition-all items-center justify-center shrink-0 group z-10 select-none"
          title="드래그하여 사이드바 너비 조절 (더블클릭 시 40% 리셋)"
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* [ERD 설계] 오른쪽 패널: 관계선이 있는 까마귀발 표기 ERD 캔버스 */}
        <div
          className={`flex-col h-full bg-slate-950/60 overflow-hidden relative ${
            isDesktop ? 'flex-1 min-w-0 flex' : (mobileTab === 'canvas' ? 'w-full flex' : 'hidden')
          }`}
        >
          <ErdCanvas
            tables={tables}
            selectedTableId={selectedTable?.id}
            onSelectTable={setSelectedTableId}
            isLocked={isLocked}
            onUpdateTablePosition={onUpdateTablePosition}
          />
        </div>
      </div>

      {/* [ERD 린터] 실시간 ERD 린터 하단 바 */}
      <LinterBar
        linterIssues={linterIssues}
        isLocked={isLocked}
        targetDbms={targetDbms}
        onApplyAutoFix={handleApplyAutoFix}
      />

      {/* [ERD 설계] 테이블 추가 모달 */}
      <AddTableModal
        open={showAddTableModal}
        features={features}
        targetDbms={targetDbms}
        isLocked={isLocked}
        onAddTable={onAddTable}
        onClose={() => setShowAddTableModal(false)}
      />

      {/* [SQL 생성] SQL 실시간 미리보기 서랍 */}
      <SqlPreviewDrawer
        open={showSqlDrawer}
        tables={tables}
        previewDbms={previewDbms}
        onChangePreviewDbms={setPreviewDbms}
        onClose={() => setShowSqlDrawer(false)}
      />

      {/* [ERD 설계] 자주 쓰는 데이터 타입 목록 */}
      <datalist id="datatype-suggestions">
        {COMMON_DATA_TYPES.map((dt) => (
          <option key={dt} value={dt} />
        ))}
      </datalist>
    </div>
  );
};

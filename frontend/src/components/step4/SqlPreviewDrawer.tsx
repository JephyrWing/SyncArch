import React, { useState } from 'react';
import { Check, Copy, Download, FileCode, X } from 'lucide-react';
import type { ErdTable, SqlDialect } from '../../types/index.ts';
import { generateSql } from '../../utils/sqlGenerator.ts';
import { DBMS_NAMES } from './erdConfig.ts';

interface SqlPreviewDrawerProps {
  open: boolean;
  tables: ErdTable[];
  previewDbms: SqlDialect;
  onChangePreviewDbms: (dbms: SqlDialect) => void;
  onClose: () => void;
}

// [SQL 생성] 닫혀도 마운트를 유지해 복사 완료 표시가 분리 전처럼 이어진다.
export const SqlPreviewDrawer: React.FC<SqlPreviewDrawerProps> = ({
  open,
  tables,
  previewDbms,
  onChangePreviewDbms,
  onClose,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);

  if (!open) return null;

  // [SQL 생성] 선택한 DBMS용 즉시 SQL 생성
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden text-slate-100">
        {/* [SQL 생성] 서랍 헤더 */}
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

          {/* [SQL 생성] 서랍 안 DBMS 선택 */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            {(Object.keys(DBMS_NAMES) as SqlDialect[]).map((d) => (
              <button
                key={d}
                onClick={() => onChangePreviewDbms(d)}
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
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* [SQL 생성] 코드 내용 */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
          <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono">
            {currentGeneratedSql}
          </pre>
        </div>

        {/* [SQL 생성] 하단 버튼 */}
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
  );
};

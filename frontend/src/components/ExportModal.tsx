import React, { useState } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  X, 
  FileCode, 
  FileText, 
  Settings2, 
  Sparkles,
  ExternalLink,
  Database
} from 'lucide-react';
import type { ErdTable, IdeaCard, FeatureSpec, ArchNode, ArchConnection, SqlDialect, ExportSettings } from '../types/index.ts';
import { generateSql } from '../utils/sqlGenerator.ts';
import { generateMarkdownSpec } from '../utils/markdownGenerator.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectTitle: string;
  projectSummary: string;
  ideas: IdeaCard[];
  features: FeatureSpec[];
  nodes: ArchNode[];
  connections: ArchConnection[];
  tables: ErdTable[];
  defaultDbms?: SqlDialect;
}

const DIALECT_OPTIONS: { id: SqlDialect; label: string; badge: string; desc: string }[] = [
  { id: 'postgres', label: 'PostgreSQL 16', badge: 'Postgres', desc: 'UUID, TIMESTAMPTZ, COMMENT ON, CASCADE' },
  { id: 'mysql', label: 'MySQL 8.0', badge: 'MySQL', desc: 'InnoDB, UTF8MB4, DATETIME(6), inline COMMENT' },
  { id: 'mariadb', label: 'MariaDB 11', badge: 'MariaDB', desc: 'Aria/InnoDB, UTF8MB4, CHECK 제약조건' },
  { id: 'oracle', label: 'Oracle 19c/21c', badge: 'Oracle', desc: 'VARCHAR2, NUMBER, SYSTIMESTAMP, IDENTITY' },
  { id: 'mssql', label: 'MS SQL Server', badge: 'T-SQL', desc: 'NVARCHAR, DATETIMEOFFSET, IDENTITY(1,1), GO' },
  { id: 'sqlite', label: 'SQLite 3', badge: 'SQLite', desc: 'AUTOINCREMENT, TEXT, PRAGMA foreign_keys' },
  { id: 'prisma', label: 'Prisma Schema', badge: 'Prisma', desc: 'model DSL, @id, @default(uuid()), @relation' },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  projectTitle,
  projectSummary,
  ideas,
  features,
  nodes,
  connections,
  tables,
  defaultDbms = 'postgres',
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'markdown'>('sql');
  const [copied, setCopied] = useState(false);

  // SQL Export Settings
  const [settings, setSettings] = useState<ExportSettings>({
    dialect: defaultDbms,
    includeDropTable: true,
    includeForeignKeys: true,
    includeIndexes: true,
    includeComments: true,
  });

  if (!isOpen) return null;

  const sqlContent = generateSql(tables, settings);
  const markdownContent = generateMarkdownSpec(
    projectTitle,
    projectSummary,
    ideas,
    features,
    nodes,
    connections,
    tables
  );

  const currentContent = activeTab === 'sql' ? sqlContent : markdownContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let filename = `schema-${settings.dialect}.sql`;
    let mime = 'text/plain';

    if (activeTab === 'markdown') {
      filename = 'ARCHITECTURE_SPEC.md';
      mime = 'text/markdown';
    } else if (settings.dialect === 'prisma') {
      filename = 'schema.prisma';
    }

    const blob = new Blob([currentContent], { type: `${mime};charset=utf-8` });
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
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>산출물 내보내기 엔진 (Export Engine)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                선택한 DBMS 맞춤 DDL 스크립트 및 통합 Markdown 아키텍처 명세서
              </p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'sql'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>SQL (DDL) 스크립트</span>
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'markdown'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Markdown 명세서 (Mermaid)</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Toolbar (for SQL tab) */}
        {activeTab === 'sql' && (
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex flex-col gap-2.5 text-xs shrink-0">
            {/* Dialect Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-sky-400" /> 대상 DBMS:
              </span>
              {DIALECT_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSettings({ ...settings, dialect: d.id })}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-all ${
                    settings.dialect === d.id
                      ? 'bg-sky-600 text-white border-sky-400 shadow-sm ring-1 ring-sky-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title={d.desc}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* DDL Toggles */}
            {settings.dialect !== 'prisma' && (
              <div className="flex items-center gap-4 text-[11px] text-slate-300 flex-wrap pt-1 border-t border-slate-800/60">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeDropTable}
                    onChange={(e) => setSettings({ ...settings, includeDropTable: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>DROP TABLE IF EXISTS</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeForeignKeys}
                    onChange={(e) => setSettings({ ...settings, includeForeignKeys: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>FOREIGN KEY 외래키 제약조건</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeIndexes}
                    onChange={(e) => setSettings({ ...settings, includeIndexes: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>CREATE INDEX 자동 생성</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeComments}
                    onChange={(e) => setSettings({ ...settings, includeComments: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500"
                  />
                  <span>COMMENT 주석 포함</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Code View Area */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
          <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono">
            {currentContent}
          </pre>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {activeTab === 'sql' ? (
              <span>
                대상 DBMS: <strong className="text-sky-300 font-mono">{settings.dialect.toUpperCase()}</strong> · 외래키 종속성 순서에 따라 부모 테이블이 자동 선행 정렬되었습니다.
              </span>
            ) : (
              <span>
                GitHub 및 Notion에서 즉시 렌더링 가능한 Mermaid.js 다이어그램이 포함되어 있습니다.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사 완료!' : '클립보드 복사'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {activeTab === 'markdown'
                  ? 'ARCHITECTURE_SPEC.md 다운로드'
                  : settings.dialect === 'prisma'
                  ? 'schema.prisma 다운로드'
                  : `schema-${settings.dialect}.sql 다운로드`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

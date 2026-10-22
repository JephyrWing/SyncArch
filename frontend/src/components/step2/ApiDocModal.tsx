import React, { useState } from 'react';
import { Check, Copy, Download, FileCode, X } from 'lucide-react';
import type { FeatureSpec } from '../../types/index.ts';
import { generateMarkdownTable, generateOpenApiJson, generateOpenApiYaml } from '../../utils/apiDocs.ts';

interface ApiDocModalProps {
  open: boolean;
  features: FeatureSpec[];
  onClose: () => void;
}

// [기능 명세] 닫혀도 마운트를 유지해 선택한 탭과 복사 표시가 분리 전처럼 남는다.
export const ApiDocModal: React.FC<ApiDocModalProps> = ({ open, features, onClose }) => {
  const [apiDocTab, setApiDocTab] = useState<'swagger_json' | 'swagger_yaml' | 'markdown'>('swagger_json');
  const [copiedDoc, setCopiedDoc] = useState(false);

  if (!open) return null;

  const currentDocContent =
    apiDocTab === 'swagger_json' ? generateOpenApiJson(features) :
    apiDocTab === 'swagger_yaml' ? generateOpenApiYaml(features) :
    generateMarkdownTable(features);

  const handleCopyDoc = () => {
    navigator.clipboard.writeText(currentDocContent);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleDownloadDoc = () => {
    let filename = 'openapi-spec.json';
    let mime = 'application/json';
    if (apiDocTab === 'swagger_yaml') {
      filename = 'openapi-spec.yaml';
      mime = 'text/yaml';
    } else if (apiDocTab === 'markdown') {
      filename = 'API_SPECIFICATION.md';
      mime = 'text/markdown';
    }

    const blob = new Blob([currentDocContent], { type: `${mime};charset=utf-8` });
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden text-slate-100">
        {/* [기능 명세] 모달 헤더 */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">자동화된 API 명세서</h4>
              <p className="text-[11px] text-slate-400">
                Swagger 3.0 / OpenAPI 스펙 및 Markdown API 테이블 실시간 생성
              </p>
            </div>
          </div>

          {/* [기능 명세] 탭 */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setApiDocTab('swagger_json')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                apiDocTab === 'swagger_json' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Swagger JSON
            </button>
            <button
              onClick={() => setApiDocTab('swagger_yaml')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                apiDocTab === 'swagger_yaml' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Swagger YAML
            </button>
            <button
              onClick={() => setApiDocTab('markdown')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                apiDocTab === 'markdown' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Markdown 명세서
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* [기능 명세] 문서 미리보기 코드 상자 */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
          <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono">
            {currentDocContent}
          </pre>
        </div>

        {/* [기능 명세] 하단 버튼 */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            {apiDocTab === 'markdown' ? `총 ${features.length}개 기능 명세 반영` : `총 ${features.filter((f) => f.method && f.endpoint).length}개 엔드포인트 반영 · 메서드/경로 미지정 ${features.filter((f) => !f.method || !f.endpoint).length}개 제외`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDoc}
              className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDoc ? '복사 완료' : '클립보드 복사'}</span>
            </button>

            <button
              onClick={handleDownloadDoc}
              className="px-3 sm:px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>다운로드</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

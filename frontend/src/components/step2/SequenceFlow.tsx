import React from 'react';
import { Workflow } from 'lucide-react';
import type { FeatureSpec } from '../../types/index.ts';

interface SequenceFlowProps {
  feature: FeatureSpec;
}

export const SequenceFlow: React.FC<SequenceFlowProps> = ({ feature: selectedFeature }) => (
  <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
      <span className="flex items-center gap-1.5">
        <Workflow className="w-4 h-4 text-indigo-400" />
        엔드투엔드 API Sequence Flow 다이어그램
      </span>
      <span className="text-[11px] text-slate-500 hidden sm:inline">클라이언트 → 게이트웨이 → 서비스 → DB</span>
    </div>

    {/* [기능 명세] SVG 흐름도 */}
    <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-around px-4 sm:px-6 overflow-x-auto">
      {/* [기능 명세] 생명선 1: 클라이언트 */}
      <div className="flex flex-col items-center shrink-0">
        <div className="px-2.5 py-1 rounded bg-sky-950 border border-sky-600/50 text-sky-300 text-xs font-bold">
          Web/Mobile
        </div>
        <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
      </div>

      {/* [기능 명세] 생명선 2: API 게이트웨이 */}
      <div className="flex flex-col items-center shrink-0">
        <div className="px-2.5 py-1 rounded bg-indigo-950 border border-indigo-600/50 text-indigo-300 text-xs font-bold">
          API Gateway
        </div>
        <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
      </div>

      {/* [기능 명세] 생명선 3: 서비스 코어 */}
      <div className="flex flex-col items-center shrink-0">
        <div className="px-2.5 py-1 rounded bg-purple-950 border border-purple-600/50 text-purple-300 text-xs font-bold">
          Backend Service
        </div>
        <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
      </div>

      {/* [기능 명세] 생명선 4: 데이터베이스 */}
      <div className="flex flex-col items-center shrink-0">
        <div className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-600/50 text-emerald-300 text-xs font-bold">
          Database (DB)
        </div>
        <div className="w-0.5 h-24 bg-slate-700/60 my-1" />
      </div>

      {/* [기능 명세] 흐름 화살표 오버레이 */}
      <div className="absolute inset-x-8 sm:inset-x-12 top-20 flex flex-col gap-3 pointer-events-none text-[10px] font-mono">
        <div className="flex items-center text-sky-400">
          <span className="bg-slate-900 px-1 rounded border border-slate-700 mr-1 truncate max-w-[120px] sm:max-w-none">{selectedFeature.method ?? '미지정'} {selectedFeature.endpoint}</span>
          <div className="flex-1 border-t-2 border-sky-500 border-dashed relative">
            <span className="absolute right-0 -top-1.5">▶</span>
          </div>
        </div>
        <div className="flex items-center text-emerald-400 pl-16 sm:pl-24">
          <span className="bg-slate-900 px-1 rounded border border-slate-700 mr-1">SQL Query</span>
          <div className="flex-1 border-t-2 border-emerald-500 relative">
            <span className="absolute right-0 -top-1.5">▶</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

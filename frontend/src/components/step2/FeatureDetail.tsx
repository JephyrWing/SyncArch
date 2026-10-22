import React, { useState } from 'react';
import { CheckCircle2, Code2, Play, X } from 'lucide-react';
import type { FeatureSpec } from '../../types/index.ts';
import { methodBadge, STATUS_BADGES } from './featureConfig.ts';
import { SequenceFlow } from './SequenceFlow.tsx';

interface FeatureDetailProps {
  feature?: FeatureSpec;
  onEdit?: () => void;
}

// [기능 명세] 선택이 없을 때도 마운트를 유지해 목 테스트 결과가 분리 전처럼 남는다.
export const FeatureDetail: React.FC<FeatureDetailProps> = ({ feature: selectedFeature, onEdit }) => {
  // [기능 명세] 목 API 테스트 상태
  const [testResponseStatus, setTestResponseStatus] = useState<number | null>(null);
  const [testResponseBody, setTestResponseBody] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const handleTestMockApi = () => {
    if (!selectedFeature) return;
    setIsTestingApi(true);
    setTestResponseStatus(null);
    setTestResponseBody(null);

    setTimeout(() => {
      setIsTestingApi(false);
      setTestResponseStatus(200);
      setTestResponseBody(
        JSON.stringify(
          {
            status: 200,
            message: `${selectedFeature.name} mock 호출이 성공적으로 처리되었습니다.`,
            endpoint: selectedFeature.endpoint,
            method: selectedFeature.method,
            timestamp: new Date().toISOString(),
            mockData: {
              assignee: selectedFeature.assignee,
              featureId: selectedFeature.id,
              result: 'SUCCESS',
            },
          },
          null,
          2
        )
      );
    }, 400);
  };

  if (!selectedFeature) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        좌측 목록에서 기능을 선택하거나 신규 기능을 추가하세요.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* [기능 명세] 헤더 정보 */}
      <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${methodBadge(selectedFeature.method).bg} ${methodBadge(selectedFeature.method).text} ${methodBadge(selectedFeature.method).border}`}>
              {selectedFeature.method ?? '미지정'}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white font-mono break-all">{selectedFeature.endpoint}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_BADGES[selectedFeature.status].bg} ${STATUS_BADGES[selectedFeature.status].text} ${STATUS_BADGES[selectedFeature.status].border}`}>
              {STATUS_BADGES[selectedFeature.status].label}
            </span>
          </div>
          <div className="text-xs text-slate-300 mt-1">{selectedFeature.name}</div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">기능 편집</button>}
          <button
            onClick={handleTestMockApi}
            disabled={isTestingApi}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Play className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin' : ''}`} />
            <span>Mock API 테스트</span>
          </button>
        </div>
      </div>

      {/* [기능 명세] API 명세 내용 */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {/* [기능 명세] 파라미터 / 페이로드 표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-sky-400">
              <span className="flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5" /> Request Payload (Schema)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">application/json</span>
            </div>
            <pre className="p-2.5 bg-slate-950 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 whitespace-pre-wrap overflow-x-auto">
              {selectedFeature.requestFields}
            </pre>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5" /> Response Payload (Schema)
              </span>
              <span className="text-[10px] text-emerald-500 font-mono">200 OK</span>
            </div>
            <pre className="p-2.5 bg-slate-950 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 whitespace-pre-wrap overflow-x-auto">
              {selectedFeature.responseFields}
            </pre>
          </div>
        </div>

        {/* [기능 명세] 테스트했으면 목 테스트 결과 패널 */}
        {testResponseStatus && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-emerald-500/40 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Mock API 호출 결과 (Status: 200 OK)
              </span>
              <button onClick={() => setTestResponseStatus(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <pre className="p-2 bg-slate-950 rounded text-xs font-mono text-emerald-300 border border-slate-800 whitespace-pre-wrap overflow-x-auto">
              {testResponseBody}
            </pre>
          </div>
        )}

        {/* [기능 명세] 시퀀스 흐름도(시각 캔버스) */}
        <SequenceFlow feature={selectedFeature} />
      </div>
    </div>
  );
};

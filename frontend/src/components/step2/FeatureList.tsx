import React from 'react';
import { Trash2 } from 'lucide-react';
import type { FeatureProgressStatus, FeatureSpec } from '../../types/index.ts';
import { methodBadge, priorityBadge, STATUS_BADGES } from './featureConfig.ts';
import { featureCode } from '../../utils/features.ts';

interface FeatureListProps {
  features: FeatureSpec[];
  selectedFeatureId?: string;
  isLocked: boolean;
  onSelectFeature: (id: string) => void;
  onUpdateFeature: (id: string, updated: Partial<FeatureSpec>) => void;
  onDeleteFeature: (id: string) => void;
}

export const FeatureList: React.FC<FeatureListProps> = ({
  features: filteredFeatures,
  selectedFeatureId,
  isLocked,
  onSelectFeature,
  onUpdateFeature,
  onDeleteFeature,
}) => (
  <div className="flex-1 overflow-y-auto">
    {filteredFeatures.length === 0 ? (
      <div className="text-center py-12 text-slate-500 text-xs">
        조건에 일치하는 기능 명세가 없습니다.
      </div>
    ) : (
      <div className="divide-y divide-slate-800/80">
        {filteredFeatures.map((f) => {
          const isSelected = selectedFeatureId === f.id;
          const mColor = methodBadge(f.method);
          const pColor = priorityBadge(f.priority);
          const sColor = STATUS_BADGES[f.status];

          return (
            <div
              key={f.id}
              onClick={() => onSelectFeature(f.id)}
              className={`p-3 cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-slate-800/90 border-l-4 border-indigo-500'
                  : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-slate-400">{featureCode(f)}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold ${mColor.bg} ${mColor.text} ${mColor.border}`}>
                    {f.method ?? '미지정'}
                  </span>
                  <span className={`text-[9px] px-1 py-0.2 rounded border ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                    {f.priority ?? '미지정'}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">[{f.domain}]</span>
                </div>

                {/* [기능 명세] 상태 빠른 선택 드롭다운 */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <select
                    disabled={isLocked}
                    value={f.status}
                    onChange={(e) => onUpdateFeature(f.id, { status: e.target.value as FeatureProgressStatus })}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer ${sColor.bg} ${sColor.text} ${sColor.border}`}
                  >
                    <option value="PLANNED">계획</option>
                    <option value="IN_PROGRESS">진행중</option>
                    <option value="QA">QA 검증</option>
                    <option value="COMPLETED">완료됨</option>
                  </select>

                  {!isLocked && (
                    <button
                      onClick={() => onDeleteFeature(f.id)}
                      className="text-slate-600 hover:text-rose-400 p-0.5"
                      title="기능 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-200">{f.name}</div>
              <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{f.endpoint}</div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                <span>담당: <strong className="text-slate-300">{f.assignee}</strong></span>
                <span className="truncate max-w-[200px] text-slate-400">{f.summary}</span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

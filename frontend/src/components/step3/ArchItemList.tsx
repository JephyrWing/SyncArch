import React from 'react';
import { Trash2 } from 'lucide-react';
import type { ArchConnection, ArchNode } from '../../types/index.ts';
import { CATEGORY_META, PROTOCOL_CONFIG } from './archConfig.ts';

interface ArchItemListProps {
  nodes: ArchNode[];
  connections: ArchConnection[];
  selectedNodeId?: string;
  isNodeVisible: (node: ArchNode) => boolean;
  isLocked: boolean;
  onSelectNode: (id: string) => void;
  onEditNode: (id: string) => void;
  onEditConnection: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteConnection: (id: string) => void;
}

export const ArchItemList: React.FC<ArchItemListProps> = ({
  nodes,
  connections,
  selectedNodeId,
  isNodeVisible,
  isLocked,
  onSelectNode,
  onEditNode,
  onEditConnection,
  onDeleteNode,
  onDeleteConnection,
}) => (
  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
    <div className="p-3 bg-slate-900/40">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        컴포넌트 목록 ({nodes.filter(isNodeVisible).length}/{nodes.length})
      </span>
    </div>

    {nodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      const visible = isNodeVisible(node);
      const meta = CATEGORY_META[node.category];

      return (
        <div
          key={node.id}
          onClick={() => onSelectNode(node.id)}
          onDoubleClick={() => !isLocked && onEditNode(node.id)}
          title="더블클릭하여 노드 속성 수정"
          className={`p-3 cursor-pointer transition-all ${
            visible ? 'opacity-100' : 'opacity-25'
          } ${
            isSelected
              ? 'bg-slate-800/90 border-l-4 border-indigo-500'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded flex items-center justify-center ${meta.bg} ${meta.color} border ${meta.border}`}>
                <meta.icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">{node.name}</div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {node.category} · {node.assignedTeam}
                </div>
              </div>
            </div>

            {!isLocked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNode(node.id);
                }}
                className="text-slate-600 hover:text-rose-400 p-0.5"
                title="노드 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {node.techStack.map((tech) => (
              <span
                key={tech}
                className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      );
    })}

    {/* [시스템 아키텍처] 연결선 영역 */}
    <div className="p-3 bg-slate-900/40">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        프로토콜 연결선 목록 ({connections.length})
      </span>
    </div>

    <div className="p-2 space-y-1.5">
      {connections.map((c) => {
        const src = nodes.find((n) => n.id === c.sourceId);
        const tgt = nodes.find((n) => n.id === c.targetId);
        const cfg = PROTOCOL_CONFIG[c.protocol] || PROTOCOL_CONFIG.REST;

        return (
          <div
            key={c.id}
            onDoubleClick={() => !isLocked && onEditConnection(c.id)}
            title="더블클릭하여 연결선 속성 수정"
            className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px] cursor-pointer hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border ${cfg.bg} ${cfg.text}`}
                style={{ borderColor: cfg.stroke }}
              >
                {c.protocol}
              </span>
              <span className="text-slate-300 truncate font-medium">
                {src?.name || 'Unknown'} → {tgt?.name || 'Unknown'}
              </span>
              {c.label && <span className="text-slate-500 text-[10px]">({c.label})</span>}
            </div>

            {!isLocked && (
              <button
                onClick={() => onDeleteConnection(c.id)}
                className="text-slate-600 hover:text-rose-400 p-0.5"
                title="연결선 삭제"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

import React from 'react';
import { AlertTriangle, Bell, CheckCircle2, CloudOff, Download, Loader2, RefreshCw, X } from 'lucide-react';
import type { SaveStatus } from '../hooks/useProjectDocument.ts';

const STATUS_LABELS: Record<SaveStatus, { label: string; className: string }> = {
  loading: { label: '불러오는 중', className: 'text-slate-400 border-slate-700' },
  clean: { label: '저장됨', className: 'text-emerald-300 border-emerald-700/60' },
  dirty: { label: '저장 대기', className: 'text-amber-300 border-amber-700/60' },
  saving: { label: '저장 중…', className: 'text-sky-300 border-sky-700/60' },
  failed: { label: '저장 실패', className: 'text-rose-300 border-rose-700/60' },
  invalid: { label: '저장 안 됨', className: 'text-rose-300 border-rose-700/60' },
  readonly: { label: '읽기 전용', className: 'text-slate-300 border-slate-600' },
  error: { label: '불러오기 실패', className: 'text-rose-300 border-rose-700/60' },
};

export const SaveStatusBadge: React.FC<{ status: SaveStatus; version: number }> = ({ status, version }) => {
  const { label, className } = STATUS_LABELS[status];
  const Icon = status === 'clean' ? CheckCircle2 : status === 'saving' || status === 'loading' ? Loader2 : status === 'dirty' ? RefreshCw : CloudOff;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`flex items-center gap-1 rounded-lg border bg-slate-900 px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${className}`}
      title="서버 저장이 확인된 경우에만 '저장됨'으로 표시합니다."
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'saving' || status === 'loading' ? 'animate-spin' : ''}`} />
      <span>{label}</span>
      {version > 0 && <span className="hidden xl:inline font-mono text-[10px] opacity-70">v{version}</span>}
    </span>
  );
};

interface CollabBannerProps {
  suspended?: boolean;
  status: SaveStatus;
  message: string;
  onRetry: () => void;
  onBackup: () => void;
  onReloadLatest: () => void;
  onReconnect: () => void;
}

const Button: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 rounded-md border border-current/30 bg-slate-950/40 px-2 py-0.5 font-semibold hover:bg-slate-950/70"
  >
    {children}
  </button>
);

/** [협업 상태] 저장 문제를 알린다. 팀원 변경은 자동으로 합쳐지므로 여기서는 저장 실패만 다룬다. */
export const CollabBanner: React.FC<CollabBannerProps> = ({ status, message, onRetry, onBackup, onReloadLatest, onReconnect, suspended }) => {
  const backup = (
    <Button onClick={onBackup}>
      <Download className="h-3 w-3" />내 변경 백업(JSON)
    </Button>
  );

  let tone = '';
  let actions: React.ReactNode = null;
  if (status === 'failed') {
    tone = 'bg-rose-950/80 text-rose-200 border-rose-800';
    actions = <>{!suspended && <Button onClick={onRetry}><RefreshCw className="h-3 w-3" />다시 시도</Button>}{backup}</>;
  } else if (status === 'invalid') {
    tone = 'bg-amber-950/80 text-amber-200 border-amber-800';
  } else if (status === 'error') {
    tone = 'bg-rose-950/80 text-rose-200 border-rose-800';
    actions = <Button onClick={onReloadLatest}><RefreshCw className="h-3 w-3" />다시 불러오기</Button>;
  } else if (status === 'readonly') {
    tone = 'bg-slate-900 text-slate-300 border-slate-700';
  } else {
    return null;
  }
  if (suspended) actions = <>{status === 'failed' && backup}<Button onClick={onReconnect}><RefreshCw className="h-3 w-3" />다시 연결</Button></>;

  return (
    <div role="alert" className={`flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs ${tone}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 min-w-[200px]">{message}</span>
      <div className="flex flex-wrap gap-1.5">{actions}</div>
    </div>
  );
};

export interface Toast {
  id: number;
  // [협업 상태] 같은 key의 알림은 쌓지 않고 바꿔 끼운다(팀원이 드래그하는 동안 알림이 넘치지 않게).
  key?: string;
  text: string;
  details: string[];
}

export const ToastStack: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => (
  <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
    {toasts.map((toast) => (
      <div key={toast.id} className="pointer-events-auto rounded-xl border border-indigo-700/60 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-2xl">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{toast.text}</p>
            {toast.details.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-slate-400">
                {toast.details.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => onDismiss(toast.id)} className="text-slate-500 hover:text-white" aria-label="알림 닫기">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    ))}
  </div>
);

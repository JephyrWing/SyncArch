import type { FeatureProgressStatus, HttpMethod, PriorityLevel } from '../../types/index.ts';
import { FEATURE_STATUS_LABELS } from '../../utils/apiDocs.ts';

export const METHOD_COLORS: Record<HttpMethod, { text: string; bg: string; border: string }> = {
  GET: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  POST: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  PUT: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PATCH: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  DELETE: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

export const PRIORITY_BADGES: Record<PriorityLevel, { text: string; bg: string; border: string }> = {
  P0: { text: 'text-rose-300 font-bold', bg: 'bg-rose-950/80', border: 'border-rose-600/50' },
  P1: { text: 'text-amber-300 font-bold', bg: 'bg-amber-950/80', border: 'border-amber-600/50' },
  P2: { text: 'text-slate-300 font-medium', bg: 'bg-slate-800', border: 'border-slate-700' },
};

export const STATUS_BADGES: Record<FeatureProgressStatus, { label: string; text: string; bg: string; border: string }> = {
  PLANNED: { label: FEATURE_STATUS_LABELS.PLANNED, text: 'text-slate-300', bg: 'bg-slate-800', border: 'border-slate-700' },
  IN_PROGRESS: { label: FEATURE_STATUS_LABELS.IN_PROGRESS, text: 'text-sky-300 font-semibold', bg: 'bg-sky-950/80', border: 'border-sky-600/40' },
  QA: { label: FEATURE_STATUS_LABELS.QA, text: 'text-purple-300 font-semibold', bg: 'bg-purple-950/80', border: 'border-purple-600/40' },
  COMPLETED: { label: FEATURE_STATUS_LABELS.COMPLETED, text: 'text-emerald-300 font-bold', bg: 'bg-emerald-950/80', border: 'border-emerald-600/40' },
};

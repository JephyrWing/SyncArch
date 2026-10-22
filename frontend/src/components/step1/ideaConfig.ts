import type React from 'react';
import { Compass, Lightbulb, ShieldAlert, Users } from 'lucide-react';
import type { DecisionStatus, IdeaCategory } from '../../types/index.ts';

export const CATEGORY_META: Record<
  IdeaCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string; border: string }
> = {
  problems_goals: {
    label: '핵심 문제 & 목표',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  actors: {
    label: '주요 사용자 역할(Actor)',
    icon: Users,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  user_stories: {
    label: '핵심 유저 스토리',
    icon: Compass,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  constraints: {
    label: '기술적 제약 및 비기능 요구사항',
    icon: Lightbulb,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

export const STATUS_META: Record<DecisionStatus, { label: string; bg: string; text: string; border: string }> = {
  ACCEPTED: { label: '채택됨 (Accepted)', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-600/40' },
  REVIEW: { label: '검토중 (Review)', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-600/40' },
  DEFERRED: { label: '보류 (Deferred)', bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' },
  REJECTED: { label: '기각됨 (Rejected)', bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-600/40' },
};

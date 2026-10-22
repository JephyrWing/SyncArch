import type React from 'react';
import { Cpu, Database, Monitor, Radio, Server } from 'lucide-react';
import type { ArchCategory, ArchProtocol } from '../../types/index.ts';

export const CATEGORY_META: Record<
  ArchCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; border: string; bg: string }
> = {
  Client: { label: 'Client Tier', icon: Monitor, color: 'text-sky-400', border: 'border-sky-500/40', bg: 'bg-sky-500/10' },
  Service: { label: 'Service / Gateway', icon: Server, color: 'text-indigo-400', border: 'border-indigo-500/40', bg: 'bg-indigo-500/10' },
  Messaging: { label: 'Cache / Message Queue', icon: Radio, color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  DataStore: { label: 'Database Storage', icon: Database, color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  Infra: { label: 'Infra / Proxy', icon: Cpu, color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
};

// [시스템 아키텍처] 프로토콜별 구분 스타일(색, 선 모양, 배지)
export const PROTOCOL_CONFIG: Record<
  ArchProtocol,
  { stroke: string; strokeWidth: number; dash?: string; bg: string; text: string; label: string; desc: string }
> = {
  REST: {
    stroke: '#38bdf8',
    strokeWidth: 2.5,
    bg: 'bg-sky-950',
    text: 'text-sky-300',
    label: 'REST (HTTPS)',
    desc: '동기식 HTTP REST API 요청'
  },
  WebSocket: {
    stroke: '#f59e0b',
    strokeWidth: 2.5,
    dash: '8 4',
    bg: 'bg-amber-950',
    text: 'text-amber-300',
    label: 'WebSocket (WSS)',
    desc: '실시간 양방향 웹소켓 통신'
  },
  gRPC: {
    stroke: '#c084fc',
    strokeWidth: 2.5,
    bg: 'bg-purple-950',
    text: 'text-purple-300',
    label: 'gRPC / HTTP/2',
    desc: '고성능 내부 마이크로서비스 RPC'
  },
  'Pub/Sub': {
    stroke: '#fb7185',
    strokeWidth: 2.5,
    dash: '4 4',
    bg: 'bg-rose-950',
    text: 'text-rose-300',
    label: 'Pub/Sub Event',
    desc: '비동기 이벤트 메시징 브로커'
  },
  SQL: {
    stroke: '#34d399',
    strokeWidth: 2.5,
    bg: 'bg-emerald-950',
    text: 'text-emerald-300',
    label: 'SQL (DB Driver)',
    desc: '관계형 데이터베이스 드라이버 쿼리'
  },
  Redis: {
    stroke: '#fb923c',
    strokeWidth: 2.5,
    dash: '6 3',
    bg: 'bg-orange-950',
    text: 'text-orange-300',
    label: 'Redis Cache',
    desc: '인메모리 캐시 및 세션 세마포어'
  },
  Kafka: {
    stroke: '#06b6d4',
    strokeWidth: 2.5,
    dash: '8 3 2 3',
    bg: 'bg-cyan-950',
    text: 'text-cyan-300',
    label: 'Kafka Stream',
    desc: '분산 이벤트 스트리밍 파이프라인'
  },
};

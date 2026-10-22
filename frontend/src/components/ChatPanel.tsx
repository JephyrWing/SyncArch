import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useChat } from '../hooks/useChat.ts';
import type { ProjectAccess } from '../hooks/useProjectAccess.ts';

interface ChatPanelProps {
  projectId: string;
  meId: string;
  readOnly: boolean;
  access: ProjectAccess;
  /** [채팅] 헤더와 같은 이름(같은 이름의 멤버는 이메일 앞부분으로 구분)을 쓰려고 받는다. */
  names?: Record<string, string>;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

/** [채팅] 편집하면서 팀원과 이야기하는 접이식 대화창. 닫혀 있을 때 온 팀원 메시지 수를 보여 준다. */
export const ChatPanel: React.FC<ChatPanelProps> = ({ projectId, meId, readOnly, access, names = {} }) => {
  const { messages, loaded, error, send } = useChat(projectId, access);
  const blocked = access.isStopped();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // [채팅] 첫 응답으로 받은 지난 대화는 읽은 것으로 보고, 그 뒤에 온 팀원 메시지만 새 메시지로 센다.
  const [seenReady, setSeenReady] = useState(false);
  useEffect(() => {
    if (loaded && !seenReady) {
      setSeen(new Set(messages.map((m) => m.id)));
      setSeenReady(true);
    }
  }, [loaded, seenReady, messages]);
  useEffect(() => {
    // [채팅] 개수가 아니라 id로 기억한다. 늦게 도착한 팀원 메시지가 내 메시지 앞에 끼어들어도 새 메시지로 센다.
    if (open) setSeen(new Set(messages.map((m) => m.id)));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const unread = seenReady ? messages.filter((m) => !seen.has(m.id) && m.userId !== meId).length : 0;

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending || readOnly || blocked) return;
    setSending(true);
    setSendError('');
    try {
      await send(body);
      // [채팅] 응답을 기다리는 동안 새로 쓴 내용은 지우지 않는다.
      setDraft((current) => (current.trim() === body ? '' : current));
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[55] flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xl hover:bg-indigo-500"
        aria-label={`팀 채팅 열기${unread ? `, 새 메시지 ${unread}개` : ''}`}
      >
        <MessageCircle className="h-4 w-4" />
        팀 채팅
        {unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px]">{unread}</span>}
      </button>
    );
  }

  return (
    <section
      aria-label="팀 채팅"
      className="fixed bottom-4 left-4 z-[55] flex h-[min(460px,calc(100vh-6rem))] w-[min(340px,calc(100vw-2rem))] flex-col rounded-2xl border border-slate-700 bg-slate-900/95 text-xs text-slate-100 shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="flex items-center gap-1.5 font-bold">
          <MessageCircle className="h-4 w-4 text-indigo-400" />팀 채팅
        </span>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white" aria-label="채팅 닫기">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div ref={listRef} aria-live="polite" className="flex-1 space-y-2 overflow-y-auto px-3 py-2 select-text">
        {messages.length === 0 && <p className="pt-6 text-center text-slate-500">아직 대화가 없습니다. 편집하면서 의견을 나눠 보세요.</p>}
        {messages.map((m) => {
          const mine = m.userId === meId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && <span className="mb-0.5 text-[10px] text-slate-400">{names[m.userId] ?? m.displayName}</span>}
              <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-2.5 py-1.5 ${mine ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-100'}`}>
                {m.body}
              </div>
              <span className="mt-0.5 text-[9px] text-slate-500">{timeOf(m.createdAt)}</span>
            </div>
          );
        })}
      </div>
      {(error || sendError || access.getError()) && <p role="alert" className="px-3 pb-1 text-rose-400">{access.getError()?.message || sendError || error}</p>}
      <form
        className="flex items-end gap-2 border-t border-slate-800 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          aria-label="메시지"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // [채팅] 한글 조합 중 Enter는 글자 확정이라 보내지 않는다. Shift+Enter는 줄바꿈.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={readOnly || blocked}
          maxLength={1000}
          rows={2}
          placeholder={readOnly ? '보관된 프로젝트는 대화를 보낼 수 없습니다' : '메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)'}
          className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-white focus:border-indigo-500 focus:outline-none"
        />
        <button type="submit" disabled={readOnly || blocked || sending || !draft.trim()} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-40" aria-label="보내기">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
};

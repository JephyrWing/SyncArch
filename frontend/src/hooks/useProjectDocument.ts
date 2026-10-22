import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client.ts';
import { fetchDocument, saveDocument, type SaveDocumentBody } from '../api/projects.ts';
import { toPayload, toProjectData, toSaveBody } from '../adapters/projectAdapter.ts';
import { describeChanges, diffPayload, type DocumentChange } from '../utils/documentDiff.ts';
import { mergeProject } from '../utils/mergeDocument.ts';
import type { DocumentView, ProjectData } from '../types/index.ts';

// [문서 저장] 02 설계 편집 상태 전이에 'invalid'(422, 다음 편집으로 해결)와 'readonly'(보관·권한 없음)를 더했다.
// [협업 상태] 버전 충돌은 자동 병합으로 풀기 때문에 'conflict' 상태는 없다.
export type SaveStatus = 'loading' | 'clean' | 'dirty' | 'saving' | 'failed' | 'invalid' | 'readonly' | 'error';

export interface RemoteChange {
  actorId: string;
  text: string;
  changes: DocumentChange[];
  version: number;
}

interface PendingSave {
  body: SaveDocumentBody;
  revision: number;
  // [협업 상태] 저장에 성공하면 이 내용이 다음 병합의 공통 조상이 된다.
  snapshot: ProjectData;
}

/** [문서 저장] 저장 안 된 편집이 없어서 프로젝트 전환이나 로그아웃을 해도 잃는 게 없는 상태. */
export const SAFE_TO_LEAVE: SaveStatus[] = ['clean', 'readonly', 'error', 'loading'];

// [협업 상태] 팀원 화면에 1~2초 안에 보이도록 짧게 저장하고 1초마다 확인한다(변경이 없으면 304라 가볍다).
// shortcut: 폴링이라 지연이 최대 약 1.5초다. 커서 공유처럼 더 빠른 동기화가 필요하면 WebSocket으로 바꾼다.
const SAVE_DELAY_MS = 300;
const POLL_MS = 1000;

const describeFieldError = (error: ApiError, project: ProjectData | null): string => {
  const first = error.detail.fieldErrors?.[0];
  if (!first) return error.message;
  const match = /^payload\.tables\[(\d+)\](?:\.columns\[(\d+)\])?/.exec(first.path);
  const table = match ? project?.tables[Number(match[1])] : undefined;
  const column = match?.[2] !== undefined ? table?.columns[Number(match[2])] : undefined;
  const where = table ? (column ? `${table.name}.${column.name}` : table.name) : first.path;
  return `저장되지 않았습니다 — ${where}: ${first.reason} 값을 고치면 자동으로 다시 저장합니다.`;
};

/**
 * [문서 저장] 프로젝트 문서 하나를 불러오고, 편집을 compare-and-swap으로 자동 저장하고, 팀원 저장을 폴링한다.
 * [협업 상태] 팀원 저장본은 바로 화면에 합치고(mergeProject), 저장이 버전 충돌로 거절되면 최신본에 합쳐 다시 저장한다.
 */
export const useProjectDocument = (
  projectId: string | null,
  options: { onRemoteChange: (change: RemoteChange) => void; onAuthExpired: () => void }
) => {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [status, setStatusState] = useState<SaveStatus>('loading');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);

  const projectIdRef = useRef(projectId);
  const projectRef = useRef<ProjectData | null>(null);
  const statusRef = useRef<SaveStatus>('loading');
  const versionRef = useRef(0);
  const notifiedVersionRef = useRef(0);
  const baseRef = useRef<ProjectData | null>(null);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const inFlightRef = useRef<PendingSave | null>(null);
  const failedRef = useRef<PendingSave | null>(null);
  // [문서 저장] 불러오기·프로젝트 전환 때마다 올려서, 이전 프로젝트의 늦은 응답을 무시한다.
  const generationRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setStatus = (next: SaveStatus, text = '') => {
    statusRef.current = next;
    setStatusState(next);
    setMessage(text);
  };

  const apply = (view: DocumentView) => {
    const next = toProjectData(view, 1);
    projectRef.current = next;
    setProject(next);
    versionRef.current = view.version;
    notifiedVersionRef.current = Math.max(notifiedVersionRef.current, view.version);
    setVersion(view.version);
    baseRef.current = next;
    revisionRef.current = 0;
    savedRevisionRef.current = 0;
    failedRef.current = null;
    if (view.project.archivedAt) setStatus('readonly', '보관된 프로젝트입니다. 읽기와 내보내기만 할 수 있습니다.');
    else setStatus('clean');
  };

  // [협업 상태] 팀원 저장본을 저장 안 된 내 편집 위에 합친다. 합친 결과가 서버본과 같으면 더 저장할 것이 없다.
  const mergeRemote = (view: DocumentView) => {
    const remote = toProjectData(view, 1);
    const merged = baseRef.current && projectRef.current ? mergeProject(baseRef.current, projectRef.current, remote) : remote;
    baseRef.current = remote;
    versionRef.current = view.version;
    notifiedVersionRef.current = Math.max(notifiedVersionRef.current, view.version);
    setVersion(view.version);
    projectRef.current = merged;
    setProject(merged);
    failedRef.current = null;
    revisionRef.current += 1;
    if (JSON.stringify(toSaveBody(merged, 0, '')) === JSON.stringify(toSaveBody(remote, 0, ''))) {
      savedRevisionRef.current = revisionRef.current;
      setStatus('clean');
    } else {
      setStatus('dirty');
      schedule();
    }
  };

  const notifyRemote = (view: DocumentView) => {
    if (view.version <= notifiedVersionRef.current) return;
    notifiedVersionRef.current = view.version;
    const changes = baseRef.current ? diffPayload(toPayload(baseRef.current), view.payload) : [];
    // shortcut: 문서 응답에 저장한 사람이 없어서 '팀원'으로 표시한다. 이름이 필요하면 /activity의 actorName을 쓴다.
    const actor = view.updatedBy ?? { id: '', displayName: '팀원' };
    optionsRef.current.onRemoteChange({ actorId: actor.id, text: describeChanges(actor.displayName, changes, view.version), changes, version: view.version });
  };

  // [협업 상태] 내 저장이 버전 충돌로 거절됐다. 최신본을 받아 합친 뒤 다시 저장한다.
  const rebase = async (generation: number) => {
    const id = projectIdRef.current;
    if (!id) return;
    try {
      const view = await fetchDocument(id);
      if (!view || generation !== generationRef.current) return;
      notifyRemote(view);
      // [협업 상태] 그 사이 보관됐다면 다시 저장이 403으로 실패하고 백업 안내가 뜬다.
      mergeRemote(view);
    } catch (error) {
      if (generation !== generationRef.current) return;
      setStatus('failed', `팀원 변경을 받지 못해 저장하지 못했습니다. ${(error as Error).message}`);
    }
  };

  const load = async () => {
    const id = projectIdRef.current;
    if (!id) return;
    const generation = ++generationRef.current;
    window.clearTimeout(timerRef.current);
    inFlightRef.current = null;
    notifiedVersionRef.current = 0;
    setStatus('loading');
    try {
      const view = await fetchDocument(id);
      if (generation === generationRef.current && view) apply(view);
    } catch (error) {
      if (generation !== generationRef.current) return;
      if (error instanceof ApiError && error.status === 401) optionsRef.current.onAuthExpired();
      else setStatus('error', (error as Error).message);
    }
  };

  const send = async (pending: PendingSave) => {
    const id = projectIdRef.current;
    if (!id) return;
    const generation = generationRef.current;
    inFlightRef.current = pending;
    setStatus('saving');
    try {
      const result = await saveDocument(id, pending.body);
      if (generation !== generationRef.current) return;
      inFlightRef.current = null;
      failedRef.current = null;
      versionRef.current = result.version;
      notifiedVersionRef.current = Math.max(notifiedVersionRef.current, result.version);
      setVersion(result.version);
      // [문서 저장] 서버는 댓글 시각·작성자·기본값을 채운 정규화본을 돌려준다. 다음 저장이 그 값을 바꾸지 않도록 받아 쓰고,
      // 요청 중에 생긴 내 편집은 그 위에 합친다.
      const saved = result.payload && result.project
        ? toProjectData({ project: result.project, payload: result.payload, version: result.version, updatedAt: result.updatedAt }, 1)
        : pending.snapshot;
      baseRef.current = saved;
      if (saved !== pending.snapshot && projectRef.current) {
        const merged = mergeProject(pending.snapshot, projectRef.current, saved);
        projectRef.current = merged;
        setProject(merged);
      }
      savedRevisionRef.current = pending.revision;
      // [문서 저장] 요청이 진행 중일 때 생긴 편집은 다음 요청으로 보낸다.
      if (revisionRef.current !== pending.revision) {
        setStatus('dirty');
        schedule();
      } else {
        setStatus('clean');
      }
    } catch (error) {
      if (generation !== generationRef.current) return;
      inFlightRef.current = null;
      const apiError = error instanceof ApiError ? error : new ApiError(0, 'INTERNAL_ERROR', String(error));
      if (apiError.code === 'VERSION_CONFLICT') {
        // [협업 상태] 최신본을 못 받으면 '다시 시도'가 같은 요청을 보내고, 다시 409를 받아 병합을 재시도한다.
        failedRef.current = pending;
        rebase(generation);
      } else if (apiError.status === 422 || apiError.status === 413 || apiError.status === 409) {
        setStatus('invalid', describeFieldError(apiError, projectRef.current));
      } else if (apiError.status === 403) {
        // [문서 저장] 편집 중 보관·제외되면 저장 안 된 편집을 남겨 백업할 수 있게 한다(폴링은 'failed'를 덮어쓰지 않는다).
        failedRef.current = pending;
        setStatus('failed', `${apiError.message} 저장되지 않은 내 변경을 백업하세요.`);
      } else if (apiError.status === 401) {
        failedRef.current = pending;
        setStatus('failed', '로그인이 만료되었습니다. 내 변경을 백업한 뒤 새로고침해서 다시 로그인하세요.');
      } else {
        // [문서 저장] 같은 mutationId와 본문으로 재시도하므로 서버는 최대 한 번만 적용한다.
        failedRef.current = pending;
        setStatus('failed', apiError.message);
      }
    }
  };

  const save = () => {
    window.clearTimeout(timerRef.current);
    const current = projectRef.current;
    if (!current || inFlightRef.current) return;
    if (statusRef.current !== 'dirty' && statusRef.current !== 'invalid') return;
    if (revisionRef.current === savedRevisionRef.current) {
      setStatus('clean');
      return;
    }
    send({ body: toSaveBody(current, versionRef.current, crypto.randomUUID()), revision: revisionRef.current, snapshot: current });
  };

  const schedule = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(save, SAVE_DELAY_MS);
  };

  const update = (fields: Partial<ProjectData>) => {
    const current = projectRef.current;
    const state = statusRef.current;
    if (!current || state === 'loading' || state === 'readonly' || state === 'error') return;
    const next = { ...current, ...fields };
    projectRef.current = next;
    setProject(next);
    revisionRef.current += 1;
    // [문서 저장] 편집은 로컬에 두고, 사용자가 실패를 해결하면 저장을 이어간다.
    if (state === 'failed') return;
    if (state !== 'saving') setStatus('dirty');
    schedule();
  };

  const retry = () => {
    if (failedRef.current && !inFlightRef.current) send(failedRef.current);
  };

  const downloadBackup = () => {
    const current = projectRef.current;
    if (!current) return;
    const { project: meta, payload } = toSaveBody(current, versionRef.current, '');
    const backup = { projectId: current.id, baseVersion: versionRef.current, project: meta, payload };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `syncarch-${current.title}-v${versionRef.current}-backup.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    projectIdRef.current = projectId;
    if (!projectId) return;
    load();

    const poll = async () => {
      const generation = generationRef.current;
      const state = statusRef.current;
      if (document.hidden || inFlightRef.current || state === 'loading' || state === 'error') return;
      try {
        const view = await fetchDocument(projectId, versionRef.current);
        if (!view || generation !== generationRef.current || view.version <= versionRef.current || inFlightRef.current) return;
        notifyRemote(view);
        const current = statusRef.current;
        if (current === 'clean' || current === 'readonly') apply(view);
        // [협업 상태] 실패한 저장은 같은 본문으로 재시도해야 하므로 그때는 합치지 않는다.
        else if (current === 'dirty' || current === 'invalid') mergeRemote(view);
      } catch (error) {
        // [구글 로그인] 세션이 끝났는데 화면만 남아 있으면 팀원 변경을 못 받는다. 잃을 편집이 없을 때만 로그인 화면으로 보낸다.
        // [구글 로그인] 이전 화면에서 보낸 요청의 늦은 401이 새로 로그인한 화면을 로그아웃시키지 않게 세대를 확인한다.
        if (generation === generationRef.current && error instanceof ApiError && error.status === 401 && SAFE_TO_LEAVE.includes(statusRef.current)) {
          optionsRef.current.onAuthExpired();
        }
        // [협업 상태] 그 밖의 폴링 실패는 일시적이라 다음 주기나 창 포커스 때 다시 시도한다.
      }
    };

    const timer = window.setInterval(poll, POLL_MS);
    window.addEventListener('focus', poll);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', poll);
      window.clearTimeout(timerRef.current);
      generationRef.current += 1;
    };
  }, [projectId]);

  return {
    project,
    status,
    // [문서 저장] 현재 상태를 읽으므로 호출자가 요청을 기다린 뒤 다시 확인할 수 있다.
    isSafeToLeave: () => SAFE_TO_LEAVE.includes(statusRef.current),
    message,
    version,
    update,
    retry,
    reloadLatest: load,
    downloadBackup,
  };
};

// [API 통신] Flask API용 얇은 fetch 래퍼: {data} / {error:{code,message}} 계약과 JWT 액세스 토큰(Authorization 헤더)을 처리한다.
import { authClient } from './auth.ts';

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  currentVersion?: number;
  fieldErrors?: { path: string; reason: string }[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: ApiErrorDetail;

  constructor(status: number, code: string, message: string, detail: ApiErrorDetail = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export interface ApiResponse<T> {
  status: number;
  data?: T;
}

// [API 통신] 액세스 토큰을 붙여 보낸다. 토큰은 15분이면 만료되므로 401이면 리프레시 쿠키로 한 번 새로 받고 다시 보낸다.
const send = async (path: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> => {
  const go = () =>
    fetch(path, {
      ...init,
      headers: { ...init.headers, ...authClient.authorization() },
      credentials: 'same-origin',
      // [API 통신] 폴링에는 브라우저 캐시를 쓰지 않고 If-None-Match를 직접 보낸다.
      cache: 'no-store',
    });
  try {
    const response = await go();
    if (response.status !== 401 || !(await authClient.refresh().then(() => true, () => false))) return response;
    return await go();
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크와 서버 실행 상태를 확인한 뒤 다시 시도하세요.');
  }
};

const toError = async (response: Response): Promise<ApiError> => {
  const detail: ApiErrorDetail = (await response.json().catch(() => null))?.error ?? {};
  return new ApiError(
    response.status,
    detail.code ?? 'INTERNAL_ERROR',
    detail.message ?? `요청이 실패했습니다 (HTTP ${response.status}).`,
    detail
  );
};

export const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await send(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

  // [API 통신] 304와 204는 본문이 없어서 JSON으로 파싱하면 예외가 난다.
  if (response.status === 204 || response.status === 304) return { status: response.status };
  if (!response.ok) throw await toError(response);
  const json = await response.json().catch(() => null);
  return { status: response.status, data: json?.data as T };
};

/** [API 통신] 파일 다운로드. 링크로 열면 Authorization 헤더가 붙지 않아서 직접 받아 저장한다. */
export const downloadFile = async (path: string, fallbackName: string): Promise<void> => {
  const response = await send(path, { method: 'GET', headers: {} });
  if (!response.ok) throw await toError(response);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = encoded ? decodeURIComponent(encoded) : fallbackName;
  link.click();
  URL.revokeObjectURL(url);
};

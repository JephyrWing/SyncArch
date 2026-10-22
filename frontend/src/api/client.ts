// [API 통신] Flask API용 얇은 fetch 래퍼: {data} / {error:{code,message}} 계약, 세션 쿠키, CSRF 헤더를 처리한다.

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

let csrfToken = '';

export const setCsrfToken = (token: string) => {
  csrfToken = token;
};

const ensureCsrfToken = async (): Promise<string> => {
  if (!csrfToken) {
    const response = await request<{ csrfToken: string }>('GET', '/api/auth/csrf');
    csrfToken = response.data?.csrfToken ?? '';
  }
  return csrfToken;
};

export const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRFToken'] = await ensureCsrfToken();

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      // [API 통신] 폴링에는 브라우저 캐시를 쓰지 않고 If-None-Match를 직접 보낸다.
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크와 서버 실행 상태를 확인한 뒤 다시 시도하세요.');
  }

  // [API 통신] 304와 204는 본문이 없어서 JSON으로 파싱하면 예외가 난다.
  if (response.status === 204 || response.status === 304) return { status: response.status };

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const detail: ApiErrorDetail = json?.error ?? {};
    if (detail.code === 'CSRF_FAILED') csrfToken = '';
    throw new ApiError(
      response.status,
      detail.code ?? 'INTERNAL_ERROR',
      detail.message ?? `요청이 실패했습니다 (HTTP ${response.status}).`,
      detail
    );
  }
  return { status: response.status, data: json?.data as T };
};

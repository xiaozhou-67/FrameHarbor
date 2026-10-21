import type { ApiFailure, ApiResponse } from '../../shared/domain.ts';
let csrfToken: string | null = null;
export function setCsrfToken(value: string | null) {
  csrfToken = value;
}
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const timeout = AbortSignal.timeout(15000);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
      headers: {
        Accept: 'application/json',
        ...(method === 'GET'
          ? {}
          : {
              'Content-Type': 'application/json',
              'X-FrameHarbor-Request': '1',
              ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            }),
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(options.body ?? {}) }),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK', '连接暂时中断，请检查网络或 API 服务后重试');
  }
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | ApiFailure | null;
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('frameharbor:unauthorized'));
    const error = payload && 'error' in payload ? payload.error : null;
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `请求失败（${response.status}）`,
    );
  }
  if (!payload || !('data' in payload))
    throw new ApiError(502, 'INVALID_RESPONSE', '服务返回了异常数据，请稍后重试');
  return payload.data;
}
export function query(values: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return params.size ? `?${params.toString()}` : '';
}
export const messageOf = (error: unknown) => (error instanceof Error ? error.message : '操作失败，请重试');

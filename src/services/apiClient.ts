// Centralized client for the new FastAPI backend (MIGRATION_PLAN.md §7/§11).
// Supabase's `{ data, error }` tuple is being phased out hook by hook; this
// client throws on failure instead, matching the try/catch and
// `if (error) throw error` patterns already used throughout src/hooks/.

// The fallback is environment-aware because nothing sets VITE_API_BASE_URL on
// Vercel or Lovable, and a committed .env.production isn't an option (the root
// .gitignore ignores .env*). Dev builds talk to the local uvicorn; any
// production build talks to the deployed backend. VITE_API_BASE_URL still
// overrides both when it is set.
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.DEV ? 'http://localhost:8000/api/v1' : 'https://api.pravinraj.dev/api/v1');

export const TOKEN_STORAGE_KEY = 'gg_portfolio_admin_token';

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY);
export const setStoredToken = (token: string): void => localStorage.setItem(TOKEN_STORAGE_KEY, token);
export const clearStoredToken = (): void => localStorage.removeItem(TOKEN_STORAGE_KEY);

// Called when a request that carried an admin token comes back 401, i.e. the
// session expired while the page was open. Registered by authService so this
// file doesn't have to import it (authService already imports apiClient).
let unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null): void => {
  unauthorizedHandler = handler;
};

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

const buildUrl = (path: string, params?: RequestOptions['params']): string => {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  { params, signal, body }: RequestOptions & { body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // FormData (file uploads) must NOT get a JSON Content-Type or a
  // JSON.stringify'd body -- the browser sets the correct
  // multipart/form-data boundary itself only when neither is set.
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  });

  // 204 No Content and empty bodies (e.g. some DELETE responses) have nothing to parse.
  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const detail = parsed && typeof parsed === 'object' && 'detail' in parsed ? parsed.detail : parsed;
    const message =
      typeof detail === 'string' ? detail : `Request to ${path} failed with status ${response.status}`;
    // Login excluded: a wrong password is also a 401, and isn't an expired session.
    if (response.status === 401 && token && path !== '/auth/login') unauthorizedHandler?.();
    throw new ApiError(response.status, detail, message);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

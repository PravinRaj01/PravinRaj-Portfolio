
// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§8/§11):
// POST /auth/login, GET /auth/me, POST /auth/logout, all verified working
// (with the real seeded admin) since the auth phase of this migration.
import { apiClient, TOKEN_STORAGE_KEY, setStoredToken, getStoredToken, clearStoredToken } from '@/services/apiClient';

export interface AdminUser {
  id: string;
  email: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AdminUser;
}

type AuthListener = (user: AdminUser | null) => void;
const listeners = new Set<AuthListener>();

const notifyListeners = (user: AdminUser | null) => {
  listeners.forEach((callback) => callback(user));
};

export const signInAdmin = async (email: string, password: string): Promise<AdminUser> => {
  const data = await apiClient.post<TokenResponse>('/auth/login', { email, password });
  setStoredToken(data.access_token);
  notifyListeners(data.user);
  return data.user;
};

export const signOutAdmin = async (): Promise<void> => {
  try {
    // JWTs are stateless -- this just lets the backend log the event, if it
    // ever wants to. There's no server-side session to actually invalidate.
    await apiClient.post('/auth/logout');
  } finally {
    clearStoredToken();
    notifyListeners(null);
  }
};

export const getCurrentUser = async (): Promise<AdminUser | null> => {
  if (!getStoredToken()) return null;
  try {
    return await apiClient.get<AdminUser>('/auth/me');
  } catch {
    // Token missing/expired/invalid -- drop it so the next check is instant
    // instead of round-tripping to a 401 again.
    clearStoredToken();
    return null;
  }
};

// Supabase's onAuthStateChange was a live subscription with a
// `{ data: { subscription: { unsubscribe } } }` return shape; JWTs have no
// server-side session to subscribe to, so this is a small local pub/sub
// instead, returning a plain unsubscribe function. Two triggers:
//  - same-tab: signInAdmin/signOutAdmin call notifyListeners() directly
//  - other-tab: the browser's `storage` event fires here (never in the tab
//    that made the change) whenever the admin token key changes
export const onAuthStateChange = (callback: AuthListener): (() => void) => {
  listeners.add(callback);

  const onStorage = (event: StorageEvent) => {
    if (event.key === TOKEN_STORAGE_KEY) {
      getCurrentUser().then(callback);
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
};

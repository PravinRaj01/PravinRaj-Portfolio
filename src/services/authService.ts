
// Fully cut over to the new FastAPI backend (MIGRATION_PLAN.md §7/§8/§11):
// POST /auth/login, GET /auth/me, POST /auth/logout, all verified working
// (with the real seeded admin) since the auth phase of this migration.
import {
  apiClient,
  TOKEN_STORAGE_KEY,
  setStoredToken,
  getStoredToken,
  clearStoredToken,
  setUnauthorizedHandler,
} from '@/services/apiClient';

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

// --- Session renewal ---------------------------------------------------------
// The backend issues 60-minute tokens. While the admin page is open and in use
// the token is swapped for a fresh one in the background (POST /auth/refresh),
// so an hour of editing never ends in "Not authenticated". It still expires
// after about an hour idle, and the backend refuses renewal once the password
// was last typed more than 7 days ago -- then a real login is required.

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();

const notifyExpired = () => {
  expiredListeners.forEach((callback) => callback());
};

// Fires when the session is known to be unusable (a 401 on a request that
// carried a token, or a token already past its expiry). The admin shell
// answers by asking for a password *over* the page, never by unmounting it,
// so unsaved form edits survive.
export const onSessionExpired = (callback: ExpiredListener): (() => void) => {
  expiredListeners.add(callback);
  return () => {
    expiredListeners.delete(callback);
  };
};

setUnauthorizedHandler(notifyExpired);

let refreshInFlight: Promise<void> | null = null;

// Single-flight: the interval, a focus event and a visibility event can all
// ask at once, and only one request should go out.
export const refreshSession = (): Promise<void> => {
  if (!refreshInFlight) {
    refreshInFlight = apiClient
      .post<TokenResponse>('/auth/refresh')
      .then((data) => {
        setStoredToken(data.access_token);
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

// Seconds until the stored token's `exp`. Read client-side only to decide
// *when* to refresh -- the server is what actually verifies the token.
const secondsUntilExpiry = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
};

const RENEW_WHEN_UNDER_SECONDS = 15 * 60;
const CHECK_EVERY_MS = 60_000;

export const startSessionKeepAlive = (): (() => void) => {
  const check = async () => {
    const token = getStoredToken();
    if (!token) return;
    const secondsLeft = secondsUntilExpiry(token);
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      notifyExpired(); // e.g. the laptop slept past the expiry
      return;
    }
    if (secondsLeft < RENEW_WHEN_UNDER_SECONDS) {
      try {
        await refreshSession();
      } catch {
        // Offline or a server hiccup: try again on the next check. A real 401
        // has already raised the expired notice through apiClient.
      }
    }
  };

  // Background tabs throttle timers, so also check when the tab comes back.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };

  const interval = window.setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  void check();

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
};

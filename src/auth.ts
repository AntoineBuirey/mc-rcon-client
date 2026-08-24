import crypto from 'crypto';
import fs from 'fs';
import { spawn } from 'child_process';
import { AUTH_COOKIE_NAME, AUTH_PAM_BINARY_PATH, SESSION_TTL_MS } from './constants';
import type { AuthSession } from './types';

type CookieHeaderValue = string | string[] | undefined;

interface CookieRequest {
  headers: {
    cookie?: CookieHeaderValue;
  };
}

interface HeaderWritableResponse {
  setHeader(name: string, value: string): void;
}

const authSessions = new Map<string, AuthSession>();

function normalizeCookieHeader(cookieHeader: CookieHeaderValue): string {
  if (Array.isArray(cookieHeader)) {
    return cookieHeader.join(';');
  }
  return cookieHeader ?? '';
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, cookiePart) => {
    const separatorIndex = cookiePart.indexOf('=');
    if (separatorIndex === -1) {
      return cookies;
    }

    const key = cookiePart.slice(0, separatorIndex).trim();
    const value = cookiePart.slice(separatorIndex + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

export function getPamServiceCandidates(): string[] {
  return ['login', 'sshd', 'su'].filter((serviceName) => fs.existsSync(`/etc/pam.d/${serviceName}`));
}

export function authenticateLinuxAccount(username: string, password: string, serviceName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn(AUTH_PAM_BINARY_PATH, [serviceName, username, password], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }

      const error = stderr.trim() || `PAM authentication failed for ${serviceName} (exit code ${code})`;
      reject(new Error(error));
    });
  });
}

function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of authSessions.entries()) {
    if (session.expiresAt <= now) {
      authSessions.delete(token);
    }
  }
}

export function createSession(username: string): string {
  purgeExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  authSessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getAuthenticatedSession(req: CookieRequest): AuthSession | null {
  purgeExpiredSessions();
  const cookies = parseCookies(normalizeCookieHeader(req.headers.cookie));
  const token = cookies[AUTH_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = authSessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token);
    return null;
  }

  return session;
}

export function isAuthenticatedRequest(req: CookieRequest): boolean {
  return Boolean(getAuthenticatedSession(req));
}

export function setAuthCookie(res: HeaderWritableResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

export function clearAuthCookie(res: HeaderWritableResponse): void {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

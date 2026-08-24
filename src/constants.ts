import path from 'path';

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const PANEL_DIR = '/var/mc-rcon-panel';
export const CONFIG_PATH = path.join(PANEL_DIR, 'config.json');
export const AUTH_COOKIE_NAME = 'mc_rcon_auth';
export const AUTH_PAM_BINARY_PATH = path.join(PANEL_DIR, 'auth_pam.bin');

const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const LOGIN_PAGE_PATH = path.join(PUBLIC_DIR, 'login.html');
export const INDEX_PAGE_PATH = path.join(PUBLIC_DIR, 'index.html');

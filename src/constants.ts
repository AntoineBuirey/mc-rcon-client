import path from 'path';

export const APP_NAME = 'mc-rcon-panel';

export const DB_FILE_PATH = `/var/lib/${APP_NAME}/data.db`;
export const CONFIG_FILE_PATH = `/etc/${APP_NAME}/config.json`;
export const BIN_PATH = `/usr/local/bin/${APP_NAME}/auth_pam.bin`;

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const AUTH_COOKIE_NAME = 'mc_rcon_auth';

const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const LOGIN_PAGE_PATH = path.join(PUBLIC_DIR, 'login.html');
export const INDEX_PAGE_PATH = path.join(PUBLIC_DIR, 'index.html');

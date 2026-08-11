const express = require('express');
const http = require('http');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Rcon } = require('rcon-client'); // Changement ici

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const authSessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PANEL_DIR = '/var/mc-rcon-panel';
const PUBLIC_DIR = path.join(__dirname, 'public');

const LOGIN_PAGE_PATH = path.join(PUBLIC_DIR, 'login.html');
const INDEX_PAGE_PATH = path.join(PUBLIC_DIR, 'index.html');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const CONFIG_PATH = path.join(PANEL_DIR, 'config.json');
const AUTH_COOKIE_NAME = 'mc_rcon_auth';

const auth_pam_BINARY_PATH = PANEL_DIR + '/auth_pam';

function parseCookies(cookieHeader) {
    return (cookieHeader || '').split(';').reduce((cookies, cookiePart) => {
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

function getPamServiceCandidates() {
    return ['login', 'sshd', 'su']
        .filter(serviceName => fs.existsSync(`/etc/pam.d/${serviceName}`));
}

function authenticateLinuxAccount(username, password, serviceName) {
    return new Promise((resolve, reject) => {
        const child = spawn(auth_pam_BINARY_PATH, [serviceName, username, password], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderr = '';

        child.stderr.on('data', (chunk) => {
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

function purgeExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of authSessions.entries()) {
        if (session.expiresAt <= now) {
            authSessions.delete(token);
        }
    }
}

function createSession(username) {
    purgeExpiredSessions();
    const token = crypto.randomBytes(32).toString('hex');
    authSessions.set(token, {
        username,
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    return token;
}

function getAuthenticatedSession(req) {
    purgeExpiredSessions();
    const cookies = parseCookies(req.headers.cookie);
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

function isAuthenticatedRequest(req) {
    return Boolean(getAuthenticatedSession(req));
}

function setAuthCookie(res, token) {
    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
}

function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function renderLoginPage(message = '') {
    const loginPage = fs.readFileSync(LOGIN_PAGE_PATH, 'utf8');
    return loginPage.replace('__ERROR_MESSAGE__', message || '');
}

function sendIndexPage(res) {
    res.sendFile(INDEX_PAGE_PATH);
}

function loadConfig() {
    console.log("Loading config.json from:", CONFIG_PATH);
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(data);
        return {
            port: 3000,
            administrator: 'administrateur',
            servers: [],
            ...config
        };
    } catch (err) {
        console.error("Failed to read config.json:", err);
        return {
            port: 3000,
            administrator: 'administrateur',
            servers: []
        };
    }
}

function formatCommand(command, administrator) {
    const trimmedCommand = command.trim();

    if (trimmedCommand.startsWith('/')) {
        return trimmedCommand;
    }

    const tellrawPayload = JSON.stringify([
        '',
        { text: `<${administrator}> ` },
        { text: trimmedCommand }
    ]);

    return `/tellraw @a ${tellrawPayload}`;
}

// Parse server.properties to extract RCON port, password, and IP
function parseServerProperties(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error("File not found");
        }
        const content = fs.readFileSync(filePath, 'utf8');
        let rconPort = 25575;
        let rconIp = '127.0.0.1';
        let rconPassword = '';

        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || !trimmed.includes('=')) return;
            const [key, value] = trimmed.split('=', 2);
            
            const k = key.trim();
            const v = value.trim();

            if (k === 'rcon.port') rconPort = parseInt(v, 10) || 25575;
            if (k === 'rcon.ip' && v !== '') rconIp = v;
            if (k === 'rcon.password') rconPassword = v;
        });
        return { host: rconIp, port: rconPort, password: rconPassword };
    } catch (err) {
        console.error(`Error parsing ${filePath}:`, err);
        return { host: '127.0.0.1', port: 25575, password: '' };
    }
}

app.get('/', (req, res) => {
    if (isAuthenticatedRequest(req)) {
        sendIndexPage(res);
        return;
    }

    res.status(200).send(renderLoginPage());
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        res.status(401).send(renderLoginPage('Identifiants Linux invalides.'));
        return;
    }

    const serviceCandidates = getPamServiceCandidates();

    if (serviceCandidates.length === 0) {
        res.status(500).send(renderLoginPage('Aucun service PAM local disponible sur la machine.'));
        return;
    }

    let lastError = null;
    for (const serviceName of serviceCandidates) {
        try {
            await authenticateLinuxAccount(username, password, serviceName);
            const token = createSession(username);
            setAuthCookie(res, token);
            res.redirect('/');
            return;
        } catch (error) {
            lastError = error;
        }
    }

    const errorMessage = lastError ? lastError.message : 'Identifiants Linux invalides.';
    res.status(401).send(renderLoginPage(`Identifiants Linux invalides. ${errorMessage}`));
});

app.post('/api/logout', (req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});

app.get('/api/servers', (req, res) => {
    if (!isAuthenticatedRequest(req)) {
        res.status(401).json({ error: 'Authentification requise.' });
        return;
    }

    const config = loadConfig();
    const publicServers = config.servers.map((srv, index) => {
        const props = parseServerProperties(srv.propertiesPath);
        return {
            id: index,
            name: srv.name,
            host: props.host,
            port: props.port,
            propertiesPath: srv.propertiesPath
        };
    });
    res.json(publicServers);
});

wss.on('connection', (ws, req) => {
    if (!isAuthenticatedRequest(req)) {
        ws.close(1008, 'Authentification requise.');
        return;
    }

    ws.on('message', async (message) => {
        try {
            const { serverId, command } = JSON.parse(message);
            const config = loadConfig();
            const srvConfig = config.servers[serverId];

            if (!srvConfig) {
                ws.send(JSON.stringify({ error: "Serveur non trouvé." }));
                return;
            }

            const props = parseServerProperties(srvConfig.propertiesPath);
            const rconCommand = formatCommand(command, config.administrator || 'administrateur');
            
            if (!props.password) {
                ws.send(JSON.stringify({ error: "Mot de passe RCON non défini dans server.properties." }));
                return;
            }

            // Utilisation de rcon-client
            const rcon = new Rcon({
                host: props.host === '0.0.0.0' ? '127.0.0.1' : props.host,
                port: props.port,
                password: props.password
            });

            await rcon.connect();
            const response = await rcon.send(rconCommand);
            await rcon.end();

            ws.send(JSON.stringify({ serverId, response }));
        } catch (err) {
            ws.send(JSON.stringify({ error: err.message || "Erreur de connexion RCON." }));
        }
    });
});

const config = loadConfig();
const PORT = config.port || 3000;
server.listen(PORT, () => {
    console.log(`RCON Web Panel running on http://localhost:${PORT}`);
});
import fs from 'fs';
import type { Express, Request, Response } from 'express-serve-static-core';
import { INDEX_PAGE_PATH, LOGIN_PAGE_PATH } from './constants';
import {
    authenticateLinuxAccount,
    clearAuthCookie,
    createSession,
    getPamServiceCandidates,
    isAuthenticatedRequest,
    setAuthCookie
} from './auth';
import { loadConfig } from './config';
import { Database } from './database';
import { ServerConfig } from './types';
import { PUBLIC_DIR } from './constants';

function renderLoginPage(message = ''): string {
    const loginPage = fs.readFileSync(LOGIN_PAGE_PATH, 'utf8');
    return loginPage.replace('__ERROR_MESSAGE__', message || '');
}

function sendStaticFile(res: Response, filePath: string): void {
    if (!fs.existsSync(filePath)) {
        res.status(404).send('Not Found.');
        return;
    }
    const normalizedPath = fs.realpathSync(filePath);
    if (!normalizedPath.startsWith(PUBLIC_DIR)) {
        res.status(403).send('Forbidden.');
        return;
    }
    console.log(`Sending static file: ${filePath}`);
    res.sendFile(filePath);
}

export function registerHttpRoutes(app: Express): void {
    app.get('/', (req, res) => {
        if (isAuthenticatedRequest(req)) {
            res.sendFile(INDEX_PAGE_PATH);
            return;
        }

        res.redirect('/login');
    });

    app.get('/login', (req, res) => {
        if (isAuthenticatedRequest(req)) {
            res.redirect('/');
            return;
        }

        res.send(renderLoginPage());
    });

    app.post('/api/login', async (req: Request, res: Response) => {
        const { username, password } = req.body as { username?: string; password?: string };

        if (!username || !password) {
            res.status(400).json({ error: 'Nom d\'utilisateur ou mot de passe manquant.' });
            return;
        }
        console.log(`Attempting to authenticate user: ${username}`);
        const pamServices = getPamServiceCandidates();
        let authenticated = false;

        for (const service of pamServices) {
            try {
                authenticated = await authenticateLinuxAccount(username, password, service);
                console.debug(`Authentication attempt for user ${username} using PAM service ${service}: ${authenticated}`);
                if (authenticated) {
                    break;
                }
            } catch (error) {
                console.error(`Erreur lors de l'authentification avec le service PAM ${service}:`, error);
            }
        }

        if (!authenticated) {
            console.warn(`Authentication failed for user: ${username}`);
            res.status(401).json({ error: 'Password or username invalid' });
            return;
        }

        const sessionId = createSession(username);
        setAuthCookie(res, sessionId);

        console.log(`User ${username} authenticated successfully. Session ID: ${sessionId}`);
        res.json({ ok: true });
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
        const db = Database.getInstance();
        const publicServers = db.getServers()
            .then((servers) => {
                res.json(servers);
            }).catch((err) => {
                console.error('Erreur lors de la récupération des serveurs depuis la base de données :', err);
                res.status(500).json({ error: 'Erreur interne du serveur.' });
            });
    });

    app.post('/api/server', (req, res) => {
        if (!isAuthenticatedRequest(req)) {
            res.status(401).json({ error: 'Authentification requise.' });
            return;
        }

        const serverConfig = req.body as Partial<ServerConfig>;

        if (!serverConfig.name || !serverConfig.host || !serverConfig.port || !serverConfig.password) {
            res.status(400).json({ error: 'Configuration du serveur invalide.' });
            return;
        }

        const db = Database.getInstance();

        db.addServer(serverConfig as ServerConfig)
            .then(() => {
                res.json({ ok: true });
            })
            .catch((err) => {
                console.error('Erreur lors de l\'ajout du serveur à la base de données :', err);
                res.status(500).json({ error: 'Erreur interne du serveur.' });
            });
    });

    app.delete('/api/server/:id', (req, res) => {
        if (!isAuthenticatedRequest(req)) {
            res.status(401).json({ error: 'Authentification requise.' });
            return;
        }

        const serverId = parseInt(req.params.id, 10);
        if (isNaN(serverId)) {
            res.status(400).json({ error: 'ID du serveur invalide.' });
            return;
        }

        const db = Database.getInstance();

        db.deleteServer(serverId)
            .then(() => {
                res.json({ ok: true });
            })
            .catch((err) => {
                console.error('Erreur lors de la suppression du serveur de la base de données :', err);
                res.status(500).json({ error: 'Erreur interne du serveur.' });
            });
    });

    app.get('/api/server/:id', (req, res) => {
        if (!isAuthenticatedRequest(req)) {
            res.status(401).json({ error: 'Authentification requise.' });
            return;
        }

        const serverId = parseInt(req.params.id, 10);
        if (isNaN(serverId)) {
            res.status(400).json({ error: 'ID du serveur invalide.' });
            return;
        }

        const db = Database.getInstance();

        db.getServerById(serverId)
            .then((server) => {
                if (!server) {
                    res.status(404).json({ error: 'Serveur non trouvé.' });
                    return;
                }
                res.json(server);
            })
            .catch((err) => {
                console.error('Erreur lors de la récupération du serveur depuis la base de données :', err);
                res.status(500).json({ error: 'Erreur interne du serveur.' });
            });
    });

    app.put('/api/server/:id', (req, res) => {
        if (!isAuthenticatedRequest(req)) {
            res.status(401).json({ error: 'Authentification requise.' });
            return;
        }

        const serverId = parseInt(req.params.id, 10);
        if (isNaN(serverId)) {
            res.status(400).json({ error: 'ID du serveur invalide.' });
            return;
        }

        const serverConfig = req.body as Partial<ServerConfig>;

        if (!serverConfig.name || !serverConfig.host || !serverConfig.port || !serverConfig.password) {
            res.status(400).json({ error: 'Configuration du serveur invalide.' });
            return;
        }

        const db = Database.getInstance();

        db.updateServer(serverId, serverConfig as ServerConfig)
            .then(() => {
                res.json({ ok: true });
            })
            .catch((err) => {
                console.error('Erreur lors de la mise à jour du serveur dans la base de données :', err);
                res.status(500).json({ error: 'Erreur interne du serveur.' });
            });
    });

    app.get('/*', (req, res) => {
        const filePath = req.path === '/' ? INDEX_PAGE_PATH : `${PUBLIC_DIR}${req.path}`;
        sendStaticFile(res, filePath);
    });
}

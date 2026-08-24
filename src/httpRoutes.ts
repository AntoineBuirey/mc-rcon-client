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
import { loadConfig, parseServerProperties } from './config';

function renderLoginPage(message = ''): string {
  const loginPage = fs.readFileSync(LOGIN_PAGE_PATH, 'utf8');
  return loginPage.replace('__ERROR_MESSAGE__', message || '');
}

function sendIndexPage(res: Response): void {
  res.sendFile(INDEX_PAGE_PATH);
}

export function registerHttpRoutes(app: Express): void {
  app.get('/', (req, res) => {
    if (isAuthenticatedRequest(req)) {
      sendIndexPage(res);
      return;
    }

    res.status(200).send(renderLoginPage());
  });

  app.post('/api/login', async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(401).send(renderLoginPage('Identifiants Linux invalides.'));
      return;
    }

    const serviceCandidates = getPamServiceCandidates();

    if (serviceCandidates.length === 0) {
      res.status(500).send(renderLoginPage('Aucun service PAM local disponible sur la machine.'));
      return;
    }

    let lastError: Error | null = null;
    for (const serviceName of serviceCandidates) {
      try {
        await authenticateLinuxAccount(username, password, serviceName);
        const token = createSession(username);
        setAuthCookie(res, token);
        res.redirect('/');
        return;
      } catch (error) {
        lastError = error as Error;
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
}

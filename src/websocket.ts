import type { IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { isAuthenticatedRequest } from './auth';
import { loadConfig, parseServerProperties } from './config';
import { formatCommand, sendRconCommand } from './rcon';

interface CommandMessage {
  serverId: number;
  command: string;
}

function parseMessage(raw: unknown): CommandMessage {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const parsed = JSON.parse(text) as Partial<CommandMessage>;

  if (typeof parsed.serverId !== 'number' || typeof parsed.command !== 'string') {
    throw new Error('Payload WebSocket invalide.');
  }

  return {
    serverId: parsed.serverId,
    command: parsed.command
  };
}

export function registerWebsocketHandlers(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (!isAuthenticatedRequest(req)) {
      ws.close(1008, 'Authentification requise.');
      return;
    }

    ws.on('message', async (message) => {
      try {
        const { serverId, command } = parseMessage(message);
        const config = loadConfig();
        const srvConfig = config.servers[serverId];

        if (!srvConfig) {
          ws.send(JSON.stringify({ error: 'Serveur non trouve.' }));
          return;
        }

        const props = parseServerProperties(srvConfig.propertiesPath);
        if (!props.password) {
          ws.send(JSON.stringify({ error: 'Mot de passe RCON non defini dans server.properties.' }));
          return;
        }

        const rconCommand = formatCommand(command, config.administrator || 'administrateur');
        const response = await sendRconCommand({
          host: props.host,
          port: props.port,
          password: props.password,
          command: rconCommand
        });

        ws.send(JSON.stringify({ serverId, response }));
      } catch (err) {
        const messageText = err instanceof Error ? err.message : 'Erreur de connexion RCON.';
        ws.send(JSON.stringify({ error: messageText }));
      }
    });
  });
}

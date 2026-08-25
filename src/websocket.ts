import type { IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { isAuthenticatedRequest } from './auth';
import { loadConfig } from './config';
import { Database } from './database';
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
                console.log(`Received WebSocket message: ${message}`);
                const { serverId, command } = parseMessage(message);
                const config = loadConfig();
                const db = Database.getInstance();

                const srvConfig = await db.getServerById(serverId);
                if (!srvConfig) {
                    console.error(`Server with ID ${serverId} not found.`);
                    ws.send(JSON.stringify({ error: 'Server not found.' }));
                    return;
                }

                console.log(`Sending RCON command to server ${srvConfig.name}: ${command}`);

                const rconCommand = formatCommand(command, config.administrator || 'administrator');

                console.log(`Formatted RCON command: ${rconCommand}`);
                const response = await sendRconCommand(
                    srvConfig.host,
                    srvConfig.port,
                    srvConfig.password,
                    rconCommand
                );

                console.log(`RCON response for server ${serverId}: ${response}`);

                ws.send(JSON.stringify({ serverId, response }));
            } catch (err) {
                const messageText = err instanceof Error ? err.message : 'Unknown error';
                ws.send(JSON.stringify({ error: messageText }));
            }
        });
    });
}

import express from 'express';
import process from 'process';
import http from 'http';
import { WebSocketServer } from 'ws';
import { registerHttpRoutes } from './httpRoutes';
import { loadConfig } from './config';
import { registerWebsocketHandlers } from './websocket';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

registerHttpRoutes(app);
registerWebsocketHandlers(wss);

const config = loadConfig();
const port = config.port || 3000;

server.listen(port, () => {
  console.log(`RCON Web Panel running on http://localhost:${port}`);
});

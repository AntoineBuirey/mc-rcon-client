const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { Rcon } = require('rcon-client'); // Changement ici

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const CONFIG_PATH = path.join(__dirname, 'config.json');

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
        return { port: 3000, administrator: 'administrateur', servers: [] };
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

app.get('/api/servers', (req, res) => {
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

wss.on('connection', (ws) => {
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
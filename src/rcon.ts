import { Rcon } from 'rcon-client';

export function formatCommand(command: string, administrator: string): string {
    const trimmedCommand = command.trim();

    if (trimmedCommand.startsWith('/')) {
        return trimmedCommand;
    }

    const tellrawPayload = JSON.stringify(['', { text: `<${administrator}> ` }, { text: trimmedCommand }]);
    return `/tellraw @a ${tellrawPayload}`;
}

export async function sendRconCommand(host: string, port: number, password: string, command: string): Promise<string> {
    const rcon = new Rcon({
        host: host,
        port: port,
        password: password
    });

    console.log(`Connecting to RCON server at ${host}:${port}`);

    try{
        await rcon.connect();
    } catch (error) {
        console.error(`Failed to connect to RCON server at ${host}:${port}:`, error);
        Promise.reject(new Error(`Failed to connect to RCON server at ${host}:${port}: ${error}`));
    }
    console.log(`Connected to RCON server at ${host}:${port}`);
    try {
        return await rcon.send(command);
    } finally {
        await rcon.end();
    }
}

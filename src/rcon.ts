import { Rcon } from 'rcon-client';

export function formatCommand(command: string, administrator: string): string {
  const trimmedCommand = command.trim();

  if (trimmedCommand.startsWith('/')) {
    return trimmedCommand;
  }

  const tellrawPayload = JSON.stringify(['', { text: `<${administrator}> ` }, { text: trimmedCommand }]);
  return `/tellraw @a ${tellrawPayload}`;
}

export async function sendRconCommand(input: {
  host: string;
  port: number;
  password: string;
  command: string;
}): Promise<string> {
  const rcon = new Rcon({
    host: input.host === '0.0.0.0' ? '127.0.0.1' : input.host,
    port: input.port,
    password: input.password
  });

  await rcon.connect();
  try {
    return await rcon.send(input.command);
  } finally {
    await rcon.end();
  }
}

import fs from 'fs';
import { CONFIG_PATH } from './constants';
import type { AppConfig, ParsedRconProperties } from './types';

export function loadConfig(): AppConfig {
  console.log('Loading config.json from:', CONFIG_PATH);

  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(data) as Partial<AppConfig>;
    return {
      port: 3000,
      administrator: 'administrateur',
      servers: [],
      ...config
    };
  } catch (err) {
    console.error('Failed to read config.json:', err);
    return {
      port: 3000,
      administrator: 'administrateur',
      servers: []
    };
  }
}

export function parseServerProperties(filePath: string): ParsedRconProperties {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let rconPort = 25575;
    let rconIp = '127.0.0.1';
    let rconPassword = '';

    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) {
        return;
      }

      const [key, value] = trimmed.split('=', 2);
      const k = key.trim();
      const v = value.trim();

      if (k === 'rcon.port') {
        rconPort = parseInt(v, 10) || 25575;
      }
      if (k === 'rcon.ip' && v !== '') {
        rconIp = v;
      }
      if (k === 'rcon.password') {
        rconPassword = v;
      }
    });

    return { host: rconIp, port: rconPort, password: rconPassword };
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
    return { host: '127.0.0.1', port: 25575, password: '' };
  }
}

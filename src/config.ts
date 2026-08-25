import fs from 'fs';
import type { AppConfig } from './types';
import { configFilePath } from './path';

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
    if (!_config) {
    
        console.log('Loading config.json from:', configFilePath);

        try {
            const data = fs.readFileSync(configFilePath, 'utf8');
            const config = JSON.parse(data) as Partial<AppConfig>;
            _config = {
                port: 3000,
                administrator: 'admin',
                servers: [],
                ...config
            };
        } catch (err) {
            console.error('Failed to read config.json:', err);
            _config = {
                port: 3000,
                administrator: 'admin',
                servers: []
            };
        }
    }
    return _config;
}
import fs from 'fs';
import { CONFIG_FILE_PATH } from './constants';
import type { AppConfig } from './types';

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
    if (!_config) {
    
        console.log('Loading config.json from:', CONFIG_FILE_PATH);

        try {
            const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
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
import sqlite3 from 'sqlite3';
import fs from 'fs';
import { ServerConfig } from './types';
import { dbFilePath } from './path';

export interface DbServerConfig extends ServerConfig {
    id: number;
}

export class Database {
    private db: sqlite3.Database;
    private static instance: Database | null = null;

    public static getInstance(): Database {
        if (!Database.instance) {
            fs.mkdirSync(dbFilePath.substring(0, dbFilePath.lastIndexOf('/')), { recursive: true });
            Database.instance = new Database(dbFilePath);
        }
        return Database.instance;
    }

    private constructor(filename: string) {
        this.db = new sqlite3.Database(filename, (err) => {
            if (err) {
                console.error('Erreur lors de l\'ouverture de la base de données :', err.message);
            } else {
                console.log('Base de données SQLite ouverte avec succès.');
            }
        });
        this.initialize().catch((err) => {
            console.error('Erreur lors de l\'initialisation de la base de données :', err.message);
        });
    }

    private async run(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    private async initialize(): Promise<void> {
        const createServersTableSQL = `
            CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                password TEXT NOT NULL
            );
        `;
    
        await this.run(createServersTableSQL);
    }

    public async addServer(server: ServerConfig): Promise<void> {
        const insertSQL = `
            INSERT INTO servers (name, host, port, password)
            VALUES (?, ?, ?, ?);
        `;
        await this.run(insertSQL, [server.name, server.host, server.port, server.password]);
    }

    public async getServers(): Promise<DbServerConfig[]> {
        return new Promise((resolve, reject) => {
            const selectSQL = `SELECT * FROM servers;`;
            this.db.all(selectSQL, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as DbServerConfig[]);
                }
            });
        });
    }

    public async getServerById(id: number): Promise<DbServerConfig | null> {
        return new Promise((resolve, reject) => {
            const selectSQL = `SELECT * FROM servers WHERE id = ?;`;
            this.db.get(selectSQL, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve(row as DbServerConfig);
                } else {
                    resolve(null);
                }
            });
        });
    }

    public async updateServer(id: number, server: ServerConfig): Promise<void> {
        const updateSQL = `
            UPDATE servers
            SET name = ?, host = ?, port = ?, password = ?
            WHERE id = ?;
        `;
        await this.run(updateSQL, [server.name, server.host, server.port, server.password, id]);
    }

    public async deleteServer(id: number): Promise<void> {
        const deleteSQL = `DELETE FROM servers WHERE id = ?;`;
        await this.run(deleteSQL, [id]);
    }
}

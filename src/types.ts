export interface AuthSession {
  username: string;
  expiresAt: number;
}

export interface ServerConfig {
  name: string;
  host: string;
  port: number;
  password: string;
}

export interface AppConfig {
  port: number;
  administrator: string;
  servers: ServerConfig[];
}

export interface AuthSession {
  username: string;
  expiresAt: number;
}

export interface ServerConfig {
  name: string;
  propertiesPath: string;
}

export interface AppConfig {
  port: number;
  administrator: string;
  servers: ServerConfig[];
}

export interface ParsedRconProperties {
  host: string;
  port: number;
  password: string;
}

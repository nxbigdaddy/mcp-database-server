declare module 'tedious' {
  export interface ColumnMetadata {
    colName: string;
    type?: { name: string };
  }

  export interface Row {
    [key: string]: { value: any };
  }

  export interface ConnectionPoolConfiguration {
    server: string;
    options?: {
      port?: number;
      database?: string;
      encrypt?: boolean;
      trustServerCertificate?: boolean;
      connectTimeout?: number;
      requestTimeout?: number;
    };
    authentication?: {
      type: string;
      options: {
        userName?: string;
        password?: string;
      };
    };
    pool?: {
      min?: number;
      max?: number;
      idleTimeoutMillis?: number;
    };
  }

  export interface TYPES {
    NVarChar: any;
    Int: any;
    BigInt: any;
    Float: any;
    Bit: any;
    DateTime: any;
    Text: any;
    [key: string]: any;
  }

  export const TYPES: TYPES;

  export class Request {
    columns?: ColumnMetadata[];
    constructor(sql: string, callback: (err: Error | null | undefined, rowCount?: number, rows?: Row[]) => void);
    addParameter(name: string, type: any, value: any): void;
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export class ConnectionPool {
    constructor(config: ConnectionPoolConfiguration);
    connect(): Promise<void>;
    close(): Promise<void>;
    execSql(request: Request): void;
    beginTransaction(callback: (err: Error | null | undefined) => void): void;
    commitTransaction(callback: (err: Error | null | undefined) => void): void;
    rollbackTransaction(callback: (err: Error | null | undefined) => void): void;
  }
}

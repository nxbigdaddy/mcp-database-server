declare module 'sql.js' {
  export interface BindParams { [key: string]: any; }
  export interface QueryExecResult { columns: string[]; values: any[][]; }
  export interface StatementIteratorResult {
    done: boolean;
    value: Statement;
  }
  export interface Statement {
    bind(params?: any[]): void;
    bind(params: BindParams): void;
    step(): boolean;
    get(): any[];
    getAsObject(): any;
    getAsObject(params: any[]): any;
    getAsObject(params: BindParams): any;
    run(): void;
    run(params: any[]): void;
    run(params: BindParams): void;
    reset(): void;
    free(): boolean;
  }
  export interface ExecuteOptions {
    callback?: (result: any, columnNames: string[]) => void;
  }
  export interface ExecOptions {
    callback?: (result: any, columnNames: string[]) => void;
  }
  export interface Database {
    run(sql: string, params?: any[]): this;
    exec(sql: string, params?: any[]): QueryExecResult[];
    each(sql: string, params: any[], callback: (row: any[]) => void, done: () => void): number;
    each(sql: string, callback: (row: any[]) => void, done: () => void): number;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    prepare(sql: string, params?: any[]): Statement;
    iterateStatements(sql: string): StatementIterator;
  }
  export interface StatementIterator {
    next(): StatementIteratorResult;
    getRemainingSQL(): string;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}

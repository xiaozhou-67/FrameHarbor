import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.ts';

mkdirSync(dirname(config.databasePath), { recursive: true });
const connection = new DatabaseSync(config.databasePath);
connection.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

export const db = {
  get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return connection.prepare(sql).get(...params) as T | undefined;
  },
  all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return connection.prepare(sql).all(...params) as T[];
  },
  run(sql: string, ...params: SQLInputValue[]) {
    return connection.prepare(sql).run(...params);
  },
  transaction<T>(fn: () => T): T {
    connection.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      connection.exec('COMMIT');
      return result;
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  },
  close() {
    connection.close();
  },
};
export function audit(actorId: number, action: string, target: string, detail = '') {
  db.run(
    'INSERT INTO audit_logs(actor_id,action,target,detail,created_at) VALUES(?,?,?,?,?)',
    actorId,
    action,
    target,
    detail,
    Date.now(),
  );
}

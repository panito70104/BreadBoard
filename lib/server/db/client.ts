/**
 * Postgres connection.
 *
 * One pool per process. In development Next re-evaluates modules on every
 * hot reload, which would open a fresh pool each time and exhaust Postgres'
 * connection limit within minutes — so the pool is parked on `globalThis`.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/server/env";

import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run a query: the pool, or an open transaction. */
export type Executor = Database | Tx;

const globalForDb = globalThis as unknown as {
  breadboardSql?: postgres.Sql;
  breadboardDb?: Database;
};

function connect(): Database {
  const sql = postgres(env().DATABASE_URL, {
    max: 10,
    // Supabase's pooler (transaction mode) rejects prepared statements;
    // turning them off now means the migration needs no code change.
    prepare: false,
  });
  globalForDb.breadboardSql = sql;
  return drizzle(sql, { schema });
}

export function db(): Database {
  if (!globalForDb.breadboardDb) {
    globalForDb.breadboardDb = connect();
  }
  return globalForDb.breadboardDb;
}

/** For scripts that need to exit cleanly. */
export async function closeDb() {
  await globalForDb.breadboardSql?.end({ timeout: 5 });
  globalForDb.breadboardSql = undefined;
  globalForDb.breadboardDb = undefined;
}

export { schema };

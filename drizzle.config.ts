import { defineConfig } from "drizzle-kit";

/**
 * Migrations are plain SQL files under `drizzle/`. They run unchanged on
 * Supabase's Postgres — that is the whole migration story for the schema.
 */
export default defineConfig({
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://breadboard:breadboard@localhost:54322/breadboard",
  },
  strict: true,
  verbose: true,
});

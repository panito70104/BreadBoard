/**
 * Database schema.
 *
 * Written to migrate to Supabase with the least possible change:
 *
 * - `users` holds credentials and is the local stand-in for Supabase's
 *   `auth.users`. On migration it is dropped and Supabase Auth takes over.
 * - `profiles` holds everything the app owns about a person and references
 *   `users.id`. On migration only that foreign key is re-pointed at
 *   `auth.users(id)` — the table itself moves as-is.
 * - Storage keys start with the owner's id, which is the path convention
 *   Supabase Storage policies are written against.
 *
 * Minutes are tracked as a ledger (`usage_events`) rather than a counter: the
 * monthly figure is a SUM over the period, refunds are negative rows, and the
 * history survives for support and billing disputes.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { Storyboard, StoryboardWarning } from "@/types/storyboard";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/*                                 Identity                                   */
/* -------------------------------------------------------------------------- */

/** Local stand-in for Supabase `auth.users`. Replaced on migration. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("users_email_lower_key").on(sql`lower(${table.email})`)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    planId: text("plan_id").notNull().default("free"),
    /** Preselected in the generator; the student can still change them per video. */
    defaultStyle: text("default_style").notNull().default("classic-whiteboard"),
    defaultDurationMinutes: integer("default_duration_minutes").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("profiles_plan_id_check", sql`${table.planId} in ('free', 'student', 'pro')`),
    check(
      "profiles_default_style_check",
      sql`${table.defaultStyle} in ('classic-whiteboard', 'paper-desk', 'color-markers')`,
    ),
    check(
      "profiles_default_duration_check",
      sql`${table.defaultDurationMinutes} in (1, 3, 5)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Content                                   */
/* -------------------------------------------------------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count"),
    /** Object key in the documents bucket: `{ownerId}/{documentId}/{name}`. */
    storageKey: text("storage_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("documents_type_check", sql`${table.type} in ('pdf', 'docx', 'txt')`),
    index("documents_owner_created_idx").on(table.ownerId, table.createdAt.desc()),
  ],
);

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status").notNull().default("generating"),
    /**
     * Where the pipeline is, while `status = 'generating'`. Updated as the
     * worker moves, so the UI shows real progress instead of a timer.
     */
    stage: text("stage").notNull().default("queued"),
    style: text("style").notNull(),
    /** What the student asked for; also what the ledger charged. */
    requestedMinutes: integer("requested_minutes").notNull(),
    /** Actual length of the drawn storyboard. */
    durationSeconds: integer("duration_seconds").notNull().default(0),
    prompt: text("prompt"),
    storyboard: jsonb("storyboard").$type<Storyboard>(),
    warnings: jsonb("warnings").$type<StoryboardWarning[]>(),
    /** Who wrote the storyboard: Claude, or the sample template. */
    source: text("source").notNull().default("claude"),
    /** Something the student should know that is not an error. */
    notice: text("notice"),
    error: text("error"),
    /** Rendered MP4, once server-side rendering exists. */
    videoStorageKey: text("video_storage_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("videos_status_check", sql`${table.status} in ('generating', 'ready', 'failed')`),
    check(
      "videos_stage_check",
      sql`${table.stage} in ('queued', 'reading', 'storyboarding', 'voicing', 'finalizing', 'done')`,
    ),
    check(
      "videos_style_check",
      sql`${table.style} in ('classic-whiteboard', 'paper-desk', 'color-markers')`,
    ),
    check(
      "videos_requested_minutes_check",
      // Minutes held while the video generates, then the minutes it really
      // cost. It used to be the length the student picked, which could only be
      // 1, 3 or 5 — now nobody picks, so it is whatever the plan had left.
      sql`${table.requestedMinutes} > 0`,
    ),
    check("videos_source_check", sql`${table.source} in ('claude', 'mock')`),
    index("videos_owner_created_idx").on(table.ownerId, table.createdAt.desc()),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Billing                                   */
/* -------------------------------------------------------------------------- */

/**
 * Minute ledger. Positive rows consume quota, negative rows refund it.
 * Monthly usage = SUM(minutes) for the owner within the billing period.
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
    minutes: integer("minutes").notNull(),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("usage_events_reason_check", sql`${table.reason} in ('generation', 'refund')`),
    index("usage_events_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type VideoRow = typeof videos.$inferSelect;
export type UsageEventRow = typeof usageEvents.$inferSelect;

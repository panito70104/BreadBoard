/**
 * Accounts: sign-up, login, profile and plan.
 *
 * Credentials live in `users`, everything else in `profiles` — the same split
 * Supabase uses (`auth.users` / `public.profiles`). On migration, `signup` and
 * `login` are replaced by Supabase Auth calls; `updateProfile` and
 * `changePlan` keep working untouched because they only touch `profiles`.
 */

import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  hashPassword,
  PASSWORD_MIN_LENGTH,
  TIMING_DECOY_HASH,
  verifyPassword,
} from "@/lib/server/auth/password";
import type { AuthUser } from "@/lib/server/auth/dal";
import { db, schema } from "@/lib/server/db/client";
import { conflict, unauthorized } from "@/lib/server/http";
import type { PlanId, VideoDurationMinutes, VideoStyle } from "@/types";

import { getPlan, isPlanId } from "./plans";

const email = z
  .string({ message: "Escribe tu correo." })
  .trim()
  .toLowerCase()
  .email("Escribe un correo válido.")
  .max(254);

const name = z
  .string({ message: "Escribe tu nombre." })
  .trim()
  .min(1, "Escribe tu nombre.")
  .max(80, "El nombre es demasiado largo.");

export const signupSchema = z.object({
  name,
  email,
  password: z
    .string({ message: "Escribe una contraseña." })
    .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(200, "La contraseña es demasiado larga."),
});

export const loginSchema = z.object({
  email,
  password: z.string({ message: "Escribe tu contraseña." }).min(1, "Escribe tu contraseña."),
});

export const profileUpdateSchema = z
  .object({
    name: name.optional(),
    defaultStyle: z
      .enum(["classic-whiteboard", "paper-desk", "color-markers"], {
        message: "Estilo no válido.",
      })
      .optional(),
    defaultDurationMinutes: z
      .number()
      .refine((value) => [1, 3, 5].includes(value), "La duración debe ser 1, 3 o 5 minutos.")
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No hay nada que actualizar.",
  });

function toAuthUser(row: {
  id: string;
  email: string;
  name: string;
  planId: string;
  createdAt: Date;
  defaultStyle: string;
  defaultDurationMinutes: number;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    planId: row.planId as PlanId,
    createdAt: row.createdAt,
    preferences: {
      defaultStyle: row.defaultStyle as VideoStyle,
      defaultDurationMinutes: row.defaultDurationMinutes as VideoDurationMinutes,
    },
  };
}

/** Postgres unique violation, whether or not the driver error was wrapped. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code
    ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

export async function signup(input: unknown): Promise<AuthUser> {
  const data = signupSchema.parse(input);
  const passwordHash = await hashPassword(data.password);

  try {
    return await db().transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ email: data.email, passwordHash })
        .returning({ id: schema.users.id, email: schema.users.email });

      const [profile] = await tx
        .insert(schema.profiles)
        .values({ id: user.id, name: data.name })
        .returning();

      return toAuthUser({ ...profile, email: user.email });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Ya existe una cuenta con ese correo. Inicia sesión.", "email_taken");
    }
    throw error;
  }
}

export async function login(input: unknown): Promise<AuthUser> {
  const data = loginSchema.parse(input);

  const [row] = await db()
    .select({
      id: schema.users.id,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash,
      name: schema.profiles.name,
      planId: schema.profiles.planId,
      createdAt: schema.profiles.createdAt,
      defaultStyle: schema.profiles.defaultStyle,
      defaultDurationMinutes: schema.profiles.defaultDurationMinutes,
    })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(sql`lower(${schema.users.email}) = ${data.email}`)
    .limit(1);

  // Always run the comparison, so an unknown email is as slow as a wrong
  // password and response time does not reveal who has an account.
  const valid = await verifyPassword(data.password, row?.passwordHash ?? TIMING_DECOY_HASH);
  if (!row || !valid) {
    throw unauthorized("Correo o contraseña incorrectos.");
  }

  return toAuthUser(row);
}

export async function updateProfile(userId: string, input: unknown) {
  const data = profileUpdateSchema.parse(input);
  const [profile] = await db()
    .update(schema.profiles)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.defaultStyle !== undefined && { defaultStyle: data.defaultStyle }),
      ...(data.defaultDurationMinutes !== undefined && {
        defaultDurationMinutes: data.defaultDurationMinutes,
      }),
    })
    .where(eq(schema.profiles.id, userId))
    .returning();
  return profile;
}

/**
 * Switches plans immediately.
 * TODO(payments): only call this from Recurrente's webhook, after the payment
 * is confirmed. Today the mock checkout calls it directly.
 */
export async function changePlan(userId: string, planId: unknown) {
  if (!isPlanId(planId)) {
    throw conflict("Ese plan no existe.", "unknown_plan");
  }
  getPlan(planId);
  const [profile] = await db()
    .update(schema.profiles)
    .set({ planId })
    .where(eq(schema.profiles.id, userId))
    .returning();
  return profile;
}

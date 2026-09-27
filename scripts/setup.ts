/**
 * One command from empty containers to a working app:
 *
 *   npm run setup
 *
 * 1. Applies every SQL migration in `drizzle/` (idempotent).
 * 2. Creates the storage buckets if missing.
 * 3. Creates the demo account if missing.
 *
 * Safe to re-run at any time.
 */

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { hashPassword } from "@/lib/server/auth/password";
import { closeDb, db, schema } from "@/lib/server/db/client";
import { ensureBuckets } from "@/lib/server/storage";

export const DEMO_EMAIL = "demo@breadboard.ai";
export const DEMO_PASSWORD = "breadboard-demo";

async function main() {
  console.log("→ Aplicando migraciones…");
  await migrate(db(), { migrationsFolder: "./drizzle" });

  console.log("→ Preparando almacenamiento…");
  const created = await ensureBuckets();
  console.log(
    created.length ? `  buckets creados: ${created.join(", ")}` : "  buckets ya existían",
  );

  console.log("→ Cuenta demo…");
  const [existing] = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${DEMO_EMAIL}`)
    .limit(1);

  if (existing) {
    console.log(`  ya existe: ${DEMO_EMAIL}`);
  } else {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    await db().transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ email: DEMO_EMAIL, passwordHash })
        .returning({ id: schema.users.id });
      await tx.insert(schema.profiles).values({ id: user.id, name: "Cuenta Demo", planId: "student" });
    });
    console.log(`  creada: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (plan Student)`);
  }

  const [{ count }] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users);
  console.log(`\n✓ Listo. Usuarios en la base: ${count}`);
}

main()
  .catch((error) => {
    console.error("\n✗ Setup falló:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);

# Migración a Supabase

Plan para mover BreadBoardAI de los contenedores locales a Supabase. Está escrito
para revisarse antes de empezar; los pasos de SQL se escriben y prueban durante la
migración, contra el proyecto real, con el MCP de Supabase.

## Qué cambia y qué no

La app se construyó para que esto fuera sobre todo configuración:

| Pieza                    | Local hoy                 | En Supabase                  | Esfuerzo |
| ------------------------ | ------------------------- | ---------------------------- | -------- |
| Base de datos            | Postgres 17 en Docker     | Postgres de Supabase         | Cambiar `DATABASE_URL` |
| Esquema                  | `drizzle/*.sql`           | Los mismos archivos          | Aplicar, menos `users` |
| Almacenamiento           | RustFS (S3)               | Supabase Storage (S3)        | Cambiar endpoint y claves |
| Autenticación            | JWT propio + bcrypt       | Supabase Auth                | **El único cambio de código real** |
| Lógica de negocio        | `lib/server/services/`    | Igual                        | Ninguno |
| Frontend                 | `lib/api.ts`              | Igual                        | Ninguno |

## Pasos

### 1. Base de datos

1. Aplicar `drizzle/0000_init.sql` y `drizzle/0001_profile_preferences.sql`
   **sin** la tabla `users` — Supabase ya tiene `auth.users`.
2. Re-apuntar la clave foránea: `profiles.id` → `auth.users(id) on delete cascade`.
3. Trigger que cree el `profile` cuando alguien se registra en Supabase Auth
   (el nombre llega en `raw_user_meta_data`).
4. Activar **Row Level Security** en `profiles`, `documents`, `videos` y
   `usage_events`, con políticas `owner_id = auth.uid()` (`id = auth.uid()` en
   `profiles`). El servidor ya filtra por dueño en cada consulta; RLS es la segunda
   barrera, a nivel de base.
5. `DATABASE_URL` → el pooler de Supabase en modo transacción. El cliente ya tiene
   `prepare: false`, que es lo que ese modo exige.

### 2. Almacenamiento

1. Crear los buckets privados `documents` y `videos`.
2. Políticas de Storage: cada usuario solo lee y escribe bajo su carpeta. Las claves
   ya siguen esa convención (`{ownerId}/{recordId}/{archivo}`), así que la política
   es `(storage.foldername(name))[1] = auth.uid()::text`.
3. Variables `S3_*` → el endpoint S3 de Supabase Storage y sus claves de acceso.
   `lib/server/storage/index.ts` no cambia.

### 3. Autenticación

Lo que se sustituye:

| Archivo                         | Pasa a                                        |
| ------------------------------- | --------------------------------------------- |
| `lib/server/auth/session.ts`    | Sesión de `@supabase/ssr`                     |
| `lib/server/auth/password.ts`   | Se elimina — Supabase guarda las contraseñas  |
| `lib/server/auth/cookies.ts`    | Se elimina — `@supabase/ssr` gestiona cookies |
| `signup` / `login` en `accounts.ts` | `supabase.auth.signUp` / `signInWithPassword` |
| `proxy.ts`                      | Refresco de sesión de `@supabase/ssr`         |
| `rate-limit.ts` en auth         | Se elimina — Supabase Auth ya limita          |

Lo que **no** cambia: `dal.ts` sigue devolviendo el mismo `AuthUser` (solo cambia
de dónde lee el id), y todo lo que depende de `requireUser()` —cada ruta y cada
servicio— sigue igual.

Lo que se gana: recuperar contraseña, verificar correo y login con Google llegan
sin escribirlos.

### 4. Datos existentes

Si hay usuarios reales en local para entonces, sus contraseñas no se pueden mover
(bcrypt local ≠ Supabase). Tendrían que restablecerla una vez. Si solo existe la
cuenta demo, se omite este paso.

### 5. Verificación

Las mismas pruebas que se hicieron en local, contra Supabase: registro, login,
aislamiento entre usuarios (404 en lo ajeno), reserva concurrente de minutos,
reembolso al fallar, descarga firmada, borrado en cascada.

## Antes de producción

No depende de Supabase pero conviene tenerlo al lanzar:

- **Cola de trabajos.** La generación corre con `after()` en el mismo proceso. Un
  deploy a mitad la corta; `reapStaleGenerations` la marca fallida y reembolsa a
  los 10 minutos, pero con tráfico real conviene una cola (pg-boss funciona sobre
  el mismo Postgres de Supabase).
- **`AUTH_SECRET` propio** si se despliega antes de migrar la autenticación.

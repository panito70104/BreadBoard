# BreadBoardAI

Convierte PDFs, libros y apuntes en videos explicativos estilo whiteboard: una
mano dibuja en una pizarra mientras el contenido se explica escena por escena.

## Arranque

Necesitas Docker y Node 22.

```bash
npm install
cp .env.example .env.local      # y genera AUTH_SECRET (instrucciones dentro)
npm run infra:up                # Postgres + almacenamiento S3 en Docker
npm run setup                   # migraciones, buckets y cuenta demo
npm run dev                     # http://localhost:3000
```

**Cuenta demo**: `demo@breadboard.ai` / `breadboard-demo` (plan Student).

**Para que Claude lea tus documentos**, añade `ANTHROPIC_API_KEY` a `.env.local` y
reinicia `npm run dev`. Sin clave todo funciona igual, pero el guion sale de una
plantilla y la app lo avisa en pantalla.

**Para que los videos hablen**, añade `ELEVENLABS_API_KEY`. No hace falta nada
más: la voz se elige sola según el idioma del guion. Comprueba que la clave
funciona con `npm run voices`, que lista las voces de tu cuenta; si prefieres
una en concreto, ponla en `ELEVENLABS_VOICE_ID`. Sin clave el video se genera
mudo y lo avisa.

| Servicio           | Dirección                          |
| ------------------ | ---------------------------------- |
| App                | http://localhost:3000              |
| Postgres           | `localhost:54322` (user/pass `breadboard`) |
| Almacenamiento S3  | http://localhost:59000             |
| Consola de archivos| http://localhost:59001 (`breadboard` / `breadboard-secret`) |
| Explorar la base   | `npm run db:studio`                |

## Scripts

| Script             | Qué hace                                                  |
| ------------------ | --------------------------------------------------------- |
| `infra:up` / `infra:down` | Arranca / detiene los contenedores                 |
| `setup`            | Aplica migraciones, crea buckets y la cuenta demo. Idempotente |
| `db:generate`      | Genera una migración SQL tras cambiar `lib/server/db/schema.ts` |
| `db:studio`        | Explorador visual de la base de datos                     |
| `icons:extract`    | Regenera `data/icon-paths.ts` tras cambiar el vocabulario de iconos |
| `voices`           | Lista las voces de tu cuenta de ElevenLabs (y comprueba la clave) |
| `engine:verify`    | Corre el motor sin navegador y comprueba sus invariantes  |
| `voice:verify`     | Comprueba el alineador de frases contra los tiempos de voz |
| `typecheck` / `lint` / `build` | Verificación                                  |

## Arquitectura

```
Navegador ── proxy.ts ──► páginas (app/)
   │          (chequeo optimista de sesión, sin base de datos)
   │
   └── lib/api.ts ──► app/api/* ──► lib/server/services/* ──► Postgres
                       (route())     (lógica de negocio)   └► S3
                                            │
                                            └► Claude (después de responder)
```

**Frontend.** Los componentes solo hablan con `lib/api.ts`. El usuario llega
desde el servidor en el primer render (sin parpadeo de carga) y la lista de
videos sondea mientras algo se está generando.

**Backend.** Cada ruta de `app/api/` es delgada: verifica al usuario con
`requireUser()`, delega en un servicio y devuelve JSON. Los errores se lanzan como
`HttpError` y `route()` los convierte en `{ error, code }` con el status correcto,
así que el cliente nunca adivina la forma de un fallo.

```
lib/server/
  env.ts               Variables de entorno validadas al arrancar
  http.ts              Errores tipados + envoltorio de rutas
  rate-limit.ts        Límite de intentos (login, registro)
  auth/
    session.ts         JWT en cookie httpOnly (lo usa también proxy.ts)
    password.ts        bcrypt + hash señuelo contra enumeración por tiempo
    cookies.ts         Crear / borrar la cookie de sesión
    dal.ts             Data Access Layer: quién llama, contra la base
  db/
    schema.ts          Esquema (Drizzle) → migraciones SQL en drizzle/
    client.ts          Pool de Postgres
  storage/index.ts     Cliente S3 (RustFS local, Supabase Storage después)
  services/
    accounts.ts        Registro, login, perfil, plan
    plans.ts           Catálogo de planes y periodos de facturación
    usage.ts           Libro de minutos: reservar, reembolsar, cuota
    documents.ts       Documentos: bytes en S3, metadatos en Postgres
    videos.ts          Consultas de videos, siempre filtradas por dueño
    generation.ts      El pipeline completo
    storyboard-provider.ts  Claude o plantilla
```

### Base de datos

| Tabla          | Contenido                                                     |
| -------------- | ------------------------------------------------------------- |
| `users`        | Credenciales. Equivale a `auth.users` de Supabase             |
| `profiles`     | Nombre, plan y preferencias. Referencia a `users`             |
| `documents`    | Metadatos del archivo; los bytes viven en el bucket `documents` |
| `videos`       | Estado, etapa del pipeline y el storyboard (JSONB)            |
| `usage_events` | Libro de minutos: filas positivas cobran, negativas reembolsan |

Las migraciones son SQL plano en `drizzle/` y corren sin cambios en Supabase.

## Reglas de negocio

**Se cobra por minuto, no por video.** Free: 3 min/mes y videos de hasta 1 min.
Student: 30 min y hasta 3 min. Pro: 70 min y hasta 5 min.

**Los minutos se reservan al pedir el video**, dentro de la misma transacción que
lo crea y con un bloqueo sobre la fila del perfil. Dos pestañas pidiendo a la vez
no pueden gastar más de lo disponible: la segunda espera y ve el total nuevo.
(Probado: 3 peticiones simultáneas con 2 min disponibles → exactamente 2 pasan.)

**Si la generación falla, se reembolsa.** Documento ilegible, error de Claude o
servidor reiniciado a mitad: el video queda en `failed` y se escribe una fila
negativa. El estudiante nunca paga un video que no recibió.

**El video dura lo que se pagó.** Si pides 3 min y el modelo planea 4, las escenas
se ajustan a 3.

**Borrar no reembolsa**: ese video sí se generó. **Regenerar cobra de nuevo**:
vuelve a llamar a Claude.

Los minutos se renuevan el día 1 de cada mes (UTC).

## Seguridad

- **Sesión**: JWT firmado en cookie `httpOnly` + `SameSite=Lax`. JavaScript no puede
  leerla. En producción también `Secure`.
- **Autorización**: `proxy.ts` solo redirige rápido; la comprobación real está en
  el DAL y en el layout de la app, contra la base de datos.
- **Aislamiento**: cada consulta filtra por dueño. Un video ajeno responde 404, no
  403, para que no se pueda sondear qué existe.
- **Login**: mismo mensaje y mismo tiempo de respuesta para "correo inexistente" y
  "contraseña incorrecta" (~0,22 s ambos), para no revelar qué correos existen.
- **CSRF**: toda petición que modifica algo se rechaza si viene de otro sitio
  (`Origin` / `Sec-Fetch-Site`), y los cuerpos JSON exigen
  `content-type: application/json`, que un formulario HTML no puede enviar.
- **Límites de peticiones** (ventana deslizante, en `lib/server/rate-limit.ts`):

  | Qué                  | Límite            | Por                               |
  | -------------------- | ----------------- | --------------------------------- |
  | Login fallido        | 10 cada 30 min    | IP (solo cuentan los fallos)      |
  | Registro             | 5 por hora        | IP                                |
  | Generar / regenerar  | 10 cada 10 min    | usuario                           |
  | Cualquier petición a la API | 300 por minuto | usuario con sesión, o IP sin ella |

  Al pasarse se responde `429` con `Retry-After`. La IP sale de la **última**
  entrada de `X-Forwarded-For` (la que añade tu proxy; la primera la escribe el
  cliente y se puede falsificar). Por eso la app debe desplegarse detrás de un
  proxy: Vercel funciona sin configurar nada. Los contadores viven en memoria —
  con varias instancias hay que moverlos a Postgres o Redis.
- **Archivos**: buckets privados. Las descargas pasan por una URL firmada de 5 min
  emitida tras comprobar que eres el dueño.
- **Redirección tras login**: solo rutas internas; `?next=https://…` se ignora.

## La voz

El guion declara su `language` (el del documento, salvo que el estudiante pida
otro — entonces Claude lo traduce entero). Con eso, cada escena se sintetiza en
ElevenLabs por el endpoint `with-timestamps`, que además del mp3 devuelve el
segundo en el que se pronuncia **cada carácter**.

Ahí está el valor: cada paso del storyboard declara `on`, una frase literal de
la narración, y `lib/server/voice/align.ts` la busca en esos tiempos para
escribir `at` — el segundo exacto en el que cae el dibujo. Sin voz, el motor
estima por la posición de la frase en el texto y el video sigue funcionando.

La duración de una escena deja de ser una estimación y pasa a ser lo que dura
la frase dicha, más un respiro.

## El storyboard: el contrato del motor

Claude produce un JSON, el motor de Remotion lo dibuja. Dos reglas lo sostienen:

- **El modelo no elige coordenadas.** Elige un `layout` y mete cada elemento en un
  `slot` con nombre. La geometría vive en `lib/storyboard/layouts.ts`.
- **El modelo no elige tiempos.** Cada paso lleva `on`: la frase literal de la
  narración que lo dispara.

Claude responde con **salidas estructuradas** (`lib/storyboard/generate.ts`), así
que no puede devolver un layout inexistente ni un icono fuera del vocabulario.
Después `parseStoryboard()` repara lo que ningún esquema puede expresar —un slot
que ese layout no tiene, una frase que no está en la narración— y registra cada
arreglo como `warning` en el video. Revisa esos avisos: son la mejor señal de cómo
rinde el prompt con documentos reales.

```
types/storyboard.ts     El contrato
lib/storyboard/         layouts, iconos, validación, prompt y llamada a Claude
lib/engine/             Motor de dibujo: timeline, texto, geometría, Rough.js
components/engine/      Composición de Remotion y la mano
```

## Pendiente

| Qué                       | Por qué                                            |
| ------------------------- | -------------------------------------------------- |
| Exportar a MP4            | Necesita Remotion renderizando en un servidor      |
| Elegir voz desde la app   | Hoy se elige sola por idioma; falta el selector, como el de la mano |
| Pagos (Recurrente)        | El cambio de plan hoy es inmediato y sin cobro     |
| Recuperar contraseña      | Necesita envío de correo — lo trae Supabase Auth   |
| Verificar correo          | Igual, viene con Supabase Auth                     |
| Compartir con otros       | El enlace hoy solo lo abre el dueño                |
| Cola de trabajos          | La generación corre con `after()` en el mismo proceso; ver `lib/server/services/generation.ts` |
| Rate limit distribuido    | En memoria: vale para un servidor, no para varios  |

La migración a Supabase está planificada en [MIGRATION-SUPABASE.md](MIGRATION-SUPABASE.md).

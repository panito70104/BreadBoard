# BreadBoardAI

Convierte PDFs, libros y apuntes en videos explicativos estilo whiteboard.

Esta es la **primera versión del frontend**: la landing vende el producto y el
dashboard ya se usa como una app real. **No hay backend.** Todo funciona con
datos mock y latencia simulada, pero la arquitectura está pensada para que
conectar el backend sea cambiar una rama dentro de `lib/api.ts`.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript en modo estricto
- Tailwind CSS v4 (tokens de diseño en `app/globals.css`)
- `lucide-react` para iconos

## Arranque

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run lint     # ESLint
npm run typecheck
```

## Rutas

| Ruta                | Qué es                                                         |
| ------------------- | -------------------------------------------------------------- |
| `/`                 | Landing pública: hero, cómo funciona, beneficios, precios, FAQ  |
| `/login`            | Login visual (sin auth real), redirige al dashboard             |
| `/signup`           | Alta de cuenta mock                                             |
| `/forgot-password`  | Recuperación de contraseña mock                                 |
| `/dashboard`        | Subida de documento + generación mock + videos recientes        |
| `/videos`           | Biblioteca con filtros por estado                               |
| `/videos/[id]`      | Player mock, metadatos, acciones y storyboard por escenas       |
| `/billing`          | Plan actual, consumo, facturas y cambio de plan                 |
| `/settings`         | Perfil, preferencias de generación e integraciones pendientes   |

## Estructura

```
app/
  (app)/            Rutas con sesión: dashboard, videos, billing, settings
  login|signup|forgot-password/
  layout.tsx        Fuentes, metadata y providers
  globals.css       Tokens de diseño y utilidades (bg-grid, font-hand, …)
components/
  landing/          Secciones de la landing
  dashboard/        Sidebar, shell, cards, headers
  upload/           Dropzone, selectores, progreso y resultado
  pricing/          Card y grid de planes (landing + billing)
  video/            Player mock, storyboard y acciones
  ui/               Primitivas: Button, Card, Badge, Input, Progress, …
  auth/             Shell y formularios de autenticación
app/api/
  storyboard/       POST: documento -> texto -> Claude -> storyboard
lib/
  api.ts            Capa de API mock — el único punto a reemplazar
  documents/        Extracción de texto de PDF, DOCX y TXT (servidor)
  engine/           Motor de dibujo: timeline, geometría, texto, Rough.js
  http.ts           Cliente fetch listo para el backend real
  storyboard/       Contrato de render: layouts, iconos, validador y prompt
  config.ts         Feature flags, integraciones y límites
  auth-context.tsx  Sesión mock en localStorage
  video-store.tsx   Estado compartido de videos (sidebar + páginas)
  utils.ts          cn(), formateo de fechas, tamaños y duraciones
data/
  mock.ts           Catálogo: planes, estilos, duraciones, pipeline y storyboard
  landing.ts        Copy de la landing
  navigation.ts     Items del sidebar
types/
  index.ts          User, Video, Document, SubscriptionPlan, GenerationStatus…
  storyboard.ts     El contrato de render (ver más abajo)
```

## El storyboard: el contrato del motor

Es la pieza central de la arquitectura. Claude produce un JSON, el motor de
Remotion lo dibuja, y nadie más necesita ponerse de acuerdo. Dos reglas lo
sostienen:

- **El modelo no elige coordenadas.** Elige un `layout` y mete cada elemento en
  un `slot` con nombre. La geometría vive en `lib/storyboard/layouts.ts`, así que
  una escena siempre queda compuesta aunque el modelo se equivoque.
- **El modelo no elige tiempos.** Cada paso lleva `on`: la frase literal de la
  narración que lo dispara. El motor la busca en los timings de palabra que
  devuelve ElevenLabs y dibuja ahí.

```
types/storyboard.ts       El contrato: elementos, slots, layouts, escenas
lib/storyboard/
  layouts.ts              Geometría de los 8 layouts (coordenadas 0–1)
  icons.ts                Vocabulario cerrado de iconos dibujables
  schema.ts               Validación Zod + reparación con avisos
  prompt.ts               El prompt, generado desde los archivos de arriba
  generate.ts             La llamada a Claude con salidas estructuradas
```

Nueve tipos de elemento cubren todo: `title`, `text`, `bullet`, `icon`, `arrow`,
`emphasis`, `diagram`, `formula` y `erase`.

### Validación que repara en vez de rechazar

`parseStoryboard()` nunca falla por un error semántico. Un layout inexistente cae
al de por defecto, un slot que el layout no tiene se remapea, un icono fuera del
vocabulario se sustituye, una frase que no está en la narración deja el paso con
timing proporcional. Cada arreglo emite un `StoryboardWarning`:

```ts
const { storyboard, warnings, clean } = parseStoryboard(modelOutput);
```

**Manda esos `warnings` a tus logs.** Son la señal más directa de qué tan bien
está funcionando el prompt con documentos reales, y de qué iconos hay que añadir
al vocabulario.

### Los dibujos

El vocabulario son ~147 nombres de `lucide-react`, que ya es dependencia del
proyecto: SVG de puro trazo, sin rellenos, que se animan bien cuando la mano los
dibuja. Pásalos por Rough.js en el render para el temblor de hecho a mano. La
lista es cerrada a propósito: el modelo no puede pedir algo que el motor no sepa
dibujar.

## Probar con un PDF de verdad

Sin clave, el dashboard genera un guion de ejemplo y te lo dice con un aviso.
Con clave, Claude lee tu documento:

```bash
cp .env.example .env.local
# pega tu clave de https://console.anthropic.com
npm run dev
```

Luego sube un PDF, DOCX o TXT en el dashboard. La ruta `POST /api/storyboard`
extrae el texto en el servidor, se lo pasa a Claude y devuelve un storyboard que
el motor dibuja de inmediato. El archivo no se guarda en ningún sitio: entra en
la petición y sale el guion.

**Coste aproximado**: unos $0.20–0.30 por video con `claude-opus-5`. El prompt de
sistema va cacheado, así que el grueso es el documento.

**Documentos largos**: se analizan hasta 180.000 caracteres (~45.000 tokens) y se
corta en un límite de página. Cuando pasa, la interfaz te dice cuántas páginas
entraron en vez de recortar en silencio.

**PDFs escaneados**: si el documento son imágenes sin capa de texto, se rechaza
antes de llamar a Claude — haría falta OCR, que todavía no está.

## Cómo se conecta el backend

Ningún componente sabe de dónde vienen los datos: todos pasan por `lib/api.ts`.
Cada función mock ya tiene el `TODO(backend)` con el endpoint previsto.

```ts
// lib/api.ts — antes
export async function getVideosMock(): Promise<Video[]> {
  await sleep(MOCK_LATENCY.normal);
  return clone(videoStore);
}

// después
export async function getVideos(): Promise<Video[]> {
  return apiFetch<Video[]>("/videos");
}
```

Los nombres sin sufijo (`getVideos`, `login`, `uploadDocument`, …) ya se exportan
como alias al final de `lib/api.ts`, así que la app importa el nombre definitivo
desde hoy y el renombrado no toca ningún componente.

| Área        | Proveedor previsto  | Punto de entrada                      |
| ----------- | ------------------- | ------------------------------------- |
| Auth        | JWT / NextAuth      | `lib/auth-context.tsx`, `api.login`   |
| Storage     | S3 / Cloudflare R2  | `api.uploadDocument`                  |
| Storyboard  | Claude API          | `lib/storyboard/generate.ts`           |
| Voz         | ElevenLabs          | `api.createGenerationJob`             |
| Render      | Remotion            | `api.createGenerationJob`             |
| Pagos       | Recurrente          | `api.createCheckoutSession`           |

Los flags de `lib/config.ts` (`features.realAuth`, `features.realRendering`, …)
están pensados para activar cada área por separado sin tocar la UI.

## Planes

El cobro es **por minuto de video generado**, no por archivo subido:

| Plan    | Precio   | Incluye           | Máximo por video |
| ------- | -------- | ----------------- | ---------------- |
| Free    | $0 / mes | 3 minutos al mes  | 1 min            |
| Student | $25 / mes| 30 minutos al mes | 3 min            |
| Pro     | $50 / mes| 70 minutos al mes | 5 min            |

Los planes viven en `data/mock.ts` y el tipo es `SubscriptionPlan`
(`minutesPerMonth` es la cuota mensual; `maxDurationMinutes`, el tope por video).
El consumo del usuario se mide en `User.minutesUsed` / `minutesLimit`.

## Qué es mock hoy

La app **arranca vacía**: no hay usuario, documentos ni videos de ejemplo. Lo
único precargado es el catálogo del producto (planes, estilos, duraciones, los
cinco pasos de generación y el esqueleto de storyboard).

- Login, signup y recuperación de contraseña: validan formato y guardan una
  sesión falsa en `localStorage`. La cuenta se deriva del correo que escribas y
  empieza en el plan Free.
- Subida: el archivo viaja a `/api/storyboard` si hay clave; si no, no sale del
  navegador y se usa el guion de ejemplo.
- Generación: **real cuando hay clave** — Claude lee el documento. Sin clave,
  recorre los cinco pasos con delays y devuelve el storyboard de plantilla.
- Player: **real**. Remotion dibuja el storyboard en el navegador, con la mano
  siguiendo el trazo. Lo que falta es exportarlo a MP4 y la voz.
- Pagos: `Download`, `Share` y el checkout solo muestran confirmación visual;
  no hay facturas hasta que Recurrente esté conectado.

/**
 * Product catalog for BreadBoardAI.
 *
 * No sample users, documents or videos live here: the app starts empty and
 * fills up from what the student actually uploads. What remains is the catalog
 * the product is built on — plans, styles, durations and the generation
 * pipeline — plus the storyboard skeleton every generated video follows.
 *
 * `lib/api.ts` is the only module that imports this, so swapping in a real
 * backend means changing one file.
 */

import type {
  GenerationStep,
  SceneLayout,
  StoryboardScene,
  StoryboardStep,
  SubscriptionPlan,
  VideoDurationOption,
  VideoStyleOption,
} from "@/types";

/* -------------------------------------------------------------------------- */
/*                                 Storyboard                                 */
/* -------------------------------------------------------------------------- */

/**
 * The four-scene skeleton every generated video follows.
 *
 * Shaped exactly like what Claude is asked to return, so the UI and the engine
 * exercise the real contract long before the model is wired up.
 * @see `lib/storyboard/prompt.ts`
 */
const storyboardTemplate: Array<{
  title: string;
  layout: SceneLayout;
  durationSeconds: number;
  summary: (topic: string) => string;
  narration: (topic: string) => string;
  steps: (topic: string) => StoryboardStep[];
}> = [
  {
    title: "Scene 1: Intro",
    layout: "title-only",
    durationSeconds: 24,
    summary: (topic) => `Presentación del tema y por qué importa: ${topic}.`,
    narration: (topic) =>
      `Hoy vamos a entender ${topic}. Empecemos por la idea más importante y construyamos desde ahí.`,
    steps: (topic) => [
      { on: `Hoy vamos a entender ${topic}`, draw: { type: "title", text: topic } },
      {
        on: "la idea más importante",
        draw: { type: "emphasis", shape: "underline", target: "title", color: "amber" },
      },
      {
        on: "construyamos desde ahí",
        draw: { type: "icon", slot: "center", id: "Lightbulb" },
      },
    ],
  },
  {
    title: "Scene 2: Main concept",
    layout: "visual-left-bullets-right",
    durationSeconds: 62,
    summary: () => "El concepto principal desglosado en partes simples.",
    narration: () =>
      "Este es el concepto central. Fíjate en cómo cada parte se conecta con la siguiente: primero la definición, luego el mecanismo y al final para qué sirve.",
    steps: () => [
      { on: "Este es el concepto central", draw: { type: "title", text: "El concepto" } },
      {
        on: "Fíjate en cómo cada parte",
        draw: { type: "icon", slot: "visual", id: "Puzzle", scale: 1.2 },
      },
      { on: "se conecta con la siguiente", draw: { type: "arrow", from: "visual", to: "list" } },
      {
        on: "primero la definición",
        draw: { type: "bullet", slot: "list", text: "Qué es", marker: "number" },
      },
      {
        on: "luego el mecanismo",
        draw: { type: "bullet", slot: "list", text: "Cómo funciona", marker: "number" },
      },
      {
        on: "para qué sirve",
        draw: { type: "bullet", slot: "list", text: "Para qué sirve", marker: "number" },
      },
    ],
  },
  {
    title: "Scene 3: Example",
    layout: "formula-steps",
    durationSeconds: 58,
    summary: () => "Un ejemplo concreto resuelto paso a paso.",
    narration: () =>
      "Veámoslo con un ejemplo. Resolvemos paso a paso para que puedas repetir el mismo razonamiento en tu examen.",
    steps: () => [
      { on: "Veámoslo con un ejemplo", draw: { type: "title", text: "Un ejemplo" } },
      {
        on: "Resolvemos paso a paso",
        draw: { type: "bullet", slot: "list", text: "Identifica los datos", marker: "arrow" },
      },
      {
        on: "el mismo razonamiento",
        draw: { type: "bullet", slot: "list", text: "Aplica la regla", marker: "arrow" },
      },
      {
        on: "en tu examen",
        draw: { type: "bullet", slot: "list", text: "Comprueba el resultado", marker: "check" },
      },
    ],
  },
  {
    title: "Scene 4: Summary",
    layout: "summary-box",
    durationSeconds: 36,
    summary: () => "Resumen en tres ideas que deberías recordar.",
    narration: () =>
      "Para cerrar: quédate con estas tres ideas. Si las recuerdas, tienes el tema resuelto.",
    steps: () => [
      { on: "Para cerrar", draw: { type: "title", text: "Para recordar" } },
      {
        on: "estas tres ideas",
        draw: { type: "bullet", slot: "list", text: "La definición", marker: "check" },
      },
      {
        on: "estas tres ideas",
        draw: { type: "bullet", slot: "list", text: "El mecanismo", marker: "check" },
      },
      {
        on: "Si las recuerdas",
        draw: { type: "bullet", slot: "list", text: "Un ejemplo propio", marker: "check" },
      },
      {
        on: "tienes el tema resuelto",
        draw: { type: "emphasis", shape: "box", target: "list", color: "green" },
      },
    ],
  },
];

export function buildStoryboard(topic: string, idPrefix: string): StoryboardScene[] {
  return storyboardTemplate.map((scene, position) => ({
    id: `${idPrefix}_scene_${position + 1}`,
    index: position + 1,
    title: scene.title,
    summary: scene.summary(topic),
    narration: scene.narration(topic),
    layout: scene.layout,
    steps: scene.steps(topic),
    durationSeconds: scene.durationSeconds,
  }));
}

/* -------------------------------------------------------------------------- */
/*                              Generation steps                              */
/* -------------------------------------------------------------------------- */

/** Pipeline shown while a video is produced. Order matters. */
export const generationSteps: GenerationStep[] = [
  {
    id: "uploading",
    label: "Subiendo documento",
    description: "Guardamos tu archivo de forma segura.",
    state: "pending",
  },
  {
    id: "reading",
    label: "Leyendo contenido",
    description: "Extraemos el texto y detectamos los temas clave.",
    state: "pending",
  },
  {
    id: "storyboarding",
    label: "Creando storyboard",
    description: "Dividimos la explicación en escenas con narración.",
    state: "pending",
  },
  {
    id: "rendering",
    label: "Generando video whiteboard",
    description: "Dibujamos escena por escena y sincronizamos la voz.",
    state: "pending",
  },
  {
    id: "ready",
    label: "Video listo",
    description: "Tu explicación visual está lista para estudiar.",
    state: "pending",
  },
];

/* -------------------------------------------------------------------------- */
/*                             Generation options                             */
/* -------------------------------------------------------------------------- */

export const videoStyles: VideoStyleOption[] = [
  {
    id: "classic-whiteboard",
    label: "Classic whiteboard",
    description: "Pizarra blanca, marcador negro. Limpio y directo.",
    swatch: ["#ffffff", "#0c1222", "#6366f1"],
  },
  {
    id: "paper-desk",
    label: "Paper desk",
    description: "Cuaderno sobre escritorio, estilo apuntes.",
    swatch: ["#fdf6e3", "#92400e", "#0c1222"],
  },
  {
    id: "color-markers",
    label: "Color markers",
    description: "Marcadores de colores para resaltar ideas.",
    swatch: ["#ffffff", "#ef4444", "#10b981"],
  },
];

export const videoDurations: VideoDurationOption[] = [
  { id: 1, label: "1 min", description: "Repaso exprés" },
  { id: 3, label: "3 min", description: "Explicación completa" },
  { id: 5, label: "5 min", description: "Tema a fondo" },
];

/* -------------------------------------------------------------------------- */
/*                                   Plans                                    */
/* -------------------------------------------------------------------------- */

export const mockPlans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Para probar cómo se ve tu primer video.",
    price: 0,
    currency: "USD",
    interval: "month",
    minutesPerMonth: 3,
    maxDurationMinutes: 1,
    ctaLabel: "Empezar gratis",
    features: [
      { label: "3 minutos de video al mes", included: true },
      { label: "Videos de hasta 1 minuto", included: true },
      { label: "Estilo Classic whiteboard", included: true },
      { label: "PDF de hasta 10 páginas", included: true },
      { label: "Descarga en MP4", included: false },
      { label: "Soporte prioritario", included: false },
    ],
  },
  {
    id: "student",
    name: "Student",
    tagline: "Para llevar todo un semestre al día.",
    price: 25,
    currency: "USD",
    interval: "month",
    minutesPerMonth: 30,
    maxDurationMinutes: 3,
    ctaLabel: "Elegir Student",
    highlighted: true,
    features: [
      { label: "30 minutos de video al mes", included: true },
      { label: "Videos de hasta 3 minutos", included: true },
      { label: "Los 3 estilos de whiteboard", included: true },
      { label: "PDF de hasta 100 páginas", included: true },
      { label: "Descarga en MP4", included: true },
      { label: "Soporte prioritario", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Para quien estudia (o enseña) todos los días.",
    price: 50,
    currency: "USD",
    interval: "month",
    minutesPerMonth: 70,
    maxDurationMinutes: 5,
    ctaLabel: "Elegir Pro",
    features: [
      { label: "70 minutos de video al mes", included: true },
      { label: "Videos de hasta 5 minutos", included: true },
      { label: "Los 3 estilos de whiteboard", included: true },
      { label: "Libros completos y PDFs sin límite", included: true },
      { label: "Descarga en MP4 y audio", included: true },
      { label: "Soporte prioritario", included: true },
    ],
  },
];

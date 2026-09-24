/** Copy for the public landing page. Kept out of components so it reads well. */

import {
  BookOpen,
  Brain,
  Clapperboard,
  FileUp,
  Highlighter,
  Library,
  MonitorPlay,
  PenLine,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface HowItWorksStep {
  step: number;
  title: string;
  description: string;
  Icon: LucideIcon;
}

export const howItWorksSteps: HowItWorksStep[] = [
  {
    step: 1,
    title: "Sube tu PDF, libro o cuaderno",
    description:
      "Arrastra el archivo que te toca estudiar. Aceptamos PDF, DOCX y TXT, desde un capítulo suelto hasta un libro completo.",
    Icon: FileUp,
  },
  {
    step: 2,
    title: "La IA entiende el contenido",
    description:
      "Leemos el documento, detectamos los conceptos clave y decidimos qué merece una explicación y qué es relleno.",
    Icon: Brain,
  },
  {
    step: 3,
    title: "Se genera un video estilo whiteboard",
    description:
      "Una mano dibuja y escribe en la pizarra mientras una voz clara explica, escena por escena.",
    Icon: PenLine,
  },
  {
    step: 4,
    title: "Estudias con una explicación visual",
    description:
      "Míralo, vuelve a la escena que no entendiste y guarda el video en tu biblioteca para repasar antes del examen.",
    Icon: MonitorPlay,
  },
];

export interface Benefit {
  title: string;
  description: string;
  Icon: LucideIcon;
}

export const benefits: Benefit[] = [
  {
    title: "Estudia más rápido",
    description:
      "Un capítulo de 30 páginas se convierte en una explicación de 3 minutos con lo que de verdad entra en el examen.",
    Icon: Timer,
  },
  {
    title: "Explicaciones visuales",
    description:
      "Ver cómo se dibuja una idea se recuerda mucho mejor que releer el mismo párrafo cinco veces.",
    Icon: Highlighter,
  },
  {
    title: "Ideal para PDFs, libros y apuntes",
    description:
      "Da igual si es el PDF de la clase, un capítulo escaneado del libro o tus propios apuntes: entra todo.",
    Icon: BookOpen,
  },
  {
    title: "Videos con estilo whiteboard",
    description:
      "Pizarra, cuaderno o marcadores de colores. Elige el estilo con el que te concentras mejor.",
    Icon: Clapperboard,
  },
  {
    title: "Guarda tus videos generados",
    description:
      "Tu biblioteca queda organizada por materia y documento, lista para el repaso de la semana del examen.",
    Icon: Library,
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: "¿Qué tipo de archivos puedo subir?",
    answer:
      "PDF, DOCX y TXT, de hasta 25 MB. Sirve tanto el PDF que sube tu profesor como un capítulo escaneado de un libro o tus apuntes pasados a limpio. Si el PDF es una foto sin texto, te avisamos antes de generar el video.",
  },
  {
    question: "¿Cuánto tarda en generarse un video?",
    answer:
      "Entre 2 y 5 minutos según la duración que elijas y el tamaño del documento. No hace falta que esperes con la pestaña abierta: el video aparece en tu biblioteca cuando está listo.",
  },
  {
    question: "¿Puedo usar PDFs de clase?",
    answer:
      "Sí. Es justo para lo que está pensado: material de tus cursos, presentaciones del profesor y tus propios apuntes. Solo te pedimos que subas material que tengas derecho a usar para estudiar.",
  },
  {
    question: "¿Los videos son privados?",
    answer:
      "Sí. Tus documentos y tus videos son privados por defecto y solo tú los ves desde tu cuenta. Si quieres compartir uno con un compañero, generas un enlace tú mismo desde el video.",
  },
  {
    question: "¿Puedo cancelar mi plan?",
    answer:
      "Cuando quieras, desde Billing y en dos clics. Mantienes el acceso hasta el final del periodo que ya pagaste y tus videos generados siguen siendo tuyos.",
  },
];

export const navLinks = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Precios", href: "#precios" },
  { label: "FAQ", href: "#faq" },
];

export const footerColumns = [
  {
    title: "Producto",
    links: [
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "Beneficios", href: "#beneficios" },
      { label: "Precios", href: "#precios" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Guía de estudio", href: "#faq" },
      { label: "Estado del servicio", href: "#faq" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { label: "Iniciar sesión", href: "/login" },
      { label: "Crear cuenta", href: "/signup" },
      { label: "Planes", href: "/billing" },
    ],
  },
];

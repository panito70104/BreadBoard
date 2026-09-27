import { generateStoryboard } from "@/lib/storyboard/generate";

const corto = "El agua hierve a cien grados y se congela a cero. La temperatura mide qué tan caliente está algo.";
const largo = `La Revolución Industrial transformó Europa entre 1760 y 1840. Empezó en Inglaterra por tres razones:
carbón abundante, colonias que compraban y un sistema bancario que prestaba. La máquina de vapor de Watt
multiplicó la fuerza disponible y sacó la producción de los talleres para meterla en fábricas. El campo se
vació: millones de campesinos se mudaron a ciudades que no estaban preparadas, y aparecieron los barrios
obreros, el trabajo infantil y jornadas de catorce horas. De ahí nacieron los sindicatos y las primeras leyes
laborales. El ferrocarril redujo el coste de mover mercancías a una décima parte y creó mercados nacionales.
La segunda fase, desde 1870, trajo el acero, la electricidad y la química, y desplazó el liderazgo hacia
Alemania y Estados Unidos. Las consecuencias siguen con nosotros: la división entre países industrializados
y no industrializados, el crecimiento de la población y el inicio de las emisiones que hoy llamamos cambio climático.`;

const casos: { label: string; text: string; prompt?: string }[] = [
  { label: "corto, sin pedir nada", text: corto },
  { label: "denso, sin pedir nada", text: largo },
  { label: "denso, pide algo corto", text: largo, prompt: "Hazme un video corto, solo lo esencial." },
];

for (const caso of casos) {
  try {
    const { storyboard } = await generateStoryboard({
      documentText: caso.text,
      documentName: "apuntes.txt",
      prompt: caso.prompt,
      allowedSeconds: 180,
      documentWords: caso.text.split(/\s+/).filter(Boolean).length,
      style: "classic-whiteboard",
    });
    const words = storyboard.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
    console.log(
      `${caso.label.padEnd(24)} → ${String(storyboard.targetSeconds).padStart(3)}s · ` +
        `${storyboard.scenes.length} escenas · ${words} palabras (~${(words / 2.57).toFixed(0)}s de voz)`,
    );
  } catch (error) {
    console.log(`${caso.label.padEnd(24)} → FALLO: ${String(error).slice(0, 160)}`);
  }
}

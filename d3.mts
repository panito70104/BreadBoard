import { generateStoryboard } from "@/lib/storyboard/generate";
const largo = `La Revolución Industrial transformó Europa entre 1760 y 1840. Empezó en Inglaterra por carbón abundante,
colonias que compraban y bancos que prestaban. La máquina de vapor sacó la producción de los talleres a las fábricas.
El campo se vació y aparecieron los barrios obreros, el trabajo infantil y jornadas de catorce horas. De ahí nacieron
los sindicatos. El ferrocarril redujo el coste de mover mercancías a una décima parte. La segunda fase, desde 1870,
trajo el acero, la electricidad y la química, y desplazó el liderazgo hacia Alemania y Estados Unidos.`;
for (const prompt of ["Hazme un video corto, solo lo esencial.", "Explícamelo a fondo, con todo el detalle."]) {
  const { storyboard } = await generateStoryboard({
    documentText: largo, documentName: "apuntes.txt", prompt,
    allowedSeconds: 180, documentWords: largo.split(/\s+/).filter(Boolean).length, style: "classic-whiteboard",
  });
  const w = storyboard.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
  console.log(`"${prompt.slice(0, 32)}…" → ${storyboard.targetSeconds}s · ${storyboard.scenes.length} escenas · ${w} palabras`);
}

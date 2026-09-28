# BreadBoard — el motor de pizarra: brief técnico para discusión

> **Para el AI que lee esto:** esto describe un motor real y en funcionamiento, no un
> proyecto hipotético. No tienes acceso al repo. Lo que sigue es autocontenido a
> propósito: arquitectura, contrato de datos, los números reales, y — al final —
> las debilidades conocidas y las preguntas abiertas. Quiero que discutas el
> **diseño**, no que me des una lista de buenas prácticas genéricas. Si algo te
> parece mal planteado de raíz, dilo. Si ves una idea que el motor está a punto
> de descubrir pero no ha descubierto, esa es la conversación que busco.

---

## 1. Qué es

BreadBoard convierte un documento de estudio (PDF, Word, o texto pegado) en un
**video de pizarra blanca**: una mano dibuja y escribe sobre un tablero mientras
una voz narra, y **el dibujo cae exactamente sobre la palabra que lo nombra**.

Esa última frase es todo el producto. Un video de pizarra donde el dibujo aparece
"más o menos por ahí" es una presentación con animación. Que el dibujo caiga en la
palabra es lo que hace que se sienta como una persona explicándote algo.

**Stack:** Next.js 16 / React 19 / TypeScript. Remotion 4 (`@remotion/player`)
como motor de composición — el video se renderiza en el navegador, frame a frame,
desde el mismo componente que produciría un MP4. Claude Opus 5 escribe el guion.
ElevenLabs produce la voz. Postgres (Drizzle) + almacenamiento S3-compatible.

---

## 2. El pipeline completo

```
documento  →  guion (storyboard)  →  voz + tiempos  →  geometría  →  frames  →  video
              Claude Opus 5          ElevenLabs        plan.ts      timeline.ts  Remotion
```

### Etapa 1 — Documento a guion

Claude Opus 5 con **structured outputs** (schema Zod compilado a gramática de
decodificación), `thinking: adaptive`, `effort: high`. El system prompt (~9.800
tokens, generado desde los catálogos de layouts e iconos, byte-estable) se cachea
1 hora — no 5 minutos: una sesión de estudio dura más que eso, y a 5 minutos se
paga la escritura del caché sin llegar a leerlo nunca.

Tres capas guardan la salida:

1. **Structured outputs** hacen imposible un layout que no existe o un icono
   fuera del vocabulario.
2. **`parseStoryboard`** repara lo que un schema no puede expresar: un slot que
   el layout elegido no tiene, una frase disparadora ausente de la narración,
   seis viñetas donde caben tres. Cada reparación emite un aviso.
3. **`visualHealth`** hace la única pregunta que las otras dos no pueden: *¿de
   verdad dibujó algo?* Un guion que escribe ocho líneas de texto y dibuja dos
   cosas ha fracasado en lo único que justifica una pizarra. Eso vale pagar un
   segundo intento, con una corrección explícita, y se queda el que más dibuje.

### Etapa 2 — Voz y tiempos (la etapa interesante)

ElevenLabs, endpoint **`/with-timestamps`**. Devuelve el mp3 *y el segundo en que
se pronuncia cada carácter*.

Eso es lo que convierte la sincronía de estimación en hecho. El guion dice que un
paso ocurre `on: "La oferta es eso"` — una cita textual de la narración de esa
escena. El alineador normaliza (acentos plegados, mayúsculas fuera, puntuación a
espacios) de forma **reversible** — guarda el mapa de índices — localiza la frase
en el texto hablado y lee el segundo en que empieza su primer carácter. Ese
número se guarda en el paso como `at`.

La duración de la escena también deja de ser una estimación aquí: dura lo que
tarda la frase en decirse, más un beat para respirar.

**Y un minuto comprado tiene que ser un minuto entregado.** El presupuesto de
palabras del prompt es un lazo abierto (ninguna constante de palabras-por-segundo
sobrevive al contacto con una voz real), así que la duración se mide y se corrige,
de forma **asimétrica**:

- **Salió largo** → se relee más rápido. Con tope (1.2×, ~17% más corto), porque
  un narrador corriendo para encajar es peor que un video diez segundos largo.
- **Salió corto** → el tiempo sobrante se le da al dibujo. La mano termina, se
  asienta y se va del tablero. El silencio sobre un dibujo terminado es cómo los
  videos de pizarra han respirado siempre, y no cuesta nada producirlo.

Nada aquí puede tumbar una generación: sin clave, petición rechazada, servicio de
mal día → el video sale mudo con un aviso, que vale infinitamente más que ningún
video.

### Etapa 3 — Guion a geometría (`plan.ts`)

El guion solo dice "una viñeta en el slot `list`". Convertir eso en píxeles
necesita cosas que el modelo nunca da: qué más vive en ese slot, cuánto mide cada
pieza una vez ajustada de línea, a qué apunta `prev`, y qué debe abrazar un
subrayado.

El plan responde todo eso **una vez por escena**, de modo que el renderer y la
mano lean los mismos números en cada frame. Dentro de un slot el contenido se
apila de arriba abajo en el orden en que se dibuja; el texto toma su altura
medida, los dibujos se reparten lo que queda, y si no cabe **todo el slot se
escala junto** — nunca se solapa.

### Etapa 4 — Geometría a frames (`timeline.ts`)

`planStoryboard` planifica **dos veces**, a propósito:

- La primera pasada reparte frames desde una *estimación* de cuánto tarda cada
  elemento, porque el timeline tiene que repartir tiempo antes de que exista
  geometría alguna.
- Luego el planificador mide la verdad — la longitud real de cada trazo y el
  alcance real que la mano tiene que cubrir entre trazos — y el timeline se
  reconstruye con esos números.

Sin la segunda pasada la estimación decide el ritmo, y se equivoca siempre en la
misma dirección: un diagrama son muchos trazos pequeños con mucho viaje entre
ellos, así que recibe consistentemente menos espacio del que necesita y se dibuja
a una velocidad que ninguna mano podría.

**El total nunca depende de eso**: una escena dura exactamente su
`durationSeconds`, porque la narración se escribió para esa duración y el alumno
la pagó. Solo cambia el reparto interno.

### Etapa 5 — Frames a video

El componente de Remotion, en cualquier frame, muestra: la escena que posee el
frame, todo lo dibujado hasta ahí, el paso en curso, y la mano — a través de una
cámara que se inclina hacia lo que se está dibujando. **Casi nada se decide en
el componente**: el planificador tiene la geometría, el pen schedule el tiempo,
`hand-motion` dónde está la mano, y `camera` el encuadre. El componente pregunta
a cada uno una vez y pinta la respuesta.

El audio va fuera de la transformación de cámara (el sonido no tiene posición en
el tablero), una `<Sequence>` por escena.

---

## 3. El contrato de datos

El guion es el único acoplamiento entre el modelo y el motor. Vocabulario exacto:

**8 layouts** (cada uno define qué slots existe y su geometría normalizada 0–1):
`title-only`, `title-bullets`, `visual-left-bullets-right`, `two-column-compare`,
`center-diagram-labels`, `timeline`, `formula-steps`, `summary-box`.

**8 slots:** `title`, `visual`, `list`, `left`, `right`, `center`, `aside`, `footer`.
Un slot que el layout no tiene cae a su `fallbackSlot`.

**10 tipos de elemento:** `title`, `text`, `bullet`, `icon`, `sketch`, `arrow`,
`emphasis`, `diagram`, `formula`, `erase`.

- `icon` — uno de **244 iconos** (paths de Lucide, redibujados con Rough.js).
- `sketch` — hasta 4 dibujos que *significan algo juntos*, con relación entre
  ellos (`arrow`, `plus`, `equals`, `vs`, `none`), etiqueta por pieza, marca
  opcional encima (`cross`, `check`, `question`) y pie de foto. Un icono solo
  decora una frase; dos iconos con una flecha entre ellos son una explicación, y
  eso es el punto de dibujar en vez de escribir.
- `diagram` — **8 clases** (`axes`, `timeline`, `flow`, `compare`, `cycle`,
  `tree`, `table`, `bars`). El modelo solo da `{ kind, labels }`; curvas, cajas,
  barras y la posición de cada etiqueta se deciden en el motor, como una
  secuencia de partes en el orden en que una persona las dibujaría.
- `emphasis` — 5 formas (`underline`, `box`, `circle`, `brace`, `strike`) sobre
  un slot o sobre `prev` (lo dibujado inmediatamente antes).

**Cada paso lleva `on`**: una cita textual de la narración de su escena. Es el
ancla temporal. Tras la etapa 2 lleva además `at`: el segundo medido.

**Topes** (`LIMITS`): 12 escenas, 14 pasos por escena, **3 viñetas por escena**,
4 piezas por sketch, 60 caracteres de título, 56 de viñeta, 12 etiquetas por
diagrama. `wordsPerSecond: 2.57` dimensiona la narración en el prompt.

**Tablero:** 1920×1080, **30 fps**. 3 estilos (`classic-whiteboard`,
`paper-desk`, y uno oscuro), 6 colores de marcador.

---

## 4. Las tres decisiones que definen el motor

### (a) La mano y la tinta leen el mismo horario

Un paso no es un trazo continuo. Un icono son doce paths separados, un párrafo
son varias líneas, y entre dos cualesquiera un marcador real **deja el tablero,
viaja, y vuelve a bajar**. El motor antes se saltaba todo eso: la punta se
teletransportaba del final de un path al inicio del siguiente, doce veces dentro
de un mismo dibujo. Es lo más mecánico que puede hacer un video de pizarra, y
ninguna cantidad de temblor en la tinta lo esconde.

Así que un paso se planifica como una **secuencia de eventos** — dibuja, viaja,
dibuja — cada uno con segundos reales encima. El tiempo de dibujo sale de la
longitud del trazo (`DRAW_SPEED = 1150 px/s`; escribir cuesta
`WRITE_SECONDS = 0.055 s/carácter`). El tiempo de viaje sale de la distancia que
la mano tiene que alcanzar, **nunca del hueco que la narración deje**.

Consecuencia deliberada: **un paso puede terminar antes de que acabe su hueco**.
Una persona escribe a su velocidad y luego espera; no ralentiza su caligrafía
para llenar una pausa.

### (b) Un alcance tarda lo que la distancia exige, y no es simétrico

`motion.ts`. Un alcance acelera duro, navega, y pasa la mayor parte del tiempo
llegando — normalmente pasándose un poco y corrigiendo. Ese es el perfil de
**mínimo jerk**, que es lo que producen los brazos humanos de verdad; un ease
simétrico se lee como maquinaria. Los trazos, en cambio, usan `smoothstep`: un
trazo de marcador no tiene fase balística.

Entre pasos la mano **se asienta** donde terminó (0.22 s, mirándolo), se mueve a
la velocidad que la distancia merece, y espera **fuera del camino** para que se
pueda leer lo que escribió. Si el hueco pasa de 1.5 s, quita la mano del tablero
por completo y la trae de vuelta justo antes del siguiente trazo (llega 0.12 s
antes). Mientras espera deriva 2.5 px, porque una mano perfectamente quieta es un
sprite.

La mano es una **imagen** (fotos generadas), posicionada por la punta de la
herramienta, con rotación de muñeca según el trazo (hasta 7°) y la posición en el
tablero (4°), `lift` de 0 a 1, desenfoque de movimiento por velocidad, y temblor
de 1.2 px / 0.35° que es **función pura del frame absoluto**. Dos herramientas
(`marker`, `eraser`) y varias "familias" — manos de la misma familia son la misma
persona: misma piel, misma manga.

### (c) Todo es una función pura del frame

Remotion renderiza frames **fuera de orden y en paralelo**. Nada puede depender
de un frame anterior. El temblor de la mano, la geometría "a mano alzada", el
muestreo de paths: todo determinista dada la misma entrada.

Rough.js convierte cada path perfecto en su equivalente dibujado a mano, con
**semilla derivada del propio path** — si no, el temblor se re-aleatorizaría 30
veces por segundo y el dibujo *hervería*. Y con `disableMultiStroke`: Rough.js
por defecto hace dos pasadas ligeramente desplazadas (look de lápiz), y como la
mano sigue el path, trazaría cada línea, volvería al inicio y la trazaría otra
vez. Un marcador dibuja cada línea una vez.

La posición de la punta sobre un path sale de `getPointAtLength` contra un
elemento SVG desprendido, cacheado, con **muestras espaciadas por longitud de
arco** (no por conteo: un conteo fijo hace que un path largo avance a saltos
visiblemente mayores que uno corto) e **interpoladas entre muestras** — si se
enganchan a la muestra más cercana, la punta se queda quieta un frame y luego
salta, y eso se lee como un tic que ningún easing esconde.

El texto se maqueta **a mano** (medición por canvas, salto de línea propio,
posición de cada carácter) en vez de dejar que el navegador ajuste, porque la
mano tiene que sentarse en el punto exacto donde aparece el siguiente glifo. Una
palabra revelada como un barrido suave no se lee como caligrafía: se lee como una
persiana bajando.

---

## 5. La cámara

Un video de pizarra rodado como un plano general fijo es un pase de diapositivas:
el encuadre no dice nada sobre dónde mirar, y un tablero de 1920 px significa que
la escritura es pequeña. Uno real deriva hacia lo que se está dibujando y se abre
a medida que el tablero se llena.

El movimiento es deliberadamente **pequeño**: `MAX_ZOOM = 1.18`. Más de un quinto
de zoom empieza a *nadar*, y una cámara que reacciona a cada paso es peor que una
que nunca se mueve — así que un plano solo se conserva si difiere del anterior lo
suficiente para merecer el movimiento (`SCALE_STEP = 0.02`, `CENTRE_STEP = 70 px`),
y cada movimiento empieza 0.35 s **antes** de que la mano llegue, para que la zona
nueva ya esté en pantalla cuando el dibujo empiece. Cada movimiento dura 0.9 s con
perfil de mínimo jerk. El encuadre se relaja un 30% hacia el tablero completo.

Los planos salen de la **tinta acumulada**: el frame contiene todo lo dibujado
desde la última vez que se borró el tablero, más lo que se dibuja ahora. La cámara
por tanto empieza cerrada sobre un título de apertura y se abre a medida que la
escena se llena — que es el movimiento que una persona hace con su atención de
todas formas.

---

## 6. Los números reales

| Constante | Valor | Qué gobierna |
|---|---|---|
| `BOARD` | 1920×1080 @ 30 fps | tablero, autoría en píxeles de tablero |
| `DRAW_SPEED` | 1150 px/s | velocidad del marcador dibujando |
| `WRITE_SECONDS` | 0.055 s/car | velocidad de caligrafía |
| `STEP_GAP_SECONDS` | 0.45 s | hueco entre pasos para que la mano llegue |
| `SETTLE_SECONDS` | 0.22 s | la mano se queda mirando lo que terminó |
| `LEAVE_AFTER_SECONDS` | 1.5 s | ocio tras el cual vale la pena salir del tablero |
| `MIN_STEP_SECONDS` | 0.5 s | suelo por paso |
| `MIN_DRAW_SCALE` | 0.55 | cuánto se puede apurar el dibujo antes de tocar los huecos |
| `MAX_LEAD_IN_SECONDS` | 1.2 s | lo máximo que una escena abre con el tablero en blanco |
| `MAX_ZOOM` | 1.18 | tope de acercamiento |
| `TOLERANCE` | 0.12 | desvío de duración que se deja en paz |
| `TAIL_SECONDS` | 0.7 s | beat tras la última palabra |
| `MIN_SCENE_SECONDS` | 2.5 s | por corta que sea la frase, hay que poder mirarla |
| `MAX_STRETCH` | 1.5 | cuánto se puede estirar una escena sobre su propia voz |
| `MAX_SPEED` | 1.2 | cuánto se puede acelerar la lectura |
| `wordsPerSecond` | 2.57 | dimensiona la narración en el prompt |

Cuando el reparto interno de una escena no cabe, **el dibujo cede antes que el
movimiento**: un trazo dibujado un tercio más rápido sigue leyéndose como un
trazo, mientras que una mano que cruza el tablero en tres frames se lee como un
plano perdido. Solo cuando el dibujo ya está en su suelo empiezan a cerrarse
también los huecos.

---

## 7. Invariantes que no se pueden romper

1. **Una escena dura exactamente su `durationSeconds`.** La voz se escribió para
   esa duración y se pagó.
2. **Con voz, `at` no es negociable.** Es el segundo en que se pronuncia la
   frase, medido sobre el audio, y el dibujo tiene que estar ahí. Cualquier otra
   cosa y la mano está ilustrando una frase que el narrador terminó hace dos
   segundos. Cede el dibujo, no la sincronía.
3. **La mano y la tinta vienen de un solo horario** y por tanto no pueden
   discrepar nunca.
4. **Todo es función pura del frame.** Remotion renderiza en paralelo.
5. **Una escena no abre con el tablero en blanco** (máx. 1.2 s de entrada).
6. **Nada en la etapa de voz puede tumbar una generación.** Peor caso: video
   mudo con aviso.
7. **Un video sin voz sigue reproduciéndose**: sin `at`, el motor usa la
   posición de la frase en el texto de la narración como sustituto (una frase al
   40% del texto dispara al 40% de la escena). El ritmo de lectura es
   aproximadamente uniforme, así que es un sustituto decente.

---

## 8. Debilidades conocidas y deuda (sé honesto conmigo sobre estas)

- **No hay MP4.** Solo el Player en el navegador. El render en servidor necesita
  retener el frame con `delayRender()` hasta `document.fonts.ready`, porque el
  texto se mide con canvas y el canvas no conoce la tipografía manuscrita hasta
  que carga — si no, toda la maquetación se calcula con la fuente de respaldo.
- **`stretch()` escala `durationSeconds` *después* de medir `at`.** El audio no
  se estira. Así que en una escena estirada, `at / durationSeconds` se encoge y
  el dibujo deriva **adelantado** respecto a la narración. Latente (tope 1.5×),
  pero es una inconsistencia real en el invariante 2.
- **El modelo cita la misma frase en dos pasos** con frecuencia (un título y el
  subrayado debajo). Dos dibujos caen en el mismo instante. Mitigado repartiendo
  la racha, no resuelto en origen.
- **El orden de los pasos es una opinión del modelo, no cronología.** El modelo
  escribe el título primero aunque su frase se diga en el segundo 6. Ahora se
  reordena por `at` cuando la voz lo sabe, arrastrando los `emphasis` que apuntan
  a `prev` con su vecino. Pero eso significa que *reordenar cambia la
  maquetación*, porque el apilado dentro de un slot sigue el orden de dibujo.
- **La voz puede caer a un respaldo inglés.** Si la clave de API no tiene permiso
  para listar voces, se usa una voz premade inglesa leyendo español.
- **El modelo de voz es el más barato y el más propenso a artefactos** para
  español.
- **No hay tests unitarios.** Dos scripts de verificación locales que recorren el
  motor completo y reportan métricas (salto máximo de la mano px/frame, % de
  frames con el marcador en el aire, rango de zoom, avisos del validador).
- **`erase` es la única forma de limpiar.** No hay tachar, corregir, ni reescribir.
- **El presupuesto de palabras es un lazo abierto** corregido a posteriori.

---

## 9. Preguntas abiertas — esto es lo que quiero discutir

1. **La sincronía es unidireccional: el dibujo sigue a la voz.** ¿Qué se gana si
   la voz siguiera al dibujo? ¿O si se negociaran? ElevenLabs acepta control de
   pausas; el motor sabe exactamente cuánto tarda un diagrama. Hoy esa
   información no viaja hacia atrás.

2. **¿Quién debería poseer la cronología?** El modelo escribe orden de dibujo; la
   voz define orden temporal. Los reconcilio ordenando por `at`, pero eso
   reordena la maquetación. ¿Debería el prompt exigir orden cronológico? ¿O
   debería el motor separar "orden de dibujo" de "orden de apilado" como dos
   campos distintos?

3. **El motor nunca dibuja lo que la narración no nombra.** Cada paso necesita
   una frase textual como ancla. Eso garantiza sincronía y a la vez **prohíbe el
   dibujo silencioso** — la mano no puede añadir un detalle mientras el narrador
   dice otra cosa. ¿Es una restricción o una limitación?

4. **Rough.js da temblor, no intención.** Una persona no dibuja un círculo con
   ruido uniforme: lo cierra mal por un lado, acelera en la curva de abajo,
   levanta antes de cerrar. ¿Se puede modelar *intención de trazo* sin caer en
   simulación física completa?

5. **La cámara solo deriva, nunca corta.** Un profesor de verdad borra media
   pizarra y sigue. ¿Es el corte una herramienta que le falta, o rompería la
   ilusión de un solo tablero continuo?

6. **Los layouts son cajas fijas.** Una persona compone libre: encaja algo en el
   hueco que quedó. Hay 8 layouts × 8 slots. ¿Es un andamio necesario para que un
   LLM produzca algo maquetable, o es el techo del producto?

7. **El silencio como respiración vs. tiempo muerto.** Cuando el guion sale corto,
   el tiempo sobrante va al dibujo (tope 1.5×). Funciona, pero es una decisión
   sin criterio de calidad: no hay noción de *qué* merece más tiempo.

8. **Todo es determinista y puro.** Excelente para renderizar. Pero una pizarra
   real tiene accidente acumulado: la tinta de antes se corre, el borrado deja
   sombra, la caligrafía se degrada al final de una sesión larga. ¿Vale la pena
   un "estado del tablero" que se ensucie, siendo aún función pura del frame?

9. **¿Cuál es la métrica de calidad?** Hoy mido cosas mecánicas (px/frame de la
   mano, % de tiempo en el aire, zoom). Nada mide si el video *enseña*. ¿Qué
   mediría tú?

10. **El cuello de botella real.** `planStoryboard` planifica todas las escenas
    dos veces, en el hilo principal del navegador, con geometría de Rough.js y
    medición por canvas. Está cacheado y memoizado, pero es O(guion completo).
    ¿Arquitectura equivocada, o correcta y solo hay que moverla de sitio?

---

## 10. Qué quiero de ti

Elige **dos o tres** de las preguntas de arriba — las que te parezcan más
sustanciosas, no las más fáciles — y ve a fondo. Prefiero un desacuerdo
argumentado a una lista de sugerencias. Si crees que una premisa del motor está
equivocada (por ejemplo, que anclar cada dibujo a una frase textual sea el error
original), discútelo directamente.

Y si ves algo que el motor está a punto de descubrir pero no ha descubierto —
una consecuencia de su propio diseño que todavía no se ha cobrado — eso es lo
que más me interesa.

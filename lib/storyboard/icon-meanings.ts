/**
 * What each icon actually looks like on the board.
 *
 * `icons.ts` is the list of names the model may pick from. A name is not enough
 * for the job the art director has to do: choosing `Box` for "a node in a
 * linked list" is only obviously wrong if you know `Box` draws an isometric
 * cube and that `Train` draws the front of a train car. The director got cubes
 * for a train metaphor because nothing ever told it the train existed.
 *
 * So every name here carries a one-line description of the drawing, and a kind:
 *
 * - **objeto** — a thing that can stand for something. This is the material a
 *   metaphor is built from, and the director is pushed hard toward it.
 * - **símbolo** — a sign rather than a thing: an arrow, a percent, a chart
 *   glyph. Useful as a connector or an annotation, useless as a character.
 * - **interfaz** — software chrome. It exists because the icon set is mostly
 *   software chrome; a board covered in it looks like an app, not a lesson.
 *
 * Descriptions are written from the real geometry in `data/icon-paths.ts`, not
 * from the name — several Lucide names promise more than the path draws.
 */

import { ICON_IDS, ICON_VOCABULARY, type IconGroup } from "@/lib/storyboard/icons";

export type IconKind = "objeto" | "símbolo" | "interfaz";

export interface IconMeaning {
  kind: IconKind;
  /** What a viewer sees, in a few words. */
  means: string;
}

const M: Record<string, [IconKind, string]> = {
  /* idea */
  Brain: ["objeto", "un cerebro visto de perfil"],
  Lightbulb: ["objeto", "una bombilla con su rosca: idea, ocurrencia"],
  Sparkles: ["símbolo", "tres destellos: algo nuevo, mágico o mejorado"],
  Target: ["objeto", "una diana de tres anillos con el centro marcado"],
  Puzzle: ["objeto", "una pieza de puzle suelta: encaje, parte de un todo"],
  Key: ["objeto", "una llave con su paletón"],
  Compass: ["objeto", "una brújula con la aguja marcando el norte"],
  Flag: ["objeto", "una bandera en su mástil: meta, inicio, marca"],
  Milestone: ["objeto", "un poste con un cartel apuntando: hito, señal de camino"],
  Eye: ["objeto", "un ojo abierto con su pupila"],

  /* estudio */
  BookOpen: ["objeto", "un libro abierto por la mitad"],
  Book: ["objeto", "un libro cerrado de canto"],
  GraduationCap: ["objeto", "un birrete de graduación con su borla"],
  Notebook: ["objeto", "un cuaderno con anillas y renglones"],
  NotebookPen: ["objeto", "un cuaderno con una pluma escribiendo encima"],
  PenLine: ["objeto", "una pluma trazando una línea"],
  Pencil: ["objeto", "un lápiz en diagonal"],
  Highlighter: ["objeto", "un marcador fluorescente subrayando"],
  School: ["objeto", "un edificio escolar con bandera en el tejado"],
  Library: ["objeto", "varios libros de pie en una estantería"],
  FileText: ["objeto", "una hoja con la esquina doblada y renglones"],
  ClipboardList: ["objeto", "un portapapeles con una lista de puntos"],
  StickyNote: ["objeto", "una nota adhesiva con la esquina levantada"],

  /* ciencia */
  Atom: ["objeto", "un núcleo con dos órbitas cruzadas"],
  FlaskConical: ["objeto", "un matraz de laboratorio con líquido"],
  TestTube: ["objeto", "un tubo de ensayo inclinado"],
  Microscope: ["objeto", "un microscopio de laboratorio"],
  Dna: ["objeto", "una doble hélice de ADN"],
  Magnet: ["objeto", "un imán de herradura con sus dos polos"],
  Orbit: ["símbolo", "un cuerpo pequeño orbitando alrededor de otro"],
  Telescope: ["objeto", "un telescopio sobre su trípode"],
  Thermometer: ["objeto", "un termómetro con su bulbo"],
  Leaf: ["objeto", "una hoja de árbol con su nervio"],
  Sprout: ["objeto", "un brote de dos hojas saliendo de la tierra"],
  TreePine: ["objeto", "un pino triangular con tronco"],
  Bug: ["objeto", "un insecto visto desde arriba"],
  Fish: ["objeto", "un pez de perfil"],
  Bird: ["objeto", "un pájaro posado de perfil"],
  Droplet: ["objeto", "una gota de agua"],
  Flame: ["objeto", "una llama"],
  Sun: ["objeto", "un sol: un círculo con ocho rayos"],
  Moon: ["objeto", "una luna en cuarto creciente"],
  Cloud: ["objeto", "una nube de contorno redondeado"],
  Wind: ["símbolo", "tres rachas de viento en curva"],
  Mountain: ["objeto", "dos picos de montaña"],
  Waves: ["símbolo", "tres líneas onduladas: agua, olas"],
  Globe: ["objeto", "un globo terráqueo con meridianos"],
  Snowflake: ["objeto", "un copo de nieve de seis brazos"],
  Rocket: ["objeto", "un cohete con aletas y llama"],

  /* cuerpo */
  Heart: ["objeto", "un corazón"],
  HeartPulse: ["objeto", "un corazón atravesado por una línea de pulso"],
  Activity: ["símbolo", "una línea de electrocardiograma"],
  Stethoscope: ["objeto", "un fonendoscopio"],
  Pill: ["objeto", "una pastilla de dos mitades"],
  Bone: ["objeto", "un hueso"],
  Ear: ["objeto", "una oreja de perfil"],

  /* matemáticas */
  Calculator: ["objeto", "una calculadora con pantalla y teclas"],
  Sigma: ["símbolo", "el signo de sumatorio"],
  Percent: ["símbolo", "el signo de porcentaje"],
  Divide: ["símbolo", "el signo de dividir"],
  Plus: ["símbolo", "el signo de más"],
  Minus: ["símbolo", "el signo de menos"],
  Equal: ["símbolo", "el signo de igual"],
  Infinity: ["símbolo", "el signo de infinito"],
  TrendingUp: ["símbolo", "una flecha que sube en zigzag: aumento"],
  TrendingDown: ["símbolo", "una flecha que baja en zigzag: descenso"],
  Ruler: ["objeto", "una regla graduada en diagonal"],
  Triangle: ["símbolo", "un triángulo"],
  Circle: ["símbolo", "un círculo"],
  Square: ["símbolo", "un cuadrado de esquinas redondeadas"],
  Hexagon: ["símbolo", "un hexágono"],
  Binary: ["símbolo", "cuatro casillas con unos y ceros"],
  Grid3x3: ["símbolo", "una cuadrícula de nueve casillas"],
  ChartColumn: ["símbolo", "barras verticales sobre unos ejes"],
  ChartLine: ["símbolo", "una línea quebrada sobre unos ejes"],
  ChartPie: ["símbolo", "un círculo con una porción separada"],
  ChartScatter: ["símbolo", "puntos sueltos sobre unos ejes"],

  /* tiempo */
  Clock: ["objeto", "un reloj redondo con dos agujas"],
  Timer: ["objeto", "un cronómetro con su pulsador"],
  Calendar: ["objeto", "un calendario de pared con anillas"],
  Hourglass: ["objeto", "un reloj de arena"],
  History: ["interfaz", "un reloj con una flecha que gira hacia atrás"],
  RefreshCw: ["símbolo", "dos flechas formando un círculo: repetir"],
  Repeat: ["símbolo", "dos flechas en bucle: ciclo"],
  ArrowRight: ["símbolo", "una flecha hacia la derecha"],
  ArrowLeftRight: ["símbolo", "dos flechas opuestas: ida y vuelta"],
  ArrowDown: ["símbolo", "una flecha hacia abajo"],
  GitBranch: ["símbolo", "una línea que se bifurca en dos"],
  Workflow: ["interfaz", "dos cajas unidas por una línea acodada"],
  Route: ["símbolo", "dos paradas unidas por un camino en ese"],
  Footprints: ["objeto", "dos huellas de pie, una delante de otra"],
  ListOrdered: ["interfaz", "una lista numerada"],
  ListChecks: ["interfaz", "una lista con casillas marcadas"],

  /* sociedad */
  Coins: ["objeto", "dos monedas, una detrás de otra"],
  DollarSign: ["símbolo", "el signo del dólar"],
  Banknote: ["objeto", "un billete con una cara en el centro"],
  Scale: ["objeto", "una balanza de dos platos en equilibrio"],
  Building2: ["objeto", "un edificio de oficinas con ventanas"],
  Factory: ["objeto", "una fábrica con chimeneas dentadas"],
  Truck: ["objeto", "un camión de reparto de perfil"],
  ShoppingCart: ["objeto", "un carrito de la compra"],
  Handshake: ["objeto", "dos manos estrechándose: acuerdo"],
  Users: ["objeto", "dos o tres personas juntas: un grupo"],
  User: ["objeto", "una persona: cabeza y hombros"],
  Vote: ["objeto", "una mano metiendo una papeleta en una urna"],
  Gavel: ["objeto", "un mazo de juez sobre su base"],
  Crown: ["objeto", "una corona de cinco puntas"],
  Swords: ["objeto", "dos espadas cruzadas: conflicto"],
  Shield: ["objeto", "un escudo: protección"],
  Landmark: ["objeto", "un edificio con columnas y frontón: banco, ministerio"],
  Anchor: ["objeto", "un ancla"],

  /* tecnología */
  Cpu: ["objeto", "un chip cuadrado con patillas"],
  Laptop: ["objeto", "un portátil abierto"],
  Smartphone: ["objeto", "un teléfono móvil"],
  Server: ["objeto", "dos bandejas de servidor apiladas"],
  Database: ["símbolo", "un cilindro de base de datos"],
  Code: ["interfaz", "los signos menor y mayor con una barra"],
  Network: ["interfaz", "tres cajas unidas por líneas"],
  Wifi: ["interfaz", "el arco de cobertura inalámbrica"],
  Bot: ["objeto", "una cabeza de robot con antena"],
  Zap: ["símbolo", "un rayo: energía, rapidez"],
  Battery: ["objeto", "una pila vista de lado"],
  Plug: ["objeto", "un enchufe con dos clavijas"],
  Lock: ["objeto", "un candado cerrado"],
  Unlock: ["objeto", "un candado abierto"],
  Cog: ["objeto", "un engranaje dentado"],
  Wrench: ["objeto", "una llave inglesa"],
  Hammer: ["objeto", "un martillo"],

  /* comunicación */
  MessageCircle: ["objeto", "un bocadillo de diálogo redondo"],
  Quote: ["símbolo", "unas comillas de apertura"],
  Megaphone: ["objeto", "un megáfono"],
  Languages: ["interfaz", "una letra y un ideograma con una flecha"],
  Mic: ["objeto", "un micrófono con su pie"],
  Volume2: ["símbolo", "un altavoz con dos ondas"],
  Mail: ["objeto", "un sobre cerrado"],
  Send: ["objeto", "un avión de papel"],
  Speech: ["símbolo", "una cabeza hablando con ondas saliendo"],

  /* lugares */
  House: ["objeto", "una casa con tejado a dos aguas y puerta"],
  Store: ["objeto", "una tienda con toldo ondulado y escaparate"],
  Hospital: ["objeto", "un edificio con una cruz"],
  Church: ["objeto", "una iglesia con campanario y cruz"],
  Warehouse: ["objeto", "una nave industrial con portón"],
  Tent: ["objeto", "una tienda de campaña"],
  DoorOpen: ["objeto", "una puerta abierta"],
  Bed: ["objeto", "una cama de perfil"],
  Lamp: ["objeto", "una lámpara de pie con su pantalla"],
  Bath: ["objeto", "una bañera con patas"],
  MapPin: ["símbolo", "un marcador de mapa en forma de gota"],
  Map: ["objeto", "un mapa plegado en tres"],

  /* transporte */
  Car: ["objeto", "un coche de perfil"],
  Bus: ["objeto", "un autobús de perfil"],
  Bike: ["objeto", "una bicicleta de perfil"],
  Plane: ["objeto", "un avión visto desde arriba"],
  Ship: ["objeto", "un barco sobre el agua"],
  Train: [
    "objeto",
    "un vagón de tren visto de frente: caja con ventana partida, dos faros y las ruedas asomando",
  ],

  /* naturaleza */
  Trees: ["objeto", "dos árboles juntos"],
  TreeDeciduous: ["objeto", "un árbol de copa redonda"],
  TreePalm: ["objeto", "una palmera"],
  Flower: ["objeto", "una flor de cinco pétalos"],
  Wheat: ["objeto", "una espiga de trigo"],
  Earth: ["objeto", "la Tierra con continentes"],
  Sunrise: ["objeto", "un sol saliendo por el horizonte"],
  Sunset: ["objeto", "un sol poniéndose tras el horizonte"],
  CloudRain: ["objeto", "una nube con lluvia cayendo"],
  CloudLightning: ["objeto", "una nube con un rayo"],
  Umbrella: ["objeto", "un paraguas abierto"],
  Shell: ["objeto", "una concha de mar"],
  Feather: ["objeto", "una pluma de ave"],
  Droplets: ["objeto", "dos gotas de agua"],

  /* animales */
  Dog: ["objeto", "la cabeza de un perro"],
  Cat: ["objeto", "la cabeza de un gato con bigotes"],
  Rabbit: ["objeto", "un conejo con las orejas largas"],
  Turtle: ["objeto", "una tortuga de perfil: lentitud"],
  Squirrel: ["objeto", "una ardilla con la cola levantada"],
  Snail: ["objeto", "un caracol con su concha: lentitud"],
  PawPrint: ["objeto", "la huella de una pata"],

  /* comida */
  Apple: ["objeto", "una manzana con su hoja"],
  Carrot: ["objeto", "una zanahoria con sus hojas"],
  Egg: ["objeto", "un huevo"],
  Pizza: ["objeto", "una porción de pizza"],
  Sandwich: ["objeto", "un sándwich de dos rebanadas"],
  Cookie: ["objeto", "una galleta con pepitas"],
  Coffee: ["objeto", "una taza de café con vapor"],
  Milk: ["objeto", "un cartón de leche"],
  Utensils: ["objeto", "un tenedor y un cuchillo"],
  CupSoda: ["objeto", "un vaso de refresco con pajita"],
  Beef: ["objeto", "un filete con hueso"],
  Soup: ["objeto", "un plato de sopa humeante"],

  /* gente */
  PersonStanding: ["objeto", "una persona de cuerpo entero, de pie"],
  Baby: ["objeto", "la cara de un bebé"],
  UserPlus: ["objeto", "una persona con un signo de más: alguien que se suma"],
  HeartHandshake: ["objeto", "dos manos estrechándose con un corazón encima"],
  Smile: ["objeto", "una cara sonriente"],
  Frown: ["objeto", "una cara triste"],
  Angry: ["objeto", "una cara enfadada"],
  Laugh: ["objeto", "una cara riendo"],
  Skull: ["objeto", "una calavera"],
  Hand: ["objeto", "una mano abierta"],

  /* objetos */
  Box: ["objeto", "un cubo isométrico cerrado: una caja genérica"],
  Package: ["objeto", "un paquete: un cubo con la cinta de embalar"],
  Gift: ["objeto", "un regalo con lazo"],
  Ticket: ["objeto", "una entrada con el borde troquelado"],
  Wallet: ["objeto", "una cartera cerrada"],
  PiggyBank: ["objeto", "una hucha de cerdito"],
  CreditCard: ["objeto", "una tarjeta de crédito con su banda"],
  Receipt: ["objeto", "un tique con el borde dentado"],
  Bell: ["objeto", "una campana"],
  Backpack: ["objeto", "una mochila"],
  Paperclip: ["objeto", "un clip"],
  Newspaper: ["objeto", "un periódico doblado"],
  Trash2: ["objeto", "una papelera con tapa"],
  Recycle: ["símbolo", "las tres flechas del reciclaje"],
  Shirt: ["objeto", "una camiseta"],
  Watch: ["objeto", "un reloj de pulsera"],
  Glasses: ["objeto", "unas gafas"],
  Syringe: ["objeto", "una jeringuilla"],
  Bandage: ["objeto", "una tirita"],

  /* arte */
  Palette: ["objeto", "una paleta de pintor con su agujero"],
  Brush: ["objeto", "un pincel"],
  Music: ["símbolo", "dos corcheas unidas"],
  Guitar: ["objeto", "una guitarra"],
  Drum: ["objeto", "un tambor con sus baquetas"],
  Camera: ["objeto", "una cámara de fotos"],
  Tv: ["objeto", "un televisor con antena"],
  Phone: ["objeto", "un auricular de teléfono clásico"],
  Radio: ["objeto", "una radio con dial y antena"],
  Clapperboard: ["objeto", "una claqueta de cine"],

  /* señales */
  Check: ["símbolo", "una marca de visto"],
  CircleCheck: ["símbolo", "un visto dentro de un círculo"],
  CircleAlert: ["símbolo", "una exclamación dentro de un círculo"],
  Info: ["símbolo", "una i de información dentro de un círculo"],
  CircleHelp: ["símbolo", "una interrogación dentro de un círculo"],
  Star: ["símbolo", "una estrella de cinco puntas"],
  ThumbsUp: ["objeto", "un pulgar hacia arriba"],
  ThumbsDown: ["objeto", "un pulgar hacia abajo"],
  Ban: ["símbolo", "un círculo tachado: prohibido"],
  TriangleAlert: ["símbolo", "un triángulo de peligro con exclamación"],
  Search: ["objeto", "una lupa"],
  Filter: ["símbolo", "un embudo"],
  Layers: ["símbolo", "tres capas apiladas"],
  Link: ["objeto", "dos eslabones de cadena entrelazados"],
  Award: ["objeto", "una medalla con cintas"],
  Trophy: ["objeto", "una copa de trofeo"],
  Scissors: ["objeto", "unas tijeras"],
};

export const ICON_MEANINGS: Record<string, IconMeaning> = Object.fromEntries(
  Object.entries(M).map(([id, [kind, means]]) => [id, { kind, means }]),
);

/** Names in the vocabulary with no description here. Should always be empty. */
export function undescribedIcons(): string[] {
  return ICON_IDS.filter((id) => !(id in ICON_MEANINGS));
}

export function iconsOfKind(kind: IconKind): string[] {
  return ICON_IDS.filter((id) => ICON_MEANINGS[id]?.kind === kind);
}

/**
 * The catalog as the art director reads it: grouped, described, and with the
 * signs and the chrome marked so a metaphor does not get built out of them.
 */
export function describedCatalog(): string {
  return (Object.keys(ICON_VOCABULARY) as IconGroup[])
    .map((group) => {
      const lines = ICON_VOCABULARY[group].map((id) => {
        const meaning = ICON_MEANINGS[id];
        if (!meaning) return `  ${id}`;
        const tag = meaning.kind === "objeto" ? "" : ` [${meaning.kind}]`;
        return `  ${id} — ${meaning.means}${tag}`;
      });
      return `${group}:\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

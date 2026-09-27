/**
 * Lists the voices the configured ElevenLabs key can use.
 *
 *   npm run voices
 *
 * Doubles as the check that the key works at all: if this prints voices, the
 * pipeline will speak. Pick a `voice_id` from here for `ELEVENLABS_VOICE_ID` to
 * pin one; leave that empty and the app chooses per language on its own.
 *
 * Talks to the API directly rather than importing the app's client, which is
 * `server-only` and would refuse to load outside Next.
 */

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("Falta ELEVENLABS_API_KEY en .env.local.");
  process.exit(1);
}

const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
  headers: { "xi-api-key": key },
});

if (!response.ok) {
  const body = await response.json().catch(() => ({}));
  const detail = (body as { detail?: { message?: string } })?.detail?.message ?? "";

  if (detail.includes("voices_read")) {
    console.log("La clave funciona, pero no tiene el permiso voices_read.\n");
    console.log("No pasa nada: los videos se narran igual, con una de las voces");
    console.log("compartidas que tienen todas las cuentas.\n");
    console.log("Si quieres elegir voz, en elevenlabs.io → Profile → API Keys");
    console.log("marca voices_read en la clave, o pon una en ELEVENLABS_VOICE_ID.");
    process.exit(0);
  }

  console.error(`ElevenLabs respondió ${response.status}: ${detail || await response.text()}`);
  process.exit(1);
}

interface Voice {
  voice_id: string;
  name?: string;
  category?: string;
  verified_languages?: { language?: string }[];
}

const { voices = [] } = (await response.json()) as { voices?: Voice[] };

if (voices.length === 0) {
  console.log("La cuenta no tiene ninguna voz disponible.");
  process.exit(0);
}

console.log(`${voices.length} voces disponibles:\n`);
for (const voice of voices) {
  const languages = [
    ...new Set((voice.verified_languages ?? []).map((entry) => entry.language).filter(Boolean)),
  ];
  console.log(
    `  ${(voice.name ?? "sin nombre").padEnd(24)} ${voice.voice_id}  ${(voice.category ?? "?").padEnd(12)} ${languages.join(" ") || "—"}`,
  );
}
console.log("\nFija una con ELEVENLABS_VOICE_ID en .env.local, o déjalo vacío para que se elija sola.");

/**
 * The voice, from ElevenLabs.
 *
 * Two things matter here beyond producing an mp3.
 *
 * **Timings.** The `with-timestamps` endpoint returns, alongside the audio, the
 * second at which every single character is spoken. That is what turns `on`
 * from an estimate into a fact: the engine can put a drawing on the exact word
 * it belongs to. Plain text-to-speech would be much simpler and would throw
 * away the only thing that makes this engine worth having.
 *
 * **Not hardcoding a voice, but not depending on being allowed to look one up
 * either.** Voice ids are per-account, so the voice is read from the account
 * that owns the key, preferring one verified for the language being spoken.
 * But an ElevenLabs key can be issued without `voices_read` — it can speak
 * without being able to say who can speak — and refusing to narrate because a
 * listing was forbidden would be absurd. So a failed listing falls back to the
 * shared premade voices, which every account has.
 *
 * `ELEVENLABS_VOICE_ID` overrides all of it.
 */

import "server-only";

import { env } from "@/lib/server/env";

const API = "https://api.elevenlabs.io";
/** Enough for a long scene on a slow day; a minute of speech takes seconds. */
const TIMEOUT_MS = 120_000;

export class VoiceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "VoiceError";
  }
}

/** Character-level timings, as returned alongside the audio. */
export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface Speech {
  audio: Uint8Array;
  alignment: Alignment;
  /** Where the last character stops, which is the real length of the speech. */
  durationSeconds: number;
  voiceId: string;
  /** The rate it was read at, 1 being the voice's own pace. */
  speed: number;
}

/**
 * How far the reading pace may be pushed to hit a length.
 *
 * 1.2 is about 17% shorter, which a listener reads as brisk rather than as
 * wrong. Past that a narrator starts to sound like a disclaimer, so a
 * storyboard that overshoots by more than this is left long instead.
 */
export const MAX_SPEED = 1.2;

export function voiceConfigured(): boolean {
  return Boolean(env().ELEVENLABS_API_KEY);
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const key = env().ELEVENLABS_API_KEY;
  if (!key) throw new VoiceError("Falta ELEVENLABS_API_KEY.");

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { "xi-api-key": key, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new VoiceError("No pudimos hablar con el servicio de voz.", cause);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[voice] ${response.status} ${path} ${detail.slice(0, 500)}`);
    throw new VoiceError(`El servicio de voz respondió ${response.status}.`);
  }
  return response;
}

/* -------------------------------------------------------------------------- */
/*                                   Voices                                   */
/* -------------------------------------------------------------------------- */

interface ApiVoice {
  voice_id: string;
  name?: string;
  category?: string;
  verified_languages?: { language?: string }[];
}

/**
 * The shared voices, for a key that cannot list. They are part of the library
 * every account gets rather than anything this account owns, so they answer
 * whoever asks — which is exactly why they work as a fallback.
 */
const SHARED_VOICES = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
] as const;

let catalogue: Promise<ApiVoice[]> | null = null;
let warnedAboutListing = false;
const chosen = new Map<string, string>();

function listVoices(): Promise<ApiVoice[]> {
  catalogue ??= call("/v2/voices?page_size=100")
    .then((response) => response.json())
    .then((body: { voices?: ApiVoice[] }) => body.voices ?? [])
    .catch((error) => {
      // A failed listing must not be cached, or one blip disables voice for
      // the lifetime of the process.
      catalogue = null;
      throw error;
    });
  return catalogue;
}

const speaks = (voice: ApiVoice, language: string) =>
  voice.verified_languages?.some((entry) => entry.language?.toLowerCase().startsWith(language)) ??
  false;

/** A voice for this language: the configured one, or the account's best fit. */
export async function resolveVoice(language: string): Promise<string> {
  const configured = env().ELEVENLABS_VOICE_ID;
  if (configured) return configured;

  const cached = chosen.get(language);
  if (cached) return cached;

  let voices: ApiVoice[] = [];
  try {
    voices = await listVoices();
  } catch {
    // Almost always a key without `voices_read`. Say it once, then get on with
    // the job: the model reads whatever language the text is in, so a shared
    // voice narrates Spanish and English equally well.
    if (!warnedAboutListing) {
      warnedAboutListing = true;
      console.warn(
        `[voice] no se pudieron listar las voces de la cuenta; se usará "${SHARED_VOICES[0].name}". ` +
          "Para elegir otra, añade el permiso voices_read a la clave o fija ELEVENLABS_VOICE_ID.",
      );
    }
  }

  const premade = voices.filter((voice) => voice.category === "premade");
  const voice =
    premade.find((entry) => speaks(entry, language)) ??
    voices.find((entry) => speaks(entry, language)) ??
    premade[0] ??
    voices[0] ??
    SHARED_VOICES[0];

  chosen.set(language, voice.voice_id);
  return voice.voice_id;
}

/* -------------------------------------------------------------------------- */
/*                                   Speech                                   */
/* -------------------------------------------------------------------------- */

/**
 * `language_code` is only accepted by the Turbo and Flash models; the
 * multilingual model infers the language from the text itself and rejects it.
 */
const takesLanguageCode = (model: string) => /turbo|flash/i.test(model);

export async function speak(
  text: string,
  language: string,
  speed = 1,
): Promise<Speech> {
  const spoken = text.trim();
  if (!spoken) throw new VoiceError("No hay nada que narrar.");

  const model = env().ELEVENLABS_MODEL_ID;
  const voiceId = await resolveVoice(language);

  const response = await call(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: spoken,
        model_id: model,
        ...(takesLanguageCode(model) ? { language_code: language } : {}),
        // Left out entirely at the default, so the voice keeps whatever
        // settings it was saved with.
        ...(speed === 1 ? {} : { voice_settings: { speed } }),
      }),
    },
  );

  const body = (await response.json()) as {
    audio_base64?: string;
    alignment?: Alignment;
  };

  const alignment = body.alignment;
  if (!body.audio_base64 || !alignment?.character_end_times_seconds?.length) {
    throw new VoiceError("El servicio de voz devolvió audio sin tiempos.");
  }

  const ends = alignment.character_end_times_seconds;
  return {
    audio: new Uint8Array(Buffer.from(body.audio_base64, "base64")),
    alignment,
    durationSeconds: ends[ends.length - 1],
    voiceId,
    speed,
  };
}

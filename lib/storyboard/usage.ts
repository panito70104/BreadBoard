/**
 * What a generation cost.
 *
 * The pipeline is about to grow from one Claude call to four — the art
 * director, the storyboard, the judge and the correction round — and "spending
 * more is fine if it buys quality" is only a decision anyone can make with the
 * numbers in front of them. So every call reports what it used, through an
 * optional sink the scripts pass in and production ignores.
 *
 * The cache is the part worth watching. Both system prompts are generated from
 * the catalogs, byte-stable, and cached for an hour: written once at 2x and
 * read back at a tenth of the price for the rest of a study session. A single
 * video pays the write and reads it back three times within the same run.
 */

import type Anthropic from "@anthropic-ai/sdk";

/** Which call in the pipeline a record belongs to. */
export type PipelineCall = "plan" | "storyboard" | "judge" | "critique";

export interface TokenUsage {
  input: number;
  output: number;
  /** Served from the cache, at a tenth of the input price. */
  cacheRead: number;
  /** Written to the cache. At a 1h TTL that is twice the input price. */
  cacheWrite: number;
}

export interface CallRecord extends TokenUsage {
  call: PipelineCall;
  model: string;
  /** Free-text tag: which scene, which attempt. */
  note?: string;
}

export type UsageSink = (record: CallRecord) => void;

const ZERO: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** Pulls the four numbers out of a response, whatever the SDK calls them. */
export function usageOf(response: { usage?: Anthropic.Usage | null }): TokenUsage {
  const usage = response.usage;
  if (!usage) return { ...ZERO };
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Money                                    */
/* -------------------------------------------------------------------------- */

/**
 * Dollars per million tokens, for the models this pipeline uses.
 *
 * A 1h cache write costs twice the input price (a 5-minute one costs 1.25x);
 * a cache read costs a tenth. The hour is what `generate.ts` asks for, and the
 * reason is in its comment: a study session outlives five minutes.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
};

const CACHE_WRITE_1H = 2;
const CACHE_READ = 0.1;

export function costOf(record: CallRecord): number {
  const price = PRICES[record.model];
  if (!price) return 0;
  return (
    (record.input * price.input +
      record.output * price.output +
      record.cacheWrite * price.input * CACHE_WRITE_1H +
      record.cacheRead * price.input * CACHE_READ) /
    1_000_000
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Collecting                                 */
/* -------------------------------------------------------------------------- */

export class UsageLedger {
  readonly records: CallRecord[] = [];

  readonly sink: UsageSink = (record) => {
    this.records.push(record);
  };

  byCall(): Map<PipelineCall, TokenUsage & { calls: number; usd: number }> {
    const totals = new Map<PipelineCall, TokenUsage & { calls: number; usd: number }>();
    for (const record of this.records) {
      const running = totals.get(record.call) ?? { ...ZERO, calls: 0, usd: 0 };
      totals.set(record.call, {
        input: running.input + record.input,
        output: running.output + record.output,
        cacheRead: running.cacheRead + record.cacheRead,
        cacheWrite: running.cacheWrite + record.cacheWrite,
        calls: running.calls + 1,
        usd: running.usd + costOf(record),
      });
    }
    return totals;
  }

  total(): TokenUsage & { calls: number; usd: number } {
    return this.records.reduce(
      (sum, record) => ({
        input: sum.input + record.input,
        output: sum.output + record.output,
        cacheRead: sum.cacheRead + record.cacheRead,
        cacheWrite: sum.cacheWrite + record.cacheWrite,
        calls: sum.calls + 1,
        usd: sum.usd + costOf(record),
      }),
      { ...ZERO, calls: 0, usd: 0 },
    );
  }

  /** A table, for the scripts that have to report this. */
  report(): string {
    const rows = [...this.byCall().entries()].map(([call, usage]) =>
      [
        call.padEnd(11),
        String(usage.calls).padStart(6),
        usage.input.toLocaleString("en").padStart(10),
        usage.output.toLocaleString("en").padStart(10),
        usage.cacheWrite.toLocaleString("en").padStart(12),
        usage.cacheRead.toLocaleString("en").padStart(11),
        `$${usage.usd.toFixed(4)}`.padStart(9),
      ].join(" "),
    );
    const total = this.total();

    return [
      "llamada      llamadas    entrada     salida  caché escr.  caché leí.     coste",
      ...rows,
      "-".repeat(76),
      [
        "TOTAL".padEnd(11),
        String(total.calls).padStart(6),
        total.input.toLocaleString("en").padStart(10),
        total.output.toLocaleString("en").padStart(10),
        total.cacheWrite.toLocaleString("en").padStart(12),
        total.cacheRead.toLocaleString("en").padStart(11),
        `$${total.usd.toFixed(4)}`.padStart(9),
      ].join(" "),
    ].join("\n");
  }
}

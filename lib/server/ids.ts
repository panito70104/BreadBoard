/** Every row id is a UUID; anything else cannot exist. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check before querying: Postgres rejects a malformed UUID with an error, which
 * would surface as a 500 instead of the 404 the caller deserves.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

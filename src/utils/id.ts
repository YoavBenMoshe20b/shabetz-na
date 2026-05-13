// ID generation — single seam between client + server.
//
// Today: crypto.randomUUID() when available, time+random fallback.
// Tomorrow: server-issued ids return through the api/ adapter and the
// client-generated id is replaced. The function signature stays.
//
// Why one function:
//   • Easy global swap when backend lands.
//   • Guarantees the prefix so debug logs are useful.
//   • Avoids `Date.now()` + `Math.random()` inline in render-adjacent code
//     (which triggers react-hooks/purity linting and is genuinely bad in
//     concurrent rendering).

const CRYPTO: Crypto | undefined =
  typeof globalThis !== 'undefined' && 'crypto' in globalThis ? (globalThis as { crypto?: Crypto }).crypto : undefined;

function uuid(): string {
  if (CRYPTO && 'randomUUID' in CRYPTO) {
    return CRYPTO.randomUUID();
  }
  // Time-anchored fallback — sufficient for client-side mock ids.
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${t}-${r}`;
}

/** Generate a domain-prefixed id. Examples: newId('mi') → 'mi-abc-12'. */
export function newId(prefix: string): string {
  return `${prefix}-${uuid()}`;
}

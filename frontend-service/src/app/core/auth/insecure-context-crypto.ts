/**
 * keycloak-js 26 builds the OAuth `state` with `crypto.randomUUID()`, an API that
 * browsers expose **only in a secure context** (HTTPS or localhost). The lab ALB
 * is HTTP-only, so on `http://<alb>` that call throws
 * "Web Crypto API is not available." inside `keycloak.init()` — before Keycloak
 * is ever contacted — and the login page reports
 * "Le serveur d'authentification est injoignable".
 *
 * `crypto.getRandomValues()` *is* available over plain HTTP and is a CSPRNG, so
 * this shim derives an RFC 4122 v4 UUID from it. The value only feeds the OAuth
 * state/nonce; no key material is derived from it.
 *
 * Once the app is served over HTTPS this shim becomes a no-op and can be
 * deleted (see `deploy/terraform/README.md`, "HTTP vs HTTPS").
 */

function uuidV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Version 4 (random) and RFC 4122 variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ensureRandomUuid(): void {
  if (typeof crypto === 'undefined') {
    return;
  }

  // Secure contexts already provide it; leave the native implementation alone.
  if (typeof crypto.randomUUID === 'function') {
    return;
  }

  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: uuidV4,
  });
}

ensureRandomUuid();

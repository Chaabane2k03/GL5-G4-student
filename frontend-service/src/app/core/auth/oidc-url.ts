export interface OidcLocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export function cleanedUrlWithoutOidcFragment(location: OidcLocationLike): string | null {
  if (!location.hash) {
    return null;
  }

  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const hasOidcFragment = fragment.has('state') || fragment.has('code');

  return hasOidcFragment ? `${location.pathname}${location.search}` : null;
}

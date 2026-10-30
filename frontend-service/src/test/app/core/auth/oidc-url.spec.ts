import { cleanedUrlWithoutOidcFragment } from '../../../../app/core/auth/oidc-url';

describe('cleanedUrlWithoutOidcFragment', () => {
  it('returns null when there is no fragment', () => {
    expect(
      cleanedUrlWithoutOidcFragment({
        pathname: '/tableau-de-bord',
        search: '',
        hash: '',
      }),
    ).toBeNull();
  });

  it('removes a Keycloak authorization fragment', () => {
    expect(
      cleanedUrlWithoutOidcFragment({
        pathname: '/tableau-de-bord',
        search: '?from=login',
        hash: '#state=abc&session_state=def&code=xyz',
      }),
    ).toBe('/tableau-de-bord?from=login');
  });

  it('keeps unrelated fragments untouched', () => {
    expect(
      cleanedUrlWithoutOidcFragment({
        pathname: '/etudiants',
        search: '',
        hash: '#section=details',
      }),
    ).toBeNull();
  });
});

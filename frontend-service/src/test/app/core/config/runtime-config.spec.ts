import { ConfigService, provideRuntimeConfig } from '../../../../app/core/config/runtime-config';

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => body,
  }) as Response;

describe('ConfigService', () => {
  let service: ConfigService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    service = new ConfigService();
    fetchSpy = spyOn(window, 'fetch');
  });

  it('loads and exposes a complete runtime configuration', async () => {
    fetchSpy.and.resolveTo(
      jsonResponse({
        apiBaseUrl: ' http://gateway.test ',
        keycloak: {
          url: 'http://keycloak.test',
          realm: 'gl5',
          clientId: 'cursus-frontend',
          pkceMethod: false,
        },
      }),
    );

    const loaded = await service.load();

    expect(loaded).toBeTrue();
    expect(fetchSpy).toHaveBeenCalledWith('/config.json', { cache: 'no-cache' });
    expect(service.apiBaseUrl).toBe('http://gateway.test');
    expect(service.keycloak).toEqual({
      url: 'http://keycloak.test',
      realm: 'gl5',
      clientId: 'cursus-frontend',
      pkceMethod: false,
    });
    expect(service.current.apiBaseUrl).toBe('http://gateway.test');
    expect(service.loadError()).toBeNull();
  });

  it('keeps an undefined pkce method when it is not configured', async () => {
    fetchSpy.and.resolveTo(
      jsonResponse({
        apiBaseUrl: 'http://gateway.test',
        keycloak: {
          url: 'http://keycloak.test',
          realm: 'gl5',
          clientId: 'cursus-frontend',
        },
      }),
    );

    expect(await service.load()).toBeTrue();
    expect(service.keycloak.pkceMethod).toBeUndefined();
  });

  it('rejects a non-success HTTP response', async () => {
    fetchSpy.and.resolveTo(jsonResponse({}, false, 503));

    expect(await service.load()).toBeFalse();
    expect(service.loadError()).toContain('HTTP 503');
    expect(service.apiBaseUrl).toBe('');
    expect(service.keycloak.url).toBe('');
  });

  it('rejects an incomplete configuration', async () => {
    fetchSpy.and.resolveTo(
      jsonResponse({
        apiBaseUrl: '',
        keycloak: {
          url: '',
          realm: 'gl5',
          clientId: 'cursus-frontend',
        },
      }),
    );

    expect(await service.load()).toBeFalse();
    expect(service.loadError()).toContain('configuration');
    expect(service.current.apiBaseUrl).toBe('');
  });

  it('rejects a configuration without keycloak', async () => {
    fetchSpy.and.resolveTo(jsonResponse({ apiBaseUrl: 'http://gateway.test' }));

    expect(await service.load()).toBeFalse();
    expect(service.loadError()).toContain('configuration');
  });

  it('captures JSON parsing failures', async () => {
    fetchSpy.and.resolveTo({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json');
      },
    } as unknown as Response);

    expect(await service.load()).toBeFalse();
    expect(service.loadError()).toBe('invalid json');
  });

  it('captures unknown failures with a stable message', async () => {
    fetchSpy.and.rejectWith('network down');

    expect(await service.load()).toBeFalse();
    expect(service.loadError()).toBe('erreur inconnue');
  });

  it('provideRuntimeConfig returns configured environment providers', () => {
    const providers = provideRuntimeConfig();
    expect(providers).toBeDefined();
  });
});

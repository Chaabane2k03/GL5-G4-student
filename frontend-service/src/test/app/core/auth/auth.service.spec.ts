import { TestBed } from '@angular/core/testing';
import Keycloak, { type KeycloakInitOptions } from 'keycloak-js';
import { ConfigService, KeycloakConfig } from '../../../../app/core/config/runtime-config';
import { AuthService, UserProfile } from '../../../../app/core/auth/auth.service';

interface AuthServiceInternals {
  keycloakInstance: Keycloak | null;
  createKeycloak: (kcConfig: { url: string; realm: string; clientId: string }) => Keycloak;
  extractUserProfile: () => void;
}

interface KeycloakFake {
  token?: string;
  refreshToken?: string;
  tokenParsed?: Record<string, unknown>;
  init: jasmine.Spy;
  login: jasmine.Spy;
  logout: jasmine.Spy;
  updateToken: jasmine.Spy;
  isTokenExpired: jasmine.Spy;
}

const keycloakConfig: KeycloakConfig = {
  url: 'http://keycloak.test',
  realm: 'gl5',
  clientId: 'cursus-frontend',
  pkceMethod: 'S256',
};

const createKeycloakFake = (): KeycloakFake => ({
  token: 'jwt-token',
  refreshToken: 'refresh-token',
  tokenParsed: {
    given_name: 'Ada',
    family_name: 'Lovelace',
    email: 'ada@example.com',
    preferred_username: 'ada',
  },
  init: jasmine.createSpy('init').and.resolveTo(true),
  login: jasmine.createSpy('login').and.resolveTo(),
  logout: jasmine.createSpy('logout').and.resolveTo(),
  updateToken: jasmine.createSpy('updateToken').and.resolveTo(true),
  isTokenExpired: jasmine.createSpy('isTokenExpired').and.returnValue(false),
});

const installKeycloak = (service: AuthService, keycloak: KeycloakFake): void => {
  (service as unknown as AuthServiceInternals).keycloakInstance = keycloak as unknown as Keycloak;
};

describe('AuthService', () => {
  let service: AuthService;
  let config: { keycloak: KeycloakConfig; load: jasmine.Spy };

  beforeEach(() => {
    config = {
      keycloak: { ...keycloakConfig },
      load: jasmine.createSpy('load').and.resolveTo(true),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: config }],
    });

    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('exposes the configured authorization server and greeting name', () => {
    expect(service.authServerUrl()).toBe('http://keycloak.test');

    service.currentUser.set({
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
    } as UserProfile);

    expect(service.greetingName()).toBe('Ada');
  });

  it('fails closed when Keycloak configuration is missing', async () => {
    config.keycloak = { url: '', realm: '', clientId: '' };

    expect(await service.init()).toBeFalse();
    expect(service.isInitialized()).toBeTrue();
    expect(service.isKeycloakAvailable()).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('initializes an authenticated SSO session and extracts the profile', async () => {
    const keycloak = createKeycloakFake();
    spyOn(service as unknown as AuthServiceInternals, 'createKeycloak').and.returnValue(keycloak as unknown as Keycloak);
    keycloak.init.and.callFake((options: KeycloakInitOptions) => {
      expect(options.onLoad).toBe('check-sso');
      expect(options.silentCheckSsoRedirectUri).toContain('/silent-check-sso.html');
      keycloak.token = 'jwt-token';
      keycloak.tokenParsed = {
        given_name: 'Ada',
        family_name: 'Lovelace',
        email: 'ada@example.com',
        preferred_username: 'ada',
      };
      return Promise.resolve(true);
    });

    expect(await service.init()).toBeTrue();
    expect(keycloak.init).toHaveBeenCalled();
    expect(service.isInitialized()).toBeTrue();
    expect(service.isKeycloakAvailable()).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.token()).toBe('jwt-token');
    expect(service.currentUser()).toEqual({
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
    });
  });

  it('initializes without SSO checks when requested', async () => {
    const keycloak = createKeycloakFake();
    spyOn(service as unknown as AuthServiceInternals, 'createKeycloak').and.returnValue(keycloak as unknown as Keycloak);
    keycloak.init.and.callFake((options: KeycloakInitOptions) => {
      expect(options.onLoad).toBeUndefined();
      expect(options.silentCheckSsoRedirectUri).toBeUndefined();
      return Promise.resolve(false);
    });

    expect(await service.init(false)).toBeFalse();
    expect(keycloak.init).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('marks Keycloak unavailable when initialization fails', async () => {
    const keycloak = createKeycloakFake();
    spyOn(service as unknown as AuthServiceInternals, 'createKeycloak').and.returnValue(keycloak as unknown as Keycloak);
    keycloak.init.and.rejectWith(new Error('connection refused'));

    expect(await service.init()).toBeFalse();
    expect(service.isInitialized()).toBeTrue();
    expect(service.isKeycloakAvailable()).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('extracts partial and fallback profiles', () => {
    const internals = service as unknown as AuthServiceInternals;

    internals.keycloakInstance = {
      tokenParsed: { given_name: 'Ada' },
    } as unknown as Keycloak;
    internals.extractUserProfile();
    expect(service.currentUser()?.fullName).toBe('Ada');

    internals.keycloakInstance = {
      tokenParsed: { preferred_username: 'admin' },
    } as unknown as Keycloak;
    internals.extractUserProfile();
    expect(service.currentUser()?.fullName).toBe('admin');

    internals.keycloakInstance = { tokenParsed: {} } as unknown as Keycloak;
    internals.extractUserProfile();
    expect(service.currentUser()?.username).toBe('admin');

    service.currentUser.set(null);
    internals.keycloakInstance = {} as unknown as Keycloak;
    internals.extractUserProfile();
    expect(service.currentUser()).toBeNull();
  });

  it('does not login when Keycloak cannot be initialized', async () => {
    spyOn(service, 'init').and.resolveTo(false);

    await service.login();

    expect(service.init).toHaveBeenCalledWith(false);
  });

  it('redirects to Keycloak login with the dashboard return URL', async () => {
    const keycloak = createKeycloakFake();
    installKeycloak(service, keycloak);

    await service.login();

    expect(keycloak.login).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/tableau-de-bord`,
    });
  });

  it('marks Keycloak unavailable when the login redirect fails', async () => {
    const keycloak = createKeycloakFake();
    keycloak.login.and.rejectWith(new Error('redirect failed'));
    installKeycloak(service, keycloak);

    await service.login();

    expect(service.isKeycloakAvailable()).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('clears the local session and calls Keycloak logout', async () => {
    const keycloak = createKeycloakFake();
    installKeycloak(service, keycloak);
    service.isAuthenticated.set(true);
    service.token.set('jwt-token');
    service.currentUser.set({ username: 'ada', fullName: 'Ada Lovelace' });

    await service.logout();

    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/connexion`,
    });
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('returns null when no Keycloak session exists', async () => {
    expect(await service.updateToken()).toBeNull();
  });

  it('returns null when the user is not authenticated', async () => {
    installKeycloak(service, createKeycloakFake());

    expect(await service.updateToken()).toBeNull();
  });

  it('keeps a still-valid access token when no refresh token exists', async () => {
    const keycloak = createKeycloakFake();
    keycloak.refreshToken = undefined;
    keycloak.token = 'still-valid';
    keycloak.isTokenExpired.and.returnValue(false);
    installKeycloak(service, keycloak);
    service.isAuthenticated.set(true);

    expect(await service.updateToken()).toBe('still-valid');
    expect(keycloak.isTokenExpired).toHaveBeenCalledWith(30);
  });

  it('expires the session when no refresh token exists and the token is expired', async () => {
    const keycloak = createKeycloakFake();
    keycloak.refreshToken = undefined;
    keycloak.isTokenExpired.and.returnValue(true);
    installKeycloak(service, keycloak);
    service.isAuthenticated.set(true);

    expect(await service.updateToken()).toBeNull();
    expect(service.isSessionExpired()).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token()).toBeNull();
  });

  it('stores a refreshed access token', async () => {
    const keycloak = createKeycloakFake();
    keycloak.updateToken.and.resolveTo(true);
    keycloak.token = 'refreshed';
    installKeycloak(service, keycloak);
    service.isAuthenticated.set(true);
    service.token.set('old');

    expect(await service.updateToken(10)).toBe('refreshed');
    expect(keycloak.updateToken).toHaveBeenCalledWith(10);
    expect(service.token()).toBe('refreshed');
  });

  it('returns the current token when Keycloak does not refresh it', async () => {
    const keycloak = createKeycloakFake();
    keycloak.updateToken.and.resolveTo(false);
    keycloak.token = 'current';
    installKeycloak(service, keycloak);
    service.isAuthenticated.set(true);
    service.token.set('old');

    expect(await service.updateToken()).toBe('current');
    expect(service.token()).toBe('old');
  });

  it('expires the session when token refresh rejects', async () => {
    const keycloak = createKeycloakFake();
    keycloak.updateToken.and.rejectWith(new Error('refresh failed'));
    installKeycloak(service, keycloak);
    service.isAuthenticated.set(true);

    expect(await service.updateToken()).toBeNull();
    expect(service.isSessionExpired()).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('retries configuration loading and initialization', async () => {
    spyOn(service, 'init').and.resolveTo(true);

    expect(await service.retryConnection()).toBeTrue();
    expect(config.load).toHaveBeenCalled();
    expect(service.init).toHaveBeenCalled();
  });

  it('closes the expired-session modal', () => {
    service.isSessionExpired.set(true);

    service.closeSessionExpiredModal();

    expect(service.isSessionExpired()).toBeFalse();
  });

  it('covers createKeycloak directly and logout fallback when Keycloak throws', async () => {
    const keycloak = (service as unknown as AuthServiceInternals).createKeycloak({ url: 'http://keycloak.test', realm: 'gl5', clientId: 'test' });
    expect(keycloak).toBeDefined();

    const navSpy = spyOn(service, 'navigateToLogin').and.stub();

    const fake = createKeycloakFake();
    fake.logout.and.rejectWith(new Error('Logout network failure'));
    installKeycloak(service, fake);
    service.isKeycloakAvailable.set(true);
    await service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(navSpy).toHaveBeenCalled();

    // Keycloak unavailable branch
    service.isKeycloakAvailable.set(false);
    await service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(navSpy).toHaveBeenCalledTimes(2);
  });

  it('covers remaining user profile branches, pkce disabled, and token null fallbacks', async () => {
    // user without firstName
    service.currentUser.set({ username: 'jdoe', fullName: 'John Doe' });
    expect(service.greetingName()).toBe('');

    const fake = createKeycloakFake();
    spyOn(service as unknown as AuthServiceInternals, 'createKeycloak').and.returnValue(fake as unknown as Keycloak);
    installKeycloak(service, fake);

    fake.tokenParsed = { given_name: 'Marie' };
    (service as unknown as AuthServiceInternals).extractUserProfile();
    expect(service.currentUser()?.fullName).toBe('Marie');

    fake.tokenParsed = { preferred_username: 'superadmin' };
    (service as unknown as AuthServiceInternals).extractUserProfile();
    expect(service.currentUser()?.fullName).toBe('superadmin');

    fake.tokenParsed = {};
    (service as unknown as AuthServiceInternals).extractUserProfile();
    expect(service.currentUser()?.fullName).toBe('admin');

    // pkceMethod === false
    config.keycloak.pkceMethod = false;
    fake.init.and.resolveTo(true);
    fake.token = undefined;
    await service.init();
    expect(service.token()).toBeNull();

    // updateToken with still-valid access token but token is undefined
    fake.refreshToken = undefined;
    fake.token = undefined;
    fake.isTokenExpired.and.returnValue(false);
    expect(await service.updateToken()).toBeNull();

    // updateToken with refreshed false and token undefined
    fake.refreshToken = 'rt';
    fake.updateToken.and.resolveTo(false);
    expect(await service.updateToken()).toBeNull();
  });
});

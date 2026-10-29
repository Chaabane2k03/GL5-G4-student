import { computed, inject, Injectable, signal } from '@angular/core';
import Keycloak, { type KeycloakInitOptions } from 'keycloak-js';
import { ConfigService } from '../config/runtime-config';

export interface UserProfile {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly configService = inject(ConfigService);

  private keycloakInstance: Keycloak | null = null;

  // Signaux réactifs d'état d'authentification
  readonly isInitialized = signal<boolean>(false);
  readonly isAuthenticated = signal<boolean>(false);
  readonly isKeycloakAvailable = signal<boolean>(true);
  readonly isSessionExpired = signal<boolean>(false);
  readonly token = signal<string | null>(null);
  readonly currentUser = signal<UserProfile | null>(null);

  readonly authServerUrl = computed(() => this.configService.keycloak.url);

  // Prénom pour la salutation du tableau de bord
  readonly greetingName = computed(() => {
    const user = this.currentUser();
    return user?.firstName || '';
  });

  async init(checkSso = true): Promise<boolean> {
    const kcConfig = this.configService.keycloak;

    if (!kcConfig.url || !kcConfig.realm || !kcConfig.clientId) {
      console.error("Configuration Keycloak absente : le serveur d'authentification est injoignable.");
      this.keycloakInstance = null;
      this.isKeycloakAvailable.set(false);
      this.isAuthenticated.set(false);
      this.token.set(null);
      this.currentUser.set(null);
      this.isInitialized.set(true);
      return false;
    }

    try {
      this.keycloakInstance = new Keycloak({
        url: kcConfig.url,
        realm: kcConfig.realm,
        clientId: kcConfig.clientId,
      });

      const initOptions: KeycloakInitOptions = {
        // Authorization Code flow, always. Over plain HTTP the browser exposes
        // neither crypto.subtle (PKCE S256) nor — before the shim — randomUUID,
        // so PKCE is disabled there. Code flow without PKCE is still the right
        // choice: unlike implicit, Keycloak returns a *refresh token*, which is
        // what lets keycloak-js renew the access token silently every few
        // minutes. Implicit flow never issues one, so `updateToken()` threw
        // "no refresh token available" on the first API call and the shell
        // showed the "Session administrative expirée" dialog right after login.
        flow: 'standard',
        checkLoginIframe: false,
        enableLogging: false,
        pkceMethod: kcConfig.pkceMethod === false ? false : 'S256',
      };

      if (checkSso) {
        initOptions.onLoad = 'check-sso';
        initOptions.silentCheckSsoRedirectUri = `${window.location.origin}/silent-check-sso.html`;
      }

      const authenticated = await this.keycloakInstance.init(initOptions);

      this.isKeycloakAvailable.set(true);
      this.isAuthenticated.set(authenticated);

      if (authenticated) {
        this.token.set(this.keycloakInstance.token || null);
        this.extractUserProfile();
      }

      this.isInitialized.set(true);
      return authenticated;
    } catch (error) {
      console.error("Le serveur d'authentification est injoignable.", error);
      this.keycloakInstance = null;
      this.isKeycloakAvailable.set(false);
      this.isAuthenticated.set(false);
      this.token.set(null);
      this.currentUser.set(null);
      this.isInitialized.set(true);
      return false;
    }
  }

  async retryConnection(): Promise<boolean> {
    this.isInitialized.set(false);
    await this.configService.load();
    return this.init();
  }

  async login(): Promise<void> {
    if (!this.keycloakInstance) {
      await this.init(false);
    }
    if (!this.keycloakInstance || !this.isKeycloakAvailable()) {
      return;
    }
    try {
      await this.keycloakInstance.login({
        redirectUri: `${window.location.origin}/tableau-de-bord`,
      });
    } catch (error) {
      console.error('Erreur lors de la redirection vers Keycloak:', error);
      this.isKeycloakAvailable.set(false);
      this.isAuthenticated.set(false);
    }
  }

  async logout(): Promise<void> {
    this.isAuthenticated.set(false);
    this.token.set(null);
    this.currentUser.set(null);

    if (this.keycloakInstance && this.isKeycloakAvailable()) {
      try {
        await this.keycloakInstance.logout({
          redirectUri: `${window.location.origin}/connexion`,
        });
      } catch {
        window.location.href = '/connexion';
      }
    } else {
      window.location.href = '/connexion';
    }
  }

  async updateToken(minValidity = 30): Promise<string | null> {
    if (!this.keycloakInstance || !this.isAuthenticated()) {
      return null;
    }
    try {
      // Defensive: with implicit flow Keycloak issues no refresh token, and
      // keycloak-js then rejects *every* updateToken() call — even while the
      // access token is still valid. The auth interceptor calls this on each
      // API request, so that rejection used to open the "Session
      // administrative expirée" dialog as soon as the dashboard loaded. Keep
      // the current token while it is usable and only report a real expiry.
      if (!this.keycloakInstance.refreshToken) {
        if (!this.keycloakInstance.isTokenExpired(minValidity)) {
          return this.keycloakInstance.token ?? null;
        }
        throw new Error('Aucun jeton de rafraîchissement disponible');
      }

      const refreshed = await this.keycloakInstance.updateToken(minValidity);
      if (refreshed) {
        this.token.set(this.keycloakInstance.token || null);
      }
      return this.keycloakInstance.token || null;
    } catch (error) {
      console.warn('Expiration du jeton Keycloak, session expirée:', error);
      this.isAuthenticated.set(false);
      this.token.set(null);
      this.isSessionExpired.set(true);
      return null;
    }
  }

  closeSessionExpiredModal(): void {
    this.isSessionExpired.set(false);
  }

  private extractUserProfile(): void {
    if (!this.keycloakInstance?.tokenParsed) {
      return;
    }
    const parsed = this.keycloakInstance.tokenParsed as Record<string, unknown>;
    const firstName = (parsed['given_name'] as string) || '';
    const lastName = (parsed['family_name'] as string) || '';
    const email = (parsed['email'] as string) || '';
    const username = (parsed['preferred_username'] as string) || 'admin';
    const fullName =
      firstName && lastName ? `${firstName} ${lastName}` : firstName || username || 'Administrateur';

    this.currentUser.set({
      username,
      email,
      firstName,
      lastName,
      fullName,
    });
  }
}

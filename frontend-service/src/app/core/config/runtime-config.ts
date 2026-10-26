import { makeEnvironmentProviders, provideAppInitializer, signal } from '@angular/core';

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  keycloak: KeycloakConfig;
}

const EMPTY_CONFIG: RuntimeConfig = {
  apiBaseUrl: '',
  keycloak: {
    url: '',
    realm: '',
    clientId: '',
  },
};

/**
 * Charge la configuration d'exécution servie par `/config.json`.
 * En conteneur, ce fichier est généré à partir des variables d'environnement.
 * Aucune valeur d'environnement n'est codée en dur ici.
 */
export class ConfigService {
  private config: RuntimeConfig = EMPTY_CONFIG;

  readonly loadError = signal<string | null>(null);

  get current(): RuntimeConfig {
    return this.config;
  }

  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  get keycloak(): KeycloakConfig {
    return this.config.keycloak;
  }

  async load(): Promise<boolean> {
    try {
      const response = await fetch('/config.json', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as Partial<RuntimeConfig>;
      const apiBaseUrl = data.apiBaseUrl?.trim();
      const keycloak = data.keycloak;

      if (!apiBaseUrl || !keycloak?.url || !keycloak.realm || !keycloak.clientId) {
        throw new Error('configuration incomplète');
      }

      this.config = {
        apiBaseUrl,
        keycloak: {
          url: keycloak.url,
          realm: keycloak.realm,
          clientId: keycloak.clientId,
        },
      };
      this.loadError.set(null);
      return true;
    } catch (error) {
      this.config = EMPTY_CONFIG;
      const message = error instanceof Error ? error.message : 'erreur inconnue';
      this.loadError.set(message);
      console.error(`Impossible de charger /config.json : ${message}`);
      return false;
    }
  }
}

export function provideRuntimeConfig() {
  const configService = new ConfigService();

  return makeEnvironmentProviders([
    { provide: ConfigService, useValue: configService },
    provideAppInitializer(async () => {
      await configService.load();
    }),
  ]);
}

import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ConfigService } from '../../core/config/runtime-config';
import { ButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="connexion-canvas">
      <main class="connexion-card" role="main">
        <header class="connexion-header">
          <div class="seal-emblem" aria-hidden="true">
            <svg viewBox="0 0 48 48" class="seal-svg">
              <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2" />
              <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="1" />
              <path d="M24 8 L36 15 L24 22 L12 15 Z" fill="currentColor" opacity="0.9" />
              <path d="M16 20.5 V28 C16 32 24 35 24 35 C24 35 32 32 32 28 V20.5" fill="none" stroke="currentColor" stroke-width="1.5" />
              <line x1="36" y1="15" x2="36" y2="27" stroke="currentColor" stroke-width="1.5" />
              <circle cx="36" cy="28" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <h1 class="institution-title">CURSUS</h1>
          <p class="institution-subtitle">Registre d'Administration Académique</p>
        </header>

        <section class="connexion-body">
          @if (!authService.isKeycloakAvailable()) {
            <div class="alert-box error" role="alert">
              <span class="material-symbols-outlined alert-icon" aria-hidden="true">cloud_off</span>
              <div class="alert-content">
                <strong class="alert-title">Le serveur d'authentification est injoignable.</strong>
                <p class="alert-message">
                  @if (configService.loadError()) {
                    Configuration d'exécution indisponible (/config.json).
                  } @else {
                    Aucune réponse de Keycloak ({{ authService.authServerUrl() }}). Vérifiez que le service est démarré.
                  }
                </p>
              </div>
            </div>

            <div class="action-stack">
              <app-button
                variant="primary"
                size="lg"
                icon="refresh"
                [fullWidth]="true"
                [loading]="retrying()"
                (clicked)="retryKeycloak()"
              >
                Réessayer
              </app-button>
            </div>
          } @else {
            <p class="connexion-prompt">
              Accès réservé aux administrateurs de l'établissement. Veuillez vous authentifier via le guichet unique universitaire.
            </p>

            <div class="action-stack">
              <app-button
                variant="primary"
                size="lg"
                icon="lock"
                [fullWidth]="true"
                [loading]="connecting()"
                (clicked)="connect()"
              >
                Se connecter
              </app-button>
            </div>
          }
        </section>

        <footer class="connexion-footer">
          <span class="footer-copy">Université — Tous droits d'accès réservés</span>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .connexion-canvas {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background-color: var(--color-canvas-bg);
      background-image: radial-gradient(var(--color-border-hairline) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    .connexion-card {
      width: 100%;
      max-width: 440px;
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      padding: 2.5rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.75rem;
    }

    .connexion-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .seal-emblem {
      width: 64px;
      height: 64px;
      color: var(--color-primary-container);
      margin-bottom: 0.5rem;
    }

    .seal-svg {
      width: 100%;
      height: 100%;
    }

    .institution-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-lg);
      font-weight: 700;
      color: var(--color-primary);
      letter-spacing: 0.12em;
      margin: 0;
    }

    .institution-subtitle {
      font-family: var(--font-family-body);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .connexion-body {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .connexion-prompt {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
      line-height: 1.5;
      margin: 0;
    }

    .alert-box {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: var(--radius-md);
      text-align: left;
      font-size: var(--font-size-body-sm);

      &.error {
        background-color: var(--status-failed-bg);
        border: 1px solid rgba(186, 26, 26, 0.3);
        color: var(--status-failed-border);
      }

      &.info {
        background-color: var(--color-surface-subtle);
        border: 1px solid var(--color-border-hairline);
        color: var(--color-text-main);

        .alert-icon {
          color: var(--color-primary-container);
        }
      }

      .alert-icon {
        font-size: 20px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .alert-title {
        display: block;
        font-weight: 600;
        margin-bottom: 0.125rem;
      }

      .alert-message {
        margin: 0;
        font-size: var(--font-size-caption);
      }
    }

    .action-stack {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }

    .connexion-footer {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
      border-top: 1px solid var(--color-border-hairline);
      padding-top: 1.25rem;
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnexionComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly configService = inject(ConfigService);
  private readonly router = inject(Router);

  readonly retrying = signal<boolean>(false);
  readonly connecting = signal<boolean>(false);

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate(['/tableau-de-bord']);
    }
  }

  @HostListener('window:pageshow')
  onPageShow(): void {
    this.connecting.set(false);
    this.retrying.set(false);
  }

  async retryKeycloak(): Promise<void> {
    this.retrying.set(true);
    try {
      await this.authService.retryConnection();
      if (this.authService.isAuthenticated()) {
        void this.router.navigate(['/tableau-de-bord']);
      }
    } finally {
      this.retrying.set(false);
    }
  }

  async connect(): Promise<void> {
    this.connecting.set(true);
    try {
      await this.authService.login();
    } finally {
      this.connecting.set(false);
    }
  }
}

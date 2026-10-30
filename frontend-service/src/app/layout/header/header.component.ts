import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AvatarComponent],
  template: `
    <header class="app-header" role="banner">
      <div class="header-inner">
        <!-- Marque institutionnelle -->
        <div class="brand-zone">
          <a routerLink="/tableau-de-bord" class="brand-link" aria-label="Accueil Cursus">
            <div class="brand-seal" aria-hidden="true">
              <svg viewBox="0 0 32 32" class="seal-svg">
                <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.5" />
                <path d="M16 6 L24 11 L16 16 L8 11 Z" fill="currentColor" />
                <path d="M10 15 V20 C10 23 16 25 16 25 C16 25 22 23 22 20 V15" fill="none" stroke="currentColor" stroke-width="1.2" />
              </svg>
            </div>
            <div class="brand-text">
              <span class="brand-title">CURSUS</span>
              <span class="brand-subtitle">Registre Académique</span>
            </div>
          </a>
        </div>

        <!-- Navigation principale -->
        <nav class="main-nav" role="navigation" aria-label="Navigation principale">
          <a
            routerLink="/tableau-de-bord"
            routerLinkActive="active"
            class="nav-item"
          >
            <span class="material-symbols-outlined nav-icon" aria-hidden="true">dashboard</span>
            <span class="nav-label">Tableau de bord</span>
          </a>
          <a
            routerLink="/departements"
            routerLinkActive="active"
            class="nav-item"
          >
            <span class="material-symbols-outlined nav-icon" aria-hidden="true">apartment</span>
            <span class="nav-label">Départements</span>
          </a>
          <a
            routerLink="/cours"
            routerLinkActive="active"
            class="nav-item"
          >
            <span class="material-symbols-outlined nav-icon" aria-hidden="true">menu_book</span>
            <span class="nav-label">Cours</span>
          </a>
          <a
            routerLink="/etudiants"
            routerLinkActive="active"
            class="nav-item"
          >
            <span class="material-symbols-outlined nav-icon" aria-hidden="true">group</span>
            <span class="nav-label">Étudiants</span>
          </a>
          <a
            routerLink="/inscriptions"
            routerLinkActive="active"
            class="nav-item"
          >
            <span class="material-symbols-outlined nav-icon" aria-hidden="true">assignment</span>
            <span class="nav-label">Inscriptions</span>
          </a>
        </nav>

        <!-- Actions rapides & Profil -->
        <div class="header-actions">
          <!-- Déclencheur recherche globale (Ctrl+K) -->
          <button
            type="button"
            class="global-search-btn"
            (click)="searchTriggered.emit()"
            aria-label="Recherche globale (Ctrl+K)"
          >
            <span class="material-symbols-outlined search-btn-icon" aria-hidden="true">search</span>
            <span class="search-btn-label">Rechercher...</span>
            <kbd class="shortcut-badge">Ctrl K</kbd>
          </button>

          <!-- Profil administrateur et déconnexion -->
          <div class="user-profile-menu">
            <button
              type="button"
              class="user-btn"
              (click)="toggleMenu()"
              [attr.aria-expanded]="menuOpen()"
              aria-haspopup="menu"
              aria-label="Menu du profil administrateur"
            >
              <app-avatar [name]="userName()" size="sm"></app-avatar>
              <div class="user-info">
                <span class="user-name">{{ userName() }}</span>
                <span class="user-role">Administrateur</span>
              </div>
              <span class="material-symbols-outlined dropdown-arrow" aria-hidden="true">arrow_drop_down</span>
            </button>

            @if (menuOpen()) {
              <div class="dropdown-panel" role="menu">
                <div class="panel-header">
                  <span class="panel-greeting">Connecté en tant que</span>
                  <span class="panel-email">{{ userEmail() }}</span>
                </div>
                <div class="panel-divider"></div>
                <button
                  type="button"
                  class="panel-item danger"
                  role="menuitem"
                  (click)="onLogout()"
                >
                  <span class="material-symbols-outlined item-icon" aria-hidden="true">logout</span>
                  <span>Déconnexion</span>
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background-color: var(--color-surface-pure);
      border-bottom: 1px solid var(--color-border-hairline);
      box-shadow: var(--shadow-sm);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-inner {
      max-width: 1360px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .brand-zone {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .brand-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: inherit;
    }

    .brand-seal {
      width: 34px;
      height: 34px;
      color: var(--color-primary-container);
    }

    .seal-svg {
      width: 100%;
      height: 100%;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-family: var(--font-family-display);
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--color-primary);
      letter-spacing: 0.1em;
      line-height: 1.1;
    }

    .brand-subtitle {
      font-family: var(--font-family-body);
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .main-nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
      margin-left: 1rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-md);
      font-size: var(--font-size-body-sm);
      font-weight: 500;
      color: var(--color-text-muted);
      text-decoration: none;
      transition: background-color var(--transition-fast), color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-text-main);
      }

      &.active {
        background-color: var(--color-surface-subtle);
        color: var(--color-primary-container);
        font-weight: 600;

        .nav-icon {
          color: var(--color-primary-container);
        }
      }
    }

    .nav-icon {
      font-size: 18px;
      color: var(--color-text-subtle);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      flex-shrink: 0;
    }

    .global-search-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      font-family: var(--font-family-body);
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
      cursor: pointer;
      transition: border-color var(--transition-fast), background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-pure);
        border-color: var(--color-border-strong);
        color: var(--color-text-main);
      }
    }

    .search-btn-icon {
      font-size: 16px;
    }

    .shortcut-badge {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-micro);
      padding: 0.1rem 0.35rem;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-xs);
      color: var(--color-text-muted);
    }

    .user-profile-menu {
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-md);
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
      }
    }

    .user-info {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .user-name {
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-text-main);
      line-height: 1.2;
    }

    .user-role {
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
      line-height: 1.1;
    }

    .dropdown-arrow {
      font-size: 18px;
      color: var(--color-text-subtle);
    }

    .dropdown-panel {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      width: 220px;
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: 0.5rem 0;
      display: flex;
      flex-direction: column;
      animation: fadeIn var(--transition-fast) ease-out;
    }

    .panel-header {
      padding: 0.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .panel-greeting {
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .panel-email {
      font-size: var(--font-size-caption);
      color: var(--color-text-main);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel-divider {
      height: 1px;
      background-color: var(--color-border-hairline);
      margin: 0.375rem 0;
    }

    .panel-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
      background: transparent;
      border: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-subtle);
      }

      &.danger {
        color: var(--status-failed-border);

        .item-icon {
          color: var(--status-failed-border);
        }

        &:hover {
          background-color: var(--status-failed-bg);
        }
      }

      .item-icon {
        font-size: 18px;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly searchTriggered = output<void>();

  readonly menuOpen = signal<boolean>(false);

  readonly userName = () => this.authService.currentUser()?.fullName || 'Administrateur';
  readonly userEmail = () => this.authService.currentUser()?.email || '';

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-profile-menu')) {
      this.menuOpen.set(false);
    }
  }

  async onLogout(): Promise<void> {
    this.menuOpen.set(false);
    await this.authService.logout();
  }
}

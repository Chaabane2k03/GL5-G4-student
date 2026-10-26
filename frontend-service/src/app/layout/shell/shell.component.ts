import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HeaderComponent } from '../header/header.component';
import { SearchOverlayComponent } from '../../features/search/search-overlay.component';
import { SnackbarComponent } from '../../shared/ui/snackbar/snackbar.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    SearchOverlayComponent,
    SnackbarComponent,
    ModalComponent,
    ButtonComponent,
  ],
  template: `
    <div class="shell-layout">
      <!-- En-tête de navigation -->
      <app-header (searchTriggered)="openSearch()"></app-header>

      <!-- Corps principal de l'application -->
      <main class="shell-main" role="main">
        <router-outlet></router-outlet>
      </main>

      <!-- Recherche globale rapide (Ctrl+K) -->
      <app-search-overlay
        [isOpen]="isSearchOpen()"
        (closed)="closeSearch()"
      ></app-search-overlay>

      <!-- Système de notifications éphémères (Snackbar) -->
      <app-snackbar></app-snackbar>

      <!-- Boîte de dialogue de session expirée -->
      <app-modal
        [isOpen]="authService.isSessionExpired()"
        title="Session administrative expirée"
        badge="Sécurité Keycloak"
        size="sm"
        [closeOnBackdrop]="false"
        (closed)="reconnect()"
      >
        <p class="session-expired-msg">
          Votre jeton d'authentification a expiré par mesure de sécurité académique. Veuillez renouveler votre session pour poursuivre vos actes d'administration.
        </p>

        <div modal-footer class="session-expired-actions">
          <app-button
            variant="primary"
            size="md"
            icon="login"
            (clicked)="reconnect()"
          >
            Se reconnecter
          </app-button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .shell-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: var(--color-canvas-bg);
    }

    .shell-main {
      flex: 1;
      width: 100%;
      max-width: 1360px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .session-expired-msg {
      margin: 0;
      color: var(--color-text-main);
      font-size: var(--font-size-body-md);
      line-height: 1.5;
    }

    .session-expired-actions {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly authService = inject(AuthService);

  readonly isSearchOpen = signal<boolean>(false);

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggleSearch();
    }
  }

  openSearch(): void {
    this.isSearchOpen.set(true);
  }

  closeSearch(): void {
    this.isSearchOpen.set(false);
  }

  toggleSearch(): void {
    this.isSearchOpen.update((open) => !open);
  }

  async reconnect(): Promise<void> {
    this.authService.closeSessionExpiredModal();
    await this.authService.login();
  }
}

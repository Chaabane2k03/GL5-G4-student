import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="status-page-canvas">
      <main class="status-page-card" role="main">
        <div class="status-code">404</div>
        <div class="status-icon-wrap" aria-hidden="true">
          <span class="material-symbols-outlined status-icon">folder_off</span>
        </div>
        <h1 class="status-title">Acte introuvable</h1>
        <p class="status-description">
          Le registre, cours ou dossier étudiant recherché n'existe pas dans le système d'archives universitaires ou a été déplacé.
        </p>

        <div class="status-actions">
          <app-button
            variant="primary"
            size="md"
            icon="home"
            (clicked)="goToDashboard()"
          >
            Retourner au tableau de bord
          </app-button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .status-page-canvas {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background-color: var(--color-canvas-bg);
    }

    .status-page-card {
      max-width: 500px;
      width: 100%;
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: 3rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .status-code {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-headline-lg);
      font-weight: 700;
      color: var(--color-text-subtle);
      letter-spacing: 0.1em;
      margin-bottom: 0.5rem;
    }

    .status-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: var(--color-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      margin-bottom: 1.25rem;

      .status-icon {
        font-size: 32px;
      }
    }

    .status-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-md);
      color: var(--color-text-headline);
      margin: 0 0 0.75rem 0;
    }

    .status-description {
      font-size: var(--font-size-body-md);
      color: var(--color-text-muted);
      margin: 0 0 2rem 0;
      line-height: 1.5;
    }

    .status-actions {
      display: flex;
      justify-content: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  private readonly router = inject(Router);

  goToDashboard(): void {
    this.router.navigate(['/tableau-de-bord']);
  }
}

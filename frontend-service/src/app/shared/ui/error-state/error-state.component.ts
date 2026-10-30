import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="error-state" role="alert" aria-live="assertive">
      <div class="error-icon-wrap">
        <span class="material-symbols-outlined error-icon" aria-hidden="true">error_outline</span>
      </div>
      <h3 class="error-title">{{ title() }}</h3>
      <p class="error-message">{{ message() }}</p>

      @if (detail()) {
        <div class="error-detail">
          <span class="detail-label">Détail technique :</span>
          <code>{{ detail() }}</code>
        </div>
      }

      @if (showRetry()) {
        <div class="error-action">
          <app-button
            variant="outline"
            size="md"
            icon="refresh"
            [loading]="retrying()"
            (clicked)="retry.emit()"
          >
            {{ retryLabel() }}
          </app-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .error-state {
      padding: 3rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background-color: var(--color-surface-paper);
      border: 1px solid rgba(186, 26, 26, 0.3);
      border-radius: var(--radius-lg);
      margin: 1.5rem 0;
      box-shadow: var(--shadow-sm);
    }

    .error-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background-color: var(--status-failed-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--status-failed-border);
      margin-bottom: 1rem;

      .error-icon {
        font-size: 28px;
      }
    }

    .error-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-sm);
      color: var(--status-failed-border);
      margin: 0 0 0.5rem 0;
      font-weight: 600;
    }

    .error-message {
      font-size: var(--font-size-body-md);
      color: var(--color-text-main);
      max-width: 480px;
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .error-detail {
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      padding: 0.5rem 0.75rem;
      margin-bottom: 1.25rem;
      max-width: 500px;
      text-align: left;
      font-size: var(--font-size-caption);

      .detail-label {
        font-weight: 600;
        color: var(--color-text-muted);
        display: block;
        margin-bottom: 0.25rem;
      }

      code {
        font-family: var(--font-family-mono);
        color: var(--status-failed-text);
        word-break: break-all;
      }
    }

    .error-action {
      display: flex;
      justify-content: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly title = input<string>('Impossible de charger les données');
  readonly message = input<string>('Le service universitaire est temporairement indisponible ou a retourné une erreur.');
  readonly detail = input<string | null>(null);
  readonly showRetry = input<boolean>(true);
  readonly retryLabel = input<string>('Réessayer');
  readonly retrying = input<boolean>(false);

  readonly retry = output<void>();
}

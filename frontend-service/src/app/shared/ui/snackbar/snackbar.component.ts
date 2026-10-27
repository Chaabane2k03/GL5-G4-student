import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SnackbarMessage, SnackbarService } from './snackbar.service';

@Component({
  selector: 'app-snackbar',
  standalone: true,
  template: `
    <div class="snackbar-container" aria-live="polite" aria-atomic="true">
      @for (toast of snackbarService.messages(); track toast.id) {
        <div class="snackbar-toast" [class]="'toast-' + toast.type" role="status">
          <div class="toast-icon-wrap">
            <span class="material-symbols-outlined toast-icon" aria-hidden="true">
              @switch (toast.type) {
                @case ('success') { check_circle }
                @case ('error') { error }
                @case ('warning') { warning }
                @default { info }
              }
            </span>
          </div>

          <div class="toast-message">
            {{ toast.message }}
          </div>

          @if (toast.action) {
            <button
              type="button"
              class="toast-action-btn"
              (click)="onAction(toast)"
            >
              {{ toast.action.label }}
            </button>
          }

          <button
            type="button"
            class="toast-dismiss-btn"
            (click)="onDismiss(toast.id)"
            aria-label="Fermer la notification"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .snackbar-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 440px;
      pointer-events: none;
    }

    .snackbar-toast {
      pointer-events: auto;
      background-color: var(--color-surface-pure);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border-hairline);
      box-shadow: var(--shadow-lg);
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: slideUp var(--transition-normal) cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toast-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .toast-icon {
        font-size: 20px;
      }
    }

    .toast-message {
      flex: 1;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
      line-height: 1.4;
    }

    .toast-action-btn {
      background: transparent;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-xs);
      padding: 0.25rem 0.5rem;
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-primary-container);
      cursor: pointer;
      white-space: nowrap;
      transition: background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
      }
    }

    .toast-dismiss-btn {
      color: var(--color-text-subtle);
      padding: 0.125rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-xs);
      cursor: pointer;

      &:hover {
        color: var(--color-text-main);
      }

      .material-symbols-outlined {
        font-size: 16px;
      }
    }

    // Variantes
    .toast-success {
      border-left: 4px solid var(--color-primary-container);
      .toast-icon {
        color: var(--color-primary-container);
      }
    }

    .toast-error {
      border-left: 4px solid var(--status-failed-border);
      .toast-icon {
        color: var(--status-failed-border);
      }
    }

    .toast-warning {
      border-left: 4px solid var(--status-dropped-border);
      .toast-icon {
        color: var(--status-dropped-border);
      }
    }

    .toast-info {
      border-left: 4px solid var(--dept-tone-2);
      .toast-icon {
        color: var(--dept-tone-2);
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SnackbarComponent {
  readonly snackbarService = inject(SnackbarService);

  onAction(toast: SnackbarMessage): void {
    if (toast.action) {
      toast.action.callback();
      this.snackbarService.dismiss(toast.id);
    }
  }

  onDismiss(id: string): void {
    this.snackbarService.dismiss(id);
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="'btn btn-' + variant() + ' btn-' + size() + (fullWidth() ? ' btn-block' : '')"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <span class="btn-spinner" aria-hidden="true"></span>
      } @else if (icon()) {
        <span class="material-symbols-outlined btn-icon" aria-hidden="true">{{ icon() }}</span>
      }
      <span class="btn-label"><ng-content></ng-content></span>
    </button>
  `,
  styles: [`
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border-radius: var(--radius-md);
      font-family: var(--font-family-body);
      font-weight: 600;
      line-height: 1.25;
      white-space: nowrap;
      transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
      cursor: pointer;
      user-select: none;
      text-decoration: none;

      &:focus-visible {
        outline: 2px solid var(--color-primary-container);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-block {
      width: 100%;
    }

    // Tailles
    .btn-sm {
      padding: 0.375rem 0.75rem;
      font-size: var(--font-size-caption);
    }
    .btn-md {
      padding: 0.5rem 1rem;
      font-size: var(--font-size-body-sm);
    }
    .btn-lg {
      padding: 0.75rem 1.5rem;
      font-size: var(--font-size-body-md);
    }

    // Variantes
    .btn-primary {
      background-color: var(--color-primary-container);
      color: var(--color-on-primary);
      border: 1px solid transparent;
      box-shadow: var(--shadow-sm);

      &:hover:not(:disabled) {
        background-color: var(--color-primary-hover);
      }
      &:active:not(:disabled) {
        background-color: var(--color-primary-active);
      }
    }

    .btn-secondary {
      background-color: var(--color-secondary-container);
      color: var(--color-on-secondary);
      border: 1px solid transparent;

      &:hover:not(:disabled) {
        background-color: var(--color-secondary-hover);
      }
    }

    .btn-outline {
      background-color: var(--color-surface-paper);
      color: var(--color-text-main);
      border: 1px solid var(--color-border-hairline);
      box-shadow: var(--shadow-sm);

      &:hover:not(:disabled) {
        background-color: var(--color-surface-hover);
        border-color: var(--color-text-muted);
      }
    }

    .btn-text {
      background-color: transparent;
      color: var(--color-text-muted);
      border: 1px solid transparent;

      &:hover:not(:disabled) {
        background-color: var(--color-surface-subtle);
        color: var(--color-text-main);
      }
    }

    .btn-danger {
      background-color: var(--status-failed-border);
      color: #ffffff;
      border: 1px solid transparent;

      &:hover:not(:disabled) {
        background-color: #93000a;
      }
    }

    .btn-icon {
      font-size: 1.125em;
    }

    .btn-spinner {
      width: 1em;
      height: 1em;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly icon = input<string | null>(null);
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);

  readonly clicked = output<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal
      [isOpen]="isOpen()"
      [title]="title()"
      [badge]="badge()"
      size="sm"
      (closed)="onCancel()"
    >
      <div class="confirm-content">
        @if (icon()) {
          <div class="confirm-icon-wrap" [class.danger]="variant() === 'danger'">
            <span class="material-symbols-outlined confirm-icon" aria-hidden="true">{{ icon() }}</span>
          </div>
        }
        <div class="confirm-message-group">
          <p class="confirm-message">{{ message() }}</p>
          @if (warning()) {
            <p class="confirm-warning">
              <span class="material-symbols-outlined warning-icon" aria-hidden="true">warning</span>
              <span>{{ warning() }}</span>
            </p>
          }
        </div>
      </div>

      <div modal-footer class="confirm-actions">
        <app-button variant="outline" (clicked)="onCancel()">
          {{ cancelLabel() }}
        </app-button>
        <app-button
          [variant]="variant() === 'danger' ? 'danger' : 'primary'"
          [loading]="loading()"
          (clicked)="onConfirm()"
        >
          {{ confirmLabel() }}
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .confirm-content {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .confirm-icon-wrap {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background-color: var(--color-surface-subtle);
      color: var(--color-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border-hairline);

      &.danger {
        background-color: var(--status-failed-bg);
        color: var(--status-failed-border);
        border-color: rgba(186, 26, 26, 0.2);
      }

      .confirm-icon {
        font-size: 24px;
      }
    }

    .confirm-message-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .confirm-message {
      margin: 0;
      color: var(--color-text-main);
      font-size: var(--font-size-body-md);
      line-height: 1.5;
    }

    .confirm-warning {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--font-size-caption);
      color: var(--status-failed-border);
      font-weight: 600;

      .warning-icon {
        font-size: 16px;
      }
    }

    .confirm-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('Confirmation');
  readonly badge = input<string | null>('Attention requise');
  readonly message = input<string>('');
  readonly warning = input<string | null>(null);
  readonly confirmLabel = input<string>('Confirmer');
  readonly cancelLabel = input<string>('Annuler');
  readonly variant = input<'primary' | 'danger'>('primary');
  readonly icon = input<string | null>('help');
  readonly loading = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  onConfirm(): void {
    if (!this.loading()) {
      this.confirmed.emit();
    }
  }

  onCancel(): void {
    if (!this.loading()) {
      this.cancelled.emit();
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="onBackdropClick($event)" (keydown.escape)="onClose()" role="dialog" aria-modal="true" [attr.aria-label]="title()" tabindex="-1">
        <div class="modal-card" [class.modal-card-lg]="size() === 'lg'" [class.modal-card-sm]="size() === 'sm'">
          <header class="modal-header">
            <div class="modal-title-group">
              @if (badge()) {
                <span class="modal-badge">{{ badge() }}</span>
              }
              <h2 class="modal-title">{{ title() }}</h2>
            </div>
            <button
              type="button"
              class="modal-close-btn"
              (click)="onClose()"
              aria-label="Fermer la boîte de dialogue"
            >
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </header>

          <div class="modal-body">
            <ng-content></ng-content>
          </div>

          @if (showFooter()) {
            <footer class="modal-footer">
              <ng-content select="[modal-footer]"></ng-content>
            </footer>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1050;
      background-color: rgba(42, 36, 32, 0.45);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn var(--transition-normal) ease-out;
    }

    .modal-card {
      position: relative;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-overlay);
      width: 100%;
      max-width: 560px;
      max-height: calc(100vh - 3rem);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scaleIn var(--transition-normal) cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-card-sm {
      max-width: 440px;
    }

    .modal-card-lg {
      max-width: 760px;
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      background-color: var(--color-surface-subtle);
      border-bottom: 1px solid var(--color-border-hairline);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .modal-title-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .modal-badge {
      font-size: var(--font-size-caption);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      font-weight: 600;
    }

    .modal-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-md);
      color: var(--color-text-headline);
      margin: 0;
      line-height: 1.25;
    }

    .modal-close-btn {
      padding: 0.25rem;
      border-radius: var(--radius-sm);
      color: var(--color-text-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color var(--transition-fast), color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-text-main);
      }
    }

    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      color: var(--color-text-main);
      font-size: var(--font-size-body-md);
      line-height: 1.5;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      background-color: var(--color-surface-subtle);
      border-top: 1px solid var(--color-border-hairline);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(4px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly badge = input<string | null>(null);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showFooter = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);

  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closed.emit();
  }
}

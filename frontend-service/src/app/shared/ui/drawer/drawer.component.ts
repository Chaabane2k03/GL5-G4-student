import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-drawer',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="drawer-container" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <!-- Toile de fond lavis d'encre sombre -->
        <div class="drawer-backdrop" (click)="onBackdropClick()" aria-hidden="true"></div>

        <!-- Panneau latéral droit 480px papier chaud -->
        <aside class="drawer-panel" #drawerPanel>
          <header class="drawer-header">
            <div class="drawer-title-group">
              <span class="drawer-badge" aria-hidden="true">
                <span class="badge-dot"></span>
                <span>{{ subtitle() }}</span>
              </span>
              <h2 class="drawer-title">{{ title() }}</h2>
            </div>
            <button
              type="button"
              class="drawer-close-btn"
              (click)="onClose()"
              aria-label="Fermer le panneau"
            >
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </header>

          <div class="drawer-body">
            <ng-content></ng-content>
          </div>

          <footer class="drawer-footer">
            <ng-content select="[drawer-footer]"></ng-content>
          </footer>
        </aside>
      </div>
    }
  `,
  styles: [`
    .drawer-container {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
    }

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(42, 36, 32, 0.4);
      backdrop-filter: blur(2px);
      animation: fadeIn var(--transition-normal) ease-out;
    }

    .drawer-panel {
      position: relative;
      z-index: 1001;
      width: 100%;
      max-width: 480px;
      height: 100%;
      background-color: var(--color-surface-paper);
      border-left: 1px solid var(--color-border-hairline);
      box-shadow: var(--shadow-overlay);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      animation: slideIn var(--transition-normal) cubic-bezier(0.16, 1, 0.3, 1);
    }

    .drawer-header {
      padding: 1.25rem 1.5rem;
      background-color: var(--color-surface-subtle);
      border-bottom: 1px solid var(--color-border-hairline);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .drawer-title-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .drawer-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--font-size-caption);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      font-weight: 600;

      .badge-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--color-primary-container);
      }
    }

    .drawer-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-md);
      color: var(--color-text-headline);
      margin: 0;
      line-height: 1.25;
    }

    .drawer-close-btn {
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

    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .drawer-footer {
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

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly subtitle = input<string>('Acte administratif');

  readonly closed = output<void>();

  private readonly panelRef = viewChild<ElementRef>('drawerPanel');

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  onBackdropClick(): void {
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }
}

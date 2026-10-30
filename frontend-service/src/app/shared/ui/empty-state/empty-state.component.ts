import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="empty-state" role="status">
      <div class="empty-icon-wrap">
        <span class="material-symbols-outlined empty-icon" aria-hidden="true">{{ icon() }}</span>
      </div>
      <h3 class="empty-title">{{ title() }}</h3>
      <p class="empty-message">{{ message() }}</p>

      @if (actionLabel()) {
        <div class="empty-action">
          <app-button
            variant="primary"
            size="md"
            [icon]="actionIcon()"
            (clicked)="action.emit()"
          >
            {{ actionLabel() }}
          </app-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      padding: 3.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background-color: var(--color-surface-paper);
      border: 1px dashed var(--color-border-hairline);
      border-radius: var(--radius-lg);
      margin: 1rem 0;
    }

    .empty-icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-subtle);
      margin-bottom: 1rem;

      .empty-icon {
        font-size: 28px;
      }
    }

    .empty-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-sm);
      color: var(--color-text-headline);
      margin: 0 0 0.5rem 0;
      font-weight: 600;
    }

    .empty-message {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      max-width: 420px;
      margin: 0 0 1.25rem 0;
      line-height: 1.5;
    }

    .empty-action {
      display: flex;
      justify-content: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inventory_2');
  readonly title = input<string>('Aucun enregistrement');
  readonly message = input<string>('Aucune donnée ne correspond aux critères de consultation.');
  readonly actionLabel = input<string | null>(null);
  readonly actionIcon = input<string | null>(null);

  readonly action = output<void>();
}

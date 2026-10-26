import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @if (type() === 'table-rows') {
      <div class="skeleton-table" aria-hidden="true">
        @for (i of rowArray(); track i) {
          <div class="skeleton-table-row">
            <div class="skeleton-shimmer skeleton-cell-badge"></div>
            <div class="skeleton-shimmer skeleton-cell-title"></div>
            <div class="skeleton-shimmer skeleton-cell-meta"></div>
            <div class="skeleton-shimmer skeleton-cell-action"></div>
          </div>
        }
      </div>
    } @else if (type() === 'card') {
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-header"></div>
        <div class="skeleton-shimmer skeleton-card-line"></div>
        <div class="skeleton-shimmer skeleton-card-line short"></div>
      </div>
    } @else if (type() === 'metric') {
      <div class="skeleton-metric" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-metric-label"></div>
        <div class="skeleton-shimmer skeleton-metric-value"></div>
      </div>
    } @else {
      <div
        class="skeleton-shimmer skeleton-line"
        [style.width]="width()"
        [style.height]="height()"
        aria-hidden="true"
      ></div>
    }
  `,
  styles: [`
    .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        var(--color-surface-subtle) 25%,
        var(--color-surface-muted) 50%,
        var(--color-surface-subtle) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite ease-in-out;
      border-radius: var(--radius-sm);
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    .skeleton-table {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .skeleton-table-row {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem 1.25rem;
      background-color: var(--color-surface-paper);
      border-bottom: 1px solid var(--color-border-hairline);
    }

    .skeleton-cell-badge {
      width: 70px;
      height: 24px;
    }

    .skeleton-cell-title {
      flex: 2;
      height: 20px;
    }

    .skeleton-cell-meta {
      flex: 1;
      height: 18px;
    }

    .skeleton-cell-action {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }

    .skeleton-card {
      padding: 1.25rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .skeleton-card-header {
      width: 60%;
      height: 24px;
    }

    .skeleton-card-line {
      width: 100%;
      height: 16px;

      &.short {
        width: 40%;
      }
    }

    .skeleton-metric {
      padding: 1.25rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .skeleton-metric-label {
      width: 50%;
      height: 14px;
    }

    .skeleton-metric-value {
      width: 35%;
      height: 32px;
    }

    .skeleton-line {
      display: inline-block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly type = input<'line' | 'table-rows' | 'card' | 'metric'>('line');
  readonly rows = input<number>(5);
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');

  readonly rowArray = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}

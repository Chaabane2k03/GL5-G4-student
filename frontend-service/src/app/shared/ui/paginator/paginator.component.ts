import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginator',
  standalone: true,
  template: `
    <nav class="paginator" role="navigation" aria-label="Pagination des registres">
      <div class="paginator-summary">
        <span class="summary-text">
          Affichage de <strong>{{ startItem() }}</strong> à <strong>{{ endItem() }}</strong> sur <strong>{{ totalElements() }}</strong>
          @if (totalElements() <= 1) {
            enregistrement
          } @else {
            enregistrements
          }
        </span>
      </div>

      <div class="paginator-controls">
        <div class="page-size-selector">
          <label [for]="'page-size-' + id()" class="size-label">Par page :</label>
          <select
            [id]="'page-size-' + id()"
            class="size-select"
            [value]="pageSize()"
            (change)="onPageSizeChange($event)"
            aria-label="Nombre d'éléments par page"
          >
            @for (size of pageSizeOptions(); track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
        </div>

        <div class="nav-buttons">
          <button
            type="button"
            class="nav-btn"
            [disabled]="isFirstPage()"
            (click)="onPrevious()"
            aria-label="Page précédente"
          >
            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            <span class="btn-text">Précédent</span>
          </button>

          <span class="page-indicator" aria-current="page">
            Page {{ currentPageDisplay() }} / {{ totalPagesDisplay() }}
          </span>

          <button
            type="button"
            class="nav-btn"
            [disabled]="isLastPage()"
            (click)="onNext()"
            aria-label="Page suivante"
          >
            <span class="btn-text">Suivant</span>
            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .paginator {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.875rem 1.25rem;
      background-color: var(--color-surface-paper);
      border-top: 1px solid var(--color-border-hairline);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      flex-wrap: wrap;
    }

    .paginator-summary {
      strong {
        color: var(--color-text-main);
        font-weight: 600;
      }
    }

    .paginator-controls {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .page-size-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .size-label {
        font-size: var(--font-size-caption);
        color: var(--color-text-subtle);
      }

      .size-select {
        padding: 0.25rem 0.5rem;
        background-color: var(--color-surface-pure);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-caption);
        color: var(--color-text-main);
        cursor: pointer;

        &:focus {
          outline: 2px solid var(--color-primary-container);
          outline-offset: 1px;
        }
      }
    }

    .nav-buttons {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.625rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      color: var(--color-text-main);
      font-size: var(--font-size-caption);
      font-weight: 600;
      cursor: pointer;
      transition: background-color var(--transition-fast), border-color var(--transition-fast);

      &:hover:not(:disabled) {
        background-color: var(--color-surface-hover);
        border-color: var(--color-text-muted);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .material-symbols-outlined {
        font-size: 16px;
      }
    }

    .page-indicator {
      padding: 0 0.5rem;
      font-size: var(--font-size-caption);
      font-weight: 500;
      color: var(--color-text-main);
      white-space: nowrap;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginatorComponent {
  private static nextId = 0;
  readonly id = () => `pg-${++PaginatorComponent.nextId}`;

  readonly page = input<number>(0); // 0-indexed
  readonly pageSize = input<number>(20);
  readonly totalElements = input<number>(0);
  readonly pageSizeOptions = input<number[]>([10, 20, 50, 100]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly totalPages = computed(() => {
    const total = this.totalElements();
    const size = this.pageSize();
    if (total === 0 || size <= 0) return 1;
    return Math.ceil(total / size);
  });

  readonly currentPageDisplay = computed(() => this.page() + 1);
  readonly totalPagesDisplay = computed(() => Math.max(1, this.totalPages()));

  readonly isFirstPage = computed(() => this.page() <= 0);
  readonly isLastPage = computed(() => this.page() >= this.totalPages() - 1);

  readonly startItem = computed(() => {
    if (this.totalElements() === 0) return 0;
    return this.page() * this.pageSize() + 1;
  });

  readonly endItem = computed(() => {
    const end = (this.page() + 1) * this.pageSize();
    return Math.min(end, this.totalElements());
  });

  onPrevious(): void {
    if (!this.isFirstPage()) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  onNext(): void {
    if (!this.isLastPage()) {
      this.pageChange.emit(this.page() + 1);
    }
  }

  onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newSize = Number.parseInt(target.value, 10);
    if (!Number.isNaN(newSize)) {
      this.pageSizeChange.emit(newSize);
    }
  }
}

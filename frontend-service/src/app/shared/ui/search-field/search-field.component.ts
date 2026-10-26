import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-search-field',
  standalone: true,
  template: `
    <div class="search-field-wrap" [class.focused]="isFocused">
      <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
      <input
        #inputRef
        type="search"
        class="search-input"
        [value]="value()"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() || placeholder()"
        (input)="onInput($event)"
        (focus)="isFocused = true"
        (blur)="isFocused = false"
      />
      @if (value()) {
        <button
          type="button"
          class="clear-btn"
          (click)="onClear()"
          aria-label="Effacer la recherche"
        >
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      } @else if (shortcut()) {
        <kbd class="shortcut-tag">{{ shortcut() }}</kbd>
      }
    </div>
  `,
  styles: [`
    .search-field-wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      padding: 0.4375rem 0.75rem;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      width: 100%;

      &.focused {
        border-color: var(--color-border-focus);
        box-shadow: 0 0 0 1px var(--color-border-focus);
      }
    }

    .search-icon {
      font-size: 18px;
      color: var(--color-text-subtle);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      font-family: var(--font-family-body);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
      outline: none;

      &::placeholder {
        color: var(--color-text-disabled);
      }

      &::-webkit-search-cancel-button {
        display: none;
      }
    }

    .clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.125rem;
      border-radius: var(--radius-xs);
      color: var(--color-text-subtle);
      cursor: pointer;

      &:hover {
        color: var(--color-text-main);
      }

      .material-symbols-outlined {
        font-size: 16px;
      }
    }

    .shortcut-tag {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-micro);
      padding: 0.125rem 0.375rem;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-xs);
      color: var(--color-text-subtle);
      font-weight: 500;
      user-select: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFieldComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('Rechercher...');
  readonly ariaLabel = input<string | null>(null);
  readonly shortcut = input<string | null>(null);

  readonly valueChange = output<string>();

  readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputRef');

  isFocused = false;

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.valueChange.emit(val);
  }

  onClear(): void {
    this.valueChange.emit('');
    this.inputElement()?.nativeElement.focus();
  }

  focus(): void {
    this.inputElement()?.nativeElement.focus();
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getDepartmentColorIndex } from '../../../core/utils/academic-metrics';

@Component({
  selector: 'app-department-tag',
  standalone: true,
  template: `
    <span class="dept-tag">
      <span
        class="dept-marker"
        [style.background-color]="markerColor()"
        aria-hidden="true"
      ></span>
      <span class="dept-name">{{ name() }}</span>
    </span>
  `,
  styles: [`
    .dept-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
      white-space: nowrap;
    }

    .dept-marker {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dept-name {
      font-weight: 500;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentTagComponent {
  readonly departmentId = input.required<number>();
  readonly name = input.required<string>();

  private readonly deptColors = [
    'var(--dept-tone-0)',
    'var(--dept-tone-1)',
    'var(--dept-tone-2)',
    'var(--dept-tone-3)',
    'var(--dept-tone-4)',
    'var(--dept-tone-5)',
    'var(--dept-tone-6)',
  ];

  readonly markerColor = computed(() => {
    const idx = getDepartmentColorIndex(this.departmentId());
    return this.deptColors[idx] || 'var(--color-primary-container)';
  });
}

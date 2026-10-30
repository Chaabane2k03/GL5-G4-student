import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CourseStatus } from '../../../domain/course.model';
import { EnrollmentStatus } from '../../../domain/enrollment.model';

export type StatusValue = CourseStatus | EnrollmentStatus;

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span [class]="'badge badge-' + normalizedStatus()">
      <span class="badge-dot" aria-hidden="true"></span>
      <span class="badge-text">{{ label() }}</span>
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-caption);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
      line-height: 1.35;
      border: 1px solid transparent;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    // Enrollment: En cours / Course: Active
    .badge-active {
      background-color: var(--status-active-bg);
      color: var(--status-active-text);
      border-color: var(--status-active-border);
      .badge-dot { background-color: var(--status-active-dot); }
    }

    // Enrollment: Validée
    .badge-completed {
      background-color: var(--status-completed-bg);
      color: var(--status-completed-text);
      border-color: var(--status-completed-border);
      .badge-dot { background-color: var(--status-completed-dot); }
    }

    // Enrollment: Échouée
    .badge-failed {
      background-color: var(--status-failed-bg);
      color: var(--status-failed-text);
      border-color: var(--status-failed-border);
      .badge-dot { background-color: var(--status-failed-dot); }
    }

    // Enrollment: Abandonnée
    .badge-dropped {
      background-color: var(--status-dropped-bg);
      color: var(--status-dropped-text);
      border-color: var(--status-dropped-border);
      .badge-dot { background-color: var(--status-dropped-dot); }
    }

    // Enrollment: Retrait administratif
    .badge-withdrawn {
      background-color: var(--status-withdrawn-bg);
      color: var(--status-withdrawn-text);
      border-color: var(--status-withdrawn-border);
      .badge-dot { background-color: var(--status-withdrawn-dot); }
    }

    // Course: Archivée
    .badge-archived {
      background-color: var(--color-surface-subtle);
      color: var(--color-text-subtle);
      border-color: var(--color-border-hairline);
      .badge-dot { background-color: var(--color-text-disabled); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusValue | null | undefined>();
  readonly context = input<'course' | 'enrollment'>('course');
  readonly customLabel = input<string | null>(null);

  readonly normalizedStatus = computed(() => {
    return this.status()?.toLowerCase() ?? 'unknown';
  });

  readonly label = computed(() => {
    if (this.customLabel()) {
      return this.customLabel();
    }
    const isCourse = this.context() === 'course';
    switch (this.status()) {
      case 'ACTIVE':
        return isCourse ? 'Actif' : 'En cours';
      case 'COMPLETED':
        return isCourse ? 'Validé' : 'Validée';
      case 'FAILED':
        return 'Échouée';
      case 'DROPPED':
        return 'Abandonnée';
      case 'WITHDRAWN':
        return 'Retrait admin.';
      case 'ARCHIVED':
        return 'Archivée';
      default:
        return this.status() ?? 'Inconnu';
    }
  });
}

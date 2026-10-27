import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DepartmentApi } from '../../api/department/department.api';
import { StudentApi } from '../../api/student/student.api';
import { CourseApi } from '../../api/course/course.api';
import { Department } from '../../domain/department.model';
import { Student } from '../../domain/student.model';
import { Course } from '../../domain/course.model';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-search-overlay',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    @if (isOpen()) {
      <div
        class="search-backdrop"
        (click)="onBackdropClick($event)"
        (keydown.escape)="onClose()"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale dans les registres académiques"
      >
        <div class="search-modal">
          <header class="search-header">
            <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
            <input
              #searchInput
              type="search"
              class="search-input"
              placeholder="Rechercher un cours, étudiant ou département..."
              [value]="query()"
              (input)="onQueryChange($event)"
              (keydown)="onInputKeydown($event)"
              aria-label="Requête de recherche globale"
            />
            <button type="button" class="shortcut-esc-btn" (click)="onClose()" aria-label="Fermer">
              <kbd class="shortcut-esc">Échap</kbd>
            </button>
          </header>

          <div class="search-results">
            @if (loading()) {
              <div class="search-loading">
                <span class="spinner" aria-hidden="true"></span>
                <span>Recherche dans les archives universitaires...</span>
              </div>
            } @else if (!query().trim()) {
              <div class="search-hint">
                <span class="material-symbols-outlined hint-icon" aria-hidden="true">manage_search</span>
                <p>Saisissez un code de cours (ex: <code>INFO101</code>), le nom d'un étudiant ou d'un département.</p>
              </div>
            } @else if (isEmpty()) {
              <div class="search-empty">
                <span class="material-symbols-outlined empty-icon" aria-hidden="true">search_off</span>
                <p>Aucun résultat correspondant à « <strong>{{ query() }}</strong> » dans les registres.</p>
              </div>
            } @else {
              <!-- Départements -->
              @if (matchingDepartments().length > 0) {
                <div class="result-section">
                  <div class="section-title">Départements ({{ matchingDepartments().length }})</div>
                  @for (dept of matchingDepartments(); track dept.id) {
                    <div
                      class="result-item"
                      tabindex="0"
                      role="button"
                      (click)="navigateTo('/departements/' + dept.id)"
                      (keydown.enter)="navigateTo('/departements/' + dept.id)"
                    >
                      <div class="item-icon-box dept">
                        <span class="material-symbols-outlined" aria-hidden="true">apartment</span>
                      </div>
                      <div class="item-content">
                        <span class="item-title">{{ dept.name }}</span>
                        <span class="item-meta">{{ dept.head }} &bull; {{ dept.location }}</span>
                      </div>
                      <span class="material-symbols-outlined item-arrow" aria-hidden="true">chevron_right</span>
                    </div>
                  }
                </div>
              }

              <!-- Cours -->
              @if (matchingCourses().length > 0) {
                <div class="result-section">
                  <div class="section-title">Cours ({{ matchingCourses().length }})</div>
                  @for (course of matchingCourses(); track course.id) {
                    <div
                      class="result-item"
                      tabindex="0"
                      role="button"
                      (click)="navigateTo('/cours/' + course.id)"
                      (keydown.enter)="navigateTo('/cours/' + course.id)"
                    >
                      <div class="item-icon-box course">
                        <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
                      </div>
                      <div class="item-content">
                        <div class="item-title-row">
                          <span class="course-code">{{ course.code }}</span>
                          <span class="item-title">{{ course.title }}</span>
                        </div>
                        <span class="item-meta">{{ course.credits }} crédits ECTS</span>
                      </div>
                      <app-status-badge [status]="course.status"></app-status-badge>
                    </div>
                  }
                </div>
              }

              <!-- Étudiants -->
              @if (matchingStudents().length > 0) {
                <div class="result-section">
                  <div class="section-title">Étudiants ({{ matchingStudents().length }})</div>
                  @for (student of matchingStudents(); track student.id) {
                    <div
                      class="result-item"
                      tabindex="0"
                      role="button"
                      (click)="navigateTo('/etudiants/' + student.id)"
                      (keydown.enter)="navigateTo('/etudiants/' + student.id)"
                    >
                      <div class="item-icon-box student">
                        <span class="material-symbols-outlined" aria-hidden="true">person</span>
                      </div>
                      <div class="item-content">
                        <span class="item-title">{{ student.firstName }} {{ student.lastName }}</span>
                        <span class="item-meta">{{ student.email }} &bull; Matricule #{{ student.id }}</span>
                      </div>
                      <span class="material-symbols-outlined item-arrow" aria-hidden="true">chevron_right</span>
                    </div>
                  }
                </div>
              }
            }
          </div>

          <footer class="search-footer">
            <span class="footer-tip"><kbd>↑</kbd> <kbd>↓</kbd> pour naviguer</span>
            <span class="footer-tip"><kbd>Entrée</kbd> pour sélectionner</span>
            <span class="footer-tip"><kbd>Échap</kbd> pour fermer</span>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .search-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1500;
      background-color: rgba(42, 36, 32, 0.45);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 4rem 1.5rem 2rem;
      animation: fadeIn var(--transition-fast) ease-out;
    }

    .search-modal {
      width: 100%;
      max-width: 640px;
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-overlay);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 80vh;
      animation: slideDown var(--transition-fast) cubic-bezier(0.16, 1, 0.3, 1);
    }

    .search-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--color-border-hairline);
      background-color: var(--color-surface-paper);
    }

    .search-icon {
      font-size: 22px;
      color: var(--color-text-subtle);
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-family: var(--font-family-body);
      font-size: var(--font-size-body-md);
      color: var(--color-text-main);
      background: transparent;

      &::placeholder {
        color: var(--color-text-disabled);
      }
    }

    .shortcut-esc {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-micro);
      padding: 0.2rem 0.4rem;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-xs);
      color: var(--color-text-subtle);
      cursor: pointer;
    }

    .search-results {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 0;
    }

    .search-loading,
    .search-hint,
    .search-empty {
      padding: 3rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: var(--color-text-muted);
      font-size: var(--font-size-body-sm);
      text-align: center;
    }

    .hint-icon,
    .empty-icon {
      font-size: 32px;
      color: var(--color-text-subtle);
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--color-border-hairline);
      border-top-color: var(--color-primary-container);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .result-section {
      margin-bottom: 0.75rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .section-title {
      font-size: var(--font-size-caption);
      font-weight: 700;
      color: var(--color-text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0.5rem 1.25rem 0.25rem;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1.25rem;
      cursor: pointer;
      transition: background-color var(--transition-fast);

      &:hover,
      &:focus-visible {
        background-color: var(--color-surface-subtle);
        outline: none;
      }
    }

    .item-icon-box {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.dept {
        background-color: rgba(94, 130, 102, 0.15);
        color: var(--color-primary-container);
      }
      &.course {
        background-color: rgba(184, 92, 56, 0.15);
        color: var(--color-secondary-container);
      }
      &.student {
        background-color: rgba(74, 107, 130, 0.15);
        color: var(--dept-tone-2);
      }

      .material-symbols-outlined {
        font-size: 18px;
      }
    }

    .item-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      overflow: hidden;
    }

    .item-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .course-code {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-caption);
      font-weight: 700;
      color: var(--color-text-headline);
    }

    .item-title {
      font-size: var(--font-size-body-sm);
      font-weight: 600;
      color: var(--color-text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-arrow {
      font-size: 18px;
      color: var(--color-text-subtle);
    }

    .search-footer {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 0.625rem 1.25rem;
      border-top: 1px solid var(--color-border-hairline);
      background-color: var(--color-surface-paper);
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
    }

    .footer-tip {
      display: flex;
      align-items: center;
      gap: 0.25rem;

      kbd {
        font-family: var(--font-family-mono);
        padding: 0.1rem 0.3rem;
        background-color: var(--color-surface-subtle);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-xs);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchOverlayComponent {
  private readonly router = inject(Router);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly studentApi = inject(StudentApi);
  private readonly courseApi = inject(CourseApi);

  readonly isOpen = input<boolean>(false);
  readonly closed = output<void>();

  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly query = signal<string>('');
  readonly loading = signal<boolean>(false);

  private cachedDepartments: Department[] = [];
  private cachedStudents: Student[] = [];
  private cachedCourses: Course[] = [];
  private dataLoaded = false;

  readonly matchingDepartments = signal<Department[]>([]);
  readonly matchingCourses = signal<Course[]>([]);
  readonly matchingStudents = signal<Student[]>([]);

  readonly isEmpty = signal<boolean>(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  async onQueryChange(event: Event): Promise<void> {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);

    if (!val.trim()) {
      this.matchingDepartments.set([]);
      this.matchingCourses.set([]);
      this.matchingStudents.set([]);
      this.isEmpty.set(false);
      return;
    }

    if (!this.dataLoaded) {
      await this.preloadData();
    }

    this.filterData(val.trim().toLowerCase());
  }

  private async preloadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [depts, students, courses] = await Promise.all([
        firstValueFrom(this.departmentApi.getAll()).catch(() => []),
        firstValueFrom(this.studentApi.getAll()).catch(() => []),
        firstValueFrom(this.courseApi.getAllCatalog()).catch(() => []),
      ]);
      this.cachedDepartments = depts;
      this.cachedStudents = students;
      this.cachedCourses = courses;
      this.dataLoaded = true;
    } finally {
      this.loading.set(false);
    }
  }

  private filterData(q: string): void {
    const depts = this.cachedDepartments
      .filter((d) => d.name.toLowerCase().includes(q) || d.head.toLowerCase().includes(q))
      .slice(0, 5);

    const courses = this.cachedCourses
      .filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
      .slice(0, 5);

    const students = this.cachedStudents
      .filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      )
      .slice(0, 5);

    this.matchingDepartments.set(depts);
    this.matchingCourses.set(courses);
    this.matchingStudents.set(students);

    this.isEmpty.set(depts.length === 0 && courses.length === 0 && students.length === 0);
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  navigateTo(path: string): void {
    this.onClose();
    this.router.navigateByUrl(path);
  }

  onClose(): void {
    this.query.set('');
    this.matchingDepartments.set([]);
    this.matchingCourses.set([]);
    this.matchingStudents.set([]);
    this.isEmpty.set(false);
    this.closed.emit();
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CourseApi } from '../../api/course/course.api';
import { DepartmentApi } from '../../api/department/department.api';
import { StudentApi } from '../../api/student/student.api';
import { EnrollmentApi } from '../../api/enrollment/enrollment.api';
import { Course, CourseRequest } from '../../domain/course.model';
import { Department } from '../../domain/department.model';
import { Student, getStudentFullName, getStudentMatricule } from '../../domain/student.model';
import { Enrollment } from '../../domain/enrollment.model';
import { formatDateFrLong, formatDateFrShort } from '../../core/utils/date-utils';
import {
  ButtonComponent,
  StatusBadgeComponent,
  DepartmentTagComponent,
  AvatarComponent,
  DrawerComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  SnackbarService,
} from '../../shared/ui';

interface EnrolledStudentItem {
  enrollment: Enrollment;
  student: Student | null;
}

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    StatusBadgeComponent,
    DepartmentTagComponent,
    AvatarComponent,
    DrawerComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <main class="page-container">
      @if (loading()) {
        <div class="loading-state">
          <app-skeleton type="card" />
          <app-skeleton type="table-rows" [rows]="4" />
        </div>
      } @else if (error()) {
        <app-error-state
          title="Fiche de cours introuvable"
          [message]="error()!"
          (retry)="loadCourseData()"
        />
      } @else if (course()) {
        <!-- En-tête du cours avec hiérarchie académique -->
        <header class="course-header-card">
          <div class="header-top-nav">
            <a routerLink="/cours" class="back-link">
              <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              <span>Retour au catalogue des cours</span>
            </a>
            <div class="header-action-group">
              <app-button
                variant="secondary"
                icon="edit"
                (clicked)="openEditDrawer()"
              >
                Modifier
              </app-button>

              @if (course()!.status === 'ACTIVE') {
                <app-button
                  variant="danger"
                  icon="archive"
                  (clicked)="toggleStatus()"
                >
                  Archiver le cours
                </app-button>
              } @else {
                <app-button
                  variant="primary"
                  icon="unarchive"
                  (clicked)="toggleStatus()"
                >
                  Réactiver le cours
                </app-button>
              }
            </div>
          </div>

          <div class="header-main-info">
            <div class="title-row">
              <span class="course-code-pill">{{ course()!.code }}</span>
              <h1 class="course-title">{{ course()!.title }}</h1>
            </div>

            <div class="metadata-row">
              <app-department-tag
                [name]="departmentName()"
                [departmentId]="course()!.departmentId"
              />
              <span class="meta-separator" aria-hidden="true">•</span>
              <span class="ects-tag">
                <span class="material-symbols-outlined meta-icon" aria-hidden="true">school</span>
                <strong>{{ course()!.credits }}</strong> ECTS
              </span>
              <span class="meta-separator" aria-hidden="true">•</span>
              <app-status-badge [status]="course()!.status" />
              <span class="meta-separator" aria-hidden="true">•</span>
              <span class="meta-date">
                Inscrit le {{ formatDateLong(course()!.createdAt) }}
              </span>
            </div>

            @if (course()!.description) {
              <div class="course-syllabus">
                <h3 class="syllabus-heading">Descriptif & Objectifs pédagogiques</h3>
                <p class="syllabus-text">{{ course()!.description }}</p>
              </div>
            }
          </div>
        </header>

        <!-- Statistiques de la promotion / cohorte -->
        <section class="cohort-stats-grid" aria-label="Statistiques de la cohorte">
          <article class="stat-card">
            <span class="stat-label">Inscriptions totales</span>
            <div class="stat-value-group">
              <span class="stat-number">{{ enrollments().length }}</span>
              <span class="material-symbols-outlined stat-icon" aria-hidden="true">group</span>
            </div>
            <span class="stat-subtext">Étudiants affectés à ce cours</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Enseignement en cours</span>
            <div class="stat-value-group">
              <span class="stat-number">{{ activeCount() }}</span>
              <span class="material-symbols-outlined stat-icon status-active-icon" aria-hidden="true">pending</span>
            </div>
            <span class="stat-subtext">Inscriptions actives ce semestre</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Taux de réussite</span>
            <div class="stat-value-group">
              <span class="stat-number">
                @if (successRate() !== null) {
                  {{ successRate() }}%
                } @else {
                  —
                }
              </span>
              <span class="material-symbols-outlined stat-icon status-success-icon" aria-hidden="true">verified</span>
            </div>
            <span class="stat-subtext">
              {{ completedCount() }} validés sur {{ finishedCount() }} évalués
            </span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Moyenne de promotion</span>
            <div class="stat-value-group">
              <span class="stat-number">
                @if (averageGrade() !== null) {
                  {{ averageGrade() }}/20
                } @else {
                  Non noté
                }
              </span>
              <span class="material-symbols-outlined stat-icon" aria-hidden="true">insights</span>
            </div>
            <span class="stat-subtext">
              @if (averageGrade() !== null) {
                Mention indicative : {{ cohortMention() }}
              } @else {
                En attente des jurys d'examens
              }
            </span>
          </article>
        </section>

        <!-- Registre des étudiants inscrits -->
        <section class="roster-section" aria-label="Registre des inscriptions">
          <div class="roster-header">
            <div>
              <h2 class="roster-title">Registre des auditeurs & évaluations</h2>
              <p class="roster-subtitle">
                Liste des étudiants inscrits, état d'assiduité et relevé des notes attribuées.
              </p>
            </div>
            <a
              routerLink="/inscriptions/nouvelle"
              class="btn-enroll-link"
              title="Ajouter une inscription"
            >
              <span class="material-symbols-outlined" aria-hidden="true">person_add</span>
              <span>Inscrire un étudiant</span>
            </a>
          </div>

          @if (enrolledStudents().length === 0) {
            <div class="empty-roster-box">
              <app-empty-state
                icon="people_outline"
                title="Aucun étudiant inscrit"
                message="Aucun étudiant n'a encore été inscrit à cet enseignement pour l'année universitaire."
                actionLabel="Procéder à une inscription"
                (action)="navigateToNewEnrollment()"
              />
            </div>
          } @else {
            <div class="table-container">
              <table class="ledger-table" aria-label="Table des inscriptions au cours">
                <thead>
                  <tr>
                    <th scope="col" class="th-student">Étudiant</th>
                    <th scope="col" class="th-matricule">Matricule</th>
                    <th scope="col" class="th-date">Date d'inscription</th>
                    <th scope="col" class="th-status">Statut</th>
                    <th scope="col" class="th-grade">Note finale</th>
                    <th scope="col" class="th-actions text-right">Dossier</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of enrolledStudents(); track item.enrollment.id) {
                    <tr class="ledger-row">
                      <td class="td-student">
                        <div class="student-info-cell">
                          <app-avatar
                            [name]="getStudentName(item.student)"
                            size="sm"
                          />
                          <div class="student-names">
                            @if (item.student) {
                              <a [routerLink]="['/etudiants', item.student.id]" class="student-name-link">
                                {{ item.student.lastName.toUpperCase() }} {{ item.student.firstName }}
                              </a>
                              <span class="student-email">{{ item.student.email }}</span>
                            } @else {
                              <span class="student-id-fallback">Étudiant #{{ item.enrollment.studentId }}</span>
                            }
                          </div>
                        </div>
                      </td>
                      <td class="td-matricule">
                        <span class="matricule-tag">
                          {{ getMatricule(item.student) }}
                        </span>
                      </td>
                      <td class="td-date">
                        {{ formatDateShort(item.enrollment.enrollmentDate) }}
                      </td>
                      <td class="td-status">
                        <app-status-badge [status]="item.enrollment.status" context="enrollment" />
                      </td>
                      <td class="td-grade">
                        @if (item.enrollment.grade !== null) {
                          <span class="grade-pill" [class.grade-passed]="item.enrollment.grade >= 10" [class.grade-failed]="item.enrollment.grade < 10">
                            <strong>{{ item.enrollment.grade }}</strong> / 20
                          </span>
                        } @else {
                          <span class="grade-pending">En cours</span>
                        }
                      </td>
                      <td class="td-actions text-right">
                        @if (item.student) {
                          <a
                            [routerLink]="['/etudiants', item.student.id]"
                            class="view-student-btn"
                            title="Voir le relevé de notes de l'étudiant"
                          >
                            <span class="material-symbols-outlined" aria-hidden="true">person</span>
                          </a>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Tiroir de modification du cours -->
        <app-drawer
          [isOpen]="isDrawerOpen()"
          title="Modifier l’enseignement"
          subtitle="Mise à jour du catalogue"
          (closed)="closeDrawer()"
        >
          <form [formGroup]="courseForm" (ngSubmit)="onSubmitForm()" class="drawer-form">
            @if (formError()) {
              <div class="form-alert-error" role="alert">
                <span class="material-symbols-outlined" aria-hidden="true">error_outline</span>
                <span>{{ formError() }}</span>
              </div>
            }

            <div class="form-group">
              <label for="edit-code" class="form-label required">Code UV</label>
              <input
                id="edit-code"
                type="text"
                formControlName="code"
                class="form-input"
                readonly
              />
              <span class="field-hint">Le code officiel est inaltérable après création.</span>
            </div>

            <div class="form-group">
              <label for="edit-title" class="form-label required">Intitulé officiel</label>
              <input
                id="edit-title"
                type="text"
                formControlName="title"
                class="form-input"
                placeholder="ex: Algorithmique avancée"
              />
            </div>

            <div class="form-group">
              <label for="edit-dept" class="form-label required">Département académique</label>
              <select id="edit-dept" formControlName="departmentId" class="form-select">
                @for (dept of departments(); track dept.id) {
                  <option [value]="dept.id">{{ dept.name }}</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label for="edit-credits" class="form-label required">Crédits ECTS</label>
              <input
                id="edit-credits"
                type="number"
                min="1"
                max="30"
                formControlName="credits"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="edit-desc" class="form-label">Descriptif du cours</label>
              <textarea
                id="edit-desc"
                formControlName="description"
                class="form-textarea"
                rows="4"
              ></textarea>
            </div>
          </form>

          <div drawer-footer class="drawer-footer-actions">
            <app-button variant="secondary" (clicked)="closeDrawer()" [disabled]="submitting()">
              Annuler
            </app-button>
            <app-button
              variant="primary"
              icon="check"
              [disabled]="courseForm.invalid || submitting()"
              (clicked)="onSubmitForm()"
            >
              Enregistrer
            </app-button>
          </div>
        </app-drawer>
      }
    </main>
  `,
  styles: [`
    .page-container {
      padding: 2rem 2.5rem;
      max-width: 1440px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .course-header-card {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      padding: 1.5rem 1.75rem;
      box-shadow: var(--shadow-ledger);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .header-top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      text-decoration: none;
      font-weight: 600;

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .header-action-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-main-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .course-code-pill {
      font-family: monospace;
      font-size: 1rem;
      font-weight: 700;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-primary-container);
      letter-spacing: 0.05em;
    }

    .course-title {
      font-family: var(--font-family-display);
      font-size: 1.875rem;
      color: var(--color-text-headline);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .metadata-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
    }

    .meta-separator {
      color: var(--color-border-hairline);
    }

    .ects-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-text-main);

      .meta-icon {
        font-size: 16px;
        color: var(--color-primary-container);
      }
    }

    .meta-date {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
    }

    .course-syllabus {
      margin-top: 0.5rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--color-border-hairline);

      .syllabus-heading {
        font-size: var(--font-size-caption);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 700;
        color: var(--color-text-muted);
        margin: 0 0 0.375rem 0;
      }

      .syllabus-text {
        font-size: var(--font-size-body-sm);
        color: var(--color-text-main);
        line-height: 1.6;
        margin: 0;
      }
    }

    /* Statistiques de cohorte */
    .cohort-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .stat-card {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      box-shadow: var(--shadow-ledger);
    }

    .stat-label {
      font-size: var(--font-size-caption);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      color: var(--color-text-muted);
    }

    .stat-value-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;

      .stat-number {
        font-family: var(--font-family-display);
        font-size: 1.875rem;
        font-weight: 700;
        color: var(--color-text-headline);
        line-height: 1.2;
      }

      .stat-icon {
        font-size: 28px;
        color: var(--color-border-ledger);

        &.status-active-icon {
          color: var(--color-status-active);
        }

        &.status-success-icon {
          color: var(--color-status-completed);
        }
      }
    }

    .stat-subtext {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
    }

    /* Section Registre */
    .roster-section {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-ledger);
      overflow: hidden;
    }

    .roster-header {
      padding: 1.25rem 1.5rem;
      background-color: var(--color-surface-subtle);
      border-bottom: 2px solid var(--color-border-ledger);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .roster-title {
      font-family: var(--font-family-display);
      font-size: 1.25rem;
      color: var(--color-text-headline);
      margin: 0;
    }

    .roster-subtitle {
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      margin: 0.25rem 0 0 0;
    }

    .btn-enroll-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      padding: 0.4rem 0.75rem;
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-text-main);
      text-decoration: none;
      transition: background-color var(--transition-fast);

      .material-symbols-outlined {
        font-size: 16px;
      }

      &:hover {
        background-color: var(--color-surface-hover);
        border-color: var(--color-text-muted);
      }
    }

    .empty-roster-box {
      padding: 3rem 1.5rem;
    }

    .table-container {
      overflow-x: auto;
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      thead th {
        padding: 0.75rem 1.25rem;
        font-size: var(--font-size-caption);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
        background-color: var(--color-surface-subtle);
        border-bottom: 1px solid var(--color-border-hairline);
      }

      tbody tr {
        border-bottom: 1px solid var(--color-border-hairline);

        &:hover {
          background-color: var(--color-surface-hover);
        }

        &:last-child {
          border-bottom: none;
        }
      }

      td {
        padding: 0.875rem 1.25rem;
        font-size: var(--font-size-body-sm);
        vertical-align: middle;
      }
    }

    .student-info-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .student-names {
      display: flex;
      flex-direction: column;
    }

    .student-name-link {
      font-weight: 600;
      color: var(--color-text-headline);
      text-decoration: none;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .student-email {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
    }

    .matricule-tag {
      font-family: monospace;
      font-size: 0.85rem;
      padding: 0.15rem 0.4rem;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
    }

    .grade-pill {
      display: inline-block;
      font-size: var(--font-size-caption);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);

      &.grade-passed {
        background-color: #def7ec;
        color: #03543f;
        border: 1px solid #bcf0da;
      }

      &.grade-failed {
        background-color: #fde8e8;
        color: #9b1c1c;
        border: 1px solid #f8b4b4;
      }
    }

    .grade-pending {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
      font-style: italic;
    }

    .view-student-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      text-decoration: none;

      &:hover {
        background-color: var(--color-surface-subtle);
        color: var(--color-primary-container);
      }

      .material-symbols-outlined {
        font-size: 18px;
      }
    }

    /* Drawer */
    .drawer-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-label {
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-text-main);

      &.required::after {
        content: ' *';
        color: var(--color-status-failed);
      }
    }

    .form-input,
    .form-select,
    .form-textarea {
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-pure);
      color: var(--color-text-main);
      font-size: var(--font-size-body-sm);

      &:focus {
        outline: 2px solid var(--color-primary-container);
        outline-offset: 1px;
      }
    }

    .field-hint {
      font-size: 0.75rem;
      color: var(--color-text-subtle);
    }

    .form-alert-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      background-color: #fdf2f2;
      border: 1px solid #f8b4b4;
      color: #9b1c1c;
      font-size: var(--font-size-body-sm);

      .material-symbols-outlined {
        font-size: 20px;
      }
    }

    .drawer-footer-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .text-right {
      text-align: right;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly courseApi = inject(CourseApi);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly studentApi = inject(StudentApi);
  private readonly enrollmentApi = inject(EnrollmentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly course = signal<Course | null>(null);
  readonly departments = signal<Department[]>([]);
  readonly enrollments = signal<Enrollment[]>([]);
  readonly studentsMap = signal<Map<number, Student>>(new Map());

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Drawer d'édition
  readonly isDrawerOpen = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly departmentName = computed(() => {
    const c = this.course();
    if (!c) return '';
    const dept = this.departments().find(d => d.id === c.departmentId);
    return dept ? dept.name : `Département n°${c.departmentId}`;
  });

  // Calculs sur la cohorte
  readonly activeCount = computed(() => {
    return this.enrollments().filter(e => e.status === 'ACTIVE').length;
  });

  readonly completedCount = computed(() => {
    return this.enrollments().filter(e => e.status === 'COMPLETED').length;
  });

  readonly failedCount = computed(() => {
    return this.enrollments().filter(e => e.status === 'FAILED').length;
  });

  readonly finishedCount = computed(() => {
    return this.completedCount() + this.failedCount();
  });

  readonly successRate = computed(() => {
    const fin = this.finishedCount();
    if (fin === 0) return null;
    return Math.round((this.completedCount() / fin) * 100);
  });

  readonly averageGrade = computed(() => {
    const graded = this.enrollments().filter(e => e.grade !== null && typeof e.grade === 'number');
    if (graded.length === 0) return null;
    const sum = graded.reduce((acc, curr) => acc + (curr.grade as number), 0);
    return Math.round((sum / graded.length) * 10) / 10;
  });

  readonly cohortMention = computed(() => {
    const avg = this.averageGrade();
    if (avg === null) return 'Non noté';
    if (avg >= 16) return 'Très Bien';
    if (avg >= 14) return 'Bien';
    if (avg >= 12) return 'Assez Bien';
    if (avg >= 10) return 'Passable';
    return 'Insuffisant';
  });

  readonly enrolledStudents = computed<EnrolledStudentItem[]>(() => {
    const map = this.studentsMap();
    return this.enrollments().map(e => ({
      enrollment: e,
      student: map.get(e.studentId) || null,
    }));
  });

  readonly courseForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    departmentId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    credits: new FormControl<number>(6, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(30)] }),
    description: new FormControl<string>(''),
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const idParam = params.get('id');
        if (idParam) {
          const id = Number.parseInt(idParam, 10);
          if (!Number.isNaN(id)) {
            this.loadCourseData(id);
          }
        }
      });
  }

  async loadCourseData(courseId?: number): Promise<void> {
    const id = courseId ?? this.course()?.id;
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      // 1. Récupérer les informations du cours et les départements
      const [courseData, deptsData, studentsData] = await Promise.all([
        firstValueFrom(this.courseApi.getById(id)),
        firstValueFrom(this.departmentApi.getAll()),
        firstValueFrom(this.studentApi.getAll()),
      ]);

      this.course.set(courseData);
      this.departments.set(deptsData);

      // Créer une map id -> Student
      const sMap = new Map<number, Student>();
      for (const s of studentsData) {
        sMap.set(s.id, s);
      }
      this.studentsMap.set(sMap);

      // 2. Charger les inscriptions liées à ce cours
      const enrollmentsData = await firstValueFrom(this.enrollmentApi.getByCourseId(id));
      this.enrollments.set(enrollmentsData);

      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement détails cours', err);
      this.error.set("Impossible de charger les données du cours. Vérifiez la passerelle d'API.");
      this.loading.set(false);
    }
  }

  formatDateLong(date: string): string {
    return formatDateFrLong(date);
  }

  formatDateShort(date: string): string {
    return formatDateFrShort(date);
  }

  getStudentName(student: Student | null): string {
    return student ? getStudentFullName(student) : 'Étudiant';
  }

  getMatricule(student: Student | null): string {
    return student ? getStudentMatricule(student) : '—';
  }

  navigateToNewEnrollment(): void {
    this.router.navigate(['/inscriptions/nouvelle'], {
      queryParams: { courseId: this.course()?.id },
    });
  }

  toggleStatus(): void {
    const c = this.course();
    if (!c) return;

    if (c.status === 'ACTIVE') {
      this.courseApi
        .archive(c.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackbar.info(`Le cours ${c.code} a été archivé.`);
            this.loadCourseData(c.id);
          },
          error: () => {
            this.snackbar.error(`Erreur lors de l'archivage du cours.`);
          },
        });
    } else {
      this.courseApi
        .activate(c.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackbar.success(`Le cours ${c.code} a été réactivé avec succès.`);
            this.loadCourseData(c.id);
          },
          error: () => {
            this.snackbar.error(`Erreur lors de la réactivation du cours.`);
          },
        });
    }
  }

  openEditDrawer(): void {
    const c = this.course();
    if (!c) return;

    this.formError.set(null);
    this.courseForm.reset({
      code: c.code,
      title: c.title,
      departmentId: c.departmentId,
      credits: c.credits,
      description: c.description || '',
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.formError.set(null);
  }

  async onSubmitForm(): Promise<void> {
    if (this.courseForm.invalid || !this.course()) return;

    this.submitting.set(true);
    this.formError.set(null);

    const f = this.courseForm.getRawValue();
    const req: CourseRequest = {
      code: f.code,
      title: f.title.trim(),
      departmentId: f.departmentId!,
      credits: f.credits,
      description: f.description?.trim() || null,
    };

    try {
      await firstValueFrom(this.courseApi.update(this.course()!.id, req));
      this.snackbar.success('Fiche de cours modifiée avec succès.');
      this.closeDrawer();
      this.loadCourseData(this.course()!.id);
    } catch (err) {
      console.error('Erreur mise à jour cours', err);
      this.formError.set('Impossible de modifier le cours.');
    } finally {
      this.submitting.set(false);
    }
  }
}

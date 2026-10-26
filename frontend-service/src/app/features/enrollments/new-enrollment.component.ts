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
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EnrollmentApi } from '../../api/enrollment/enrollment.api';
import { StudentApi } from '../../api/student/student.api';
import { CourseApi } from '../../api/course/course.api';
import { DepartmentApi } from '../../api/department/department.api';
import { EnrollmentCreateRequest, EnrollmentStatus } from '../../domain/enrollment.model';
import { Student, getStudentFullName, getStudentMatricule } from '../../domain/student.model';
import { Course } from '../../domain/course.model';
import { Department } from '../../domain/department.model';
import {
  ButtonComponent,
  AvatarComponent,
  DepartmentTagComponent,
  SearchFieldComponent,
  SkeletonComponent,
  SnackbarService,
} from '../../shared/ui';

@Component({
  selector: 'app-new-enrollment',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    AvatarComponent,
    DepartmentTagComponent,
    SearchFieldComponent,
    SkeletonComponent,
  ],
  template: `
    <main class="page-container">
      <!-- En-tête -->
      <header class="wizard-header">
        <a routerLink="/inscriptions" class="back-link">
          <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          <span>Retour aux inscriptions</span>
        </a>
        <h1 class="wizard-title">Nouvelle Inscription Académique</h1>
        <p class="wizard-subtitle">
          Procédure guidée d'admission aux enseignements universitaires en 3 étapes.
        </p>
      </header>

      <!-- Stepper visuel -->
      <nav class="stepper-nav" aria-label="Étapes de l'inscription">
        <div class="step-item" [class.active]="currentStep() === 1" [class.completed]="currentStep() > 1">
          <div class="step-circle">
            @if (currentStep() > 1) {
              <span class="material-symbols-outlined" aria-hidden="true">check</span>
            } @else {
              <span>1</span>
            }
          </div>
          <div class="step-text">
            <span class="step-label">Étape 1</span>
            <span class="step-name">Sélection de l'étudiant</span>
          </div>
        </div>

        <div class="step-connector" [class.completed]="currentStep() > 1"></div>

        <div class="step-item" [class.active]="currentStep() === 2" [class.completed]="currentStep() > 2">
          <div class="step-circle">
            @if (currentStep() > 2) {
              <span class="material-symbols-outlined" aria-hidden="true">check</span>
            } @else {
              <span>2</span>
            }
          </div>
          <div class="step-text">
            <span class="step-label">Étape 2</span>
            <span class="step-name">Choix des cours</span>
          </div>
        </div>

        <div class="step-connector" [class.completed]="currentStep() > 2"></div>

        <div class="step-item" [class.active]="currentStep() === 3">
          <div class="step-circle">
            <span>3</span>
          </div>
          <div class="step-text">
            <span class="step-label">Étape 3</span>
            <span class="step-name">Date & Validation</span>
          </div>
        </div>
      </nav>

      @if (loading()) {
        <div class="loading-wrap">
          <app-skeleton type="card" />
        </div>
      } @else {
        <!-- ÉTAPE 1 : Choix de l'étudiant -->
        @if (currentStep() === 1) {
          <section class="wizard-card" aria-label="Étape 1 : Étudiant">
            <div class="step-card-header">
              <h2 class="card-title">Désignation de l'étudiant auditeur</h2>
              <p class="card-desc">
                Recherchez l'étudiant par nom, prénom ou immatriculation pour ouvrir son dossier semestriel.
              </p>
            </div>

            <div class="search-bar-row">
              <app-search-field
                placeholder="Rechercher un étudiant par nom, prénom, matricule ou email..."
                [value]="studentSearchQuery()"
                (valueChange)="studentSearchQuery.set($event)"
                class="student-search"
              />
            </div>

            <!-- Liste des étudiants sélectionnables -->
            <div class="students-selection-list" role="radiogroup" aria-label="Sélectionner un étudiant">
              @for (s of filteredStudents(); track s.id) {
                <label
                  class="student-option-card"
                  [class.selected]="selectedStudentId() === s.id"
                >
                  <input
                    type="radio"
                    name="selectedStudent"
                    [value]="s.id"
                    [checked]="selectedStudentId() === s.id"
                    (change)="selectStudent(s.id)"
                    class="radio-input"
                  />
                  <app-avatar [name]="getFullName(s)" size="md" />
                  <div class="student-meta">
                    <span class="student-name">{{ s.lastName.toUpperCase() }} {{ s.firstName }}</span>
                    <div class="sub-meta">
                      <span class="mat-tag">{{ getMatricule(s) }}</span>
                      <span class="email-text">{{ s.email }}</span>
                    </div>
                  </div>
                  <div class="dept-col">
                    <app-department-tag
                      [name]="getDeptName(s.departmentId)"
                      [departmentId]="s.departmentId"
                    />
                  </div>
                </label>
              } @empty {
                <div class="no-results-box">
                  <span class="material-symbols-outlined" aria-hidden="true">person_search</span>
                  <p>Aucun étudiant ne correspond à votre recherche.</p>
                </div>
              }
            </div>

            <div class="wizard-footer">
              <div></div>
              <app-button
                variant="primary"
                icon="arrow_forward"
                [disabled]="!selectedStudentId()"
                (clicked)="goToStep(2)"
              >
                Poursuivre vers les cours
              </app-button>
            </div>
          </section>
        }

        <!-- ÉTAPE 2 : Choix des enseignements -->
        @if (currentStep() === 2) {
          <section class="wizard-card" aria-label="Étape 2 : Cours">
            <div class="step-card-header">
              <div class="header-titles-block">
                <h2 class="card-title">Sélection des cours & unités de valeur</h2>
                <p class="card-desc">
                  Cochez les enseignements auxquels l'étudiant doit être inscrit. Inscriptions multiples possibles.
                </p>
              </div>

              <!-- Compteur ECTS cumulés -->
              <div class="ects-counter-badge" [class.recommanded]="totalSelectedEcts() >= 20 && totalSelectedEcts() <= 30">
                <span class="material-symbols-outlined" aria-hidden="true">school</span>
                <span class="ects-count">
                  <strong>{{ totalSelectedEcts() }}</strong> ECTS sélectionnés
                </span>
                <span class="ects-info">({{ selectedCourseIds().size }} cours)</span>
              </div>
            </div>

            <div class="course-filters-row">
              <app-search-field
                placeholder="Filtrer les cours par code ou intitulé..."
                [value]="courseSearchQuery()"
                (valueChange)="courseSearchQuery.set($event)"
                class="course-search"
              />

              <select
                class="dept-filter-select"
                [value]="courseDeptFilter() ?? ''"
                (change)="onCourseDeptFilterChange($event)"
              >
                <option value="">Tous les départements</option>
                @for (d of departments(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </div>

            <!-- Liste des cours avec cases à cocher -->
            <div class="courses-checkbox-list">
              @for (c of filteredCourses(); track c.id) {
                <label
                  class="course-checkbox-card"
                  [class.checked]="isCourseSelected(c.id)"
                >
                  <input
                    type="checkbox"
                    [checked]="isCourseSelected(c.id)"
                    (change)="toggleCourse(c.id)"
                    class="checkbox-input"
                  />
                  <div class="course-code-box">
                    <span class="c-code">{{ c.code }}</span>
                    <span class="c-credits">{{ c.credits }} ECTS</span>
                  </div>
                  <div class="course-info-box">
                    <span class="c-title">{{ c.title }}</span>
                    @if (c.description) {
                      <p class="c-desc">{{ c.description }}</p>
                    }
                  </div>
                  <div class="course-dept-box">
                    <app-department-tag
                      [name]="getDeptName(c.departmentId)"
                      [departmentId]="c.departmentId"
                    />
                  </div>
                </label>
              } @empty {
                <div class="no-results-box">
                  <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
                  <p>Aucun enseignement ne correspond à ces critères.</p>
                </div>
              }
            </div>

            <div class="wizard-footer">
              <app-button variant="outline" (clicked)="goToStep(1)">
                Précédent
              </app-button>
              <app-button
                variant="primary"
                icon="arrow_forward"
                [disabled]="selectedCourseIds().size === 0"
                (clicked)="goToStep(3)"
              >
                Poursuivre vers la validation
              </app-button>
            </div>
          </section>
        }

        <!-- ÉTAPE 3 : Date d'effet & Validation définitive -->
        @if (currentStep() === 3) {
          <section class="wizard-card" aria-label="Étape 3 : Récapitulatif">
            <div class="step-card-header">
              <h2 class="card-title">Récapitulatif & Inscription définitive</h2>
              <p class="card-desc">
                Vérifiez les paramètres d'inscription administrative avant validation au registre.
              </p>
            </div>

            <!-- Paramètres de date et statut initial -->
            <div class="enrollment-params-box">
              <div class="param-group">
                <label for="enroll-date" class="param-label required">Date d'inscription officielle</label>
                <input
                  id="enroll-date"
                  type="date"
                  [value]="enrollmentDate()"
                  (change)="onDateChange($event)"
                  class="param-input"
                />
              </div>

              <div class="param-group">
                <label for="enroll-status" class="param-label required">Statut initial</label>
                <select
                  id="enroll-status"
                  [value]="enrollmentStatus()"
                  (change)="onStatusChange($event)"
                  class="param-select"
                >
                  <option value="ACTIVE">En cours (ACTIVE)</option>
                  <option value="COMPLETED">Validée immédiatement (COMPLETED)</option>
                </select>
              </div>
            </div>

            <!-- Récapitulatif de l'étudiant -->
            @if (chosenStudent(); as st) {
              <div class="summary-section">
                <h3 class="summary-heading">Étudiant inscrit</h3>
                <div class="summary-student-card">
                  <app-avatar [name]="getFullName(st)" size="md" />
                  <div class="summary-st-info">
                    <span class="st-name">{{ st.lastName.toUpperCase() }} {{ st.firstName }}</span>
                    <span class="st-mat">Matricule : {{ getMatricule(st) }}</span>
                    <span class="st-email">{{ st.email }} &bull; {{ st.phone }}</span>
                  </div>
                  <app-department-tag
                    [name]="getDeptName(st.departmentId)"
                    [departmentId]="st.departmentId"
                  />
                </div>
              </div>
            }

            <!-- Récapitulatif des cours choisis -->
            <div class="summary-section">
              <div class="summary-courses-header">
                <h3 class="summary-heading">Enseignements retenus ({{ selectedCourses().length }})</h3>
                <span class="summary-total-ects">
                  Total : <strong>{{ totalSelectedEcts() }} ECTS</strong>
                </span>
              </div>

              <div class="summary-courses-table">
                @for (c of selectedCourses(); track c.id) {
                  <div class="summary-course-row">
                    <span class="s-code">{{ c.code }}</span>
                    <span class="s-title">{{ c.title }}</span>
                    <span class="s-ects">{{ c.credits }} ECTS</span>
                  </div>
                }
              </div>
            </div>

            <div class="wizard-footer">
              <app-button variant="outline" (clicked)="goToStep(2)" [disabled]="submitting()">
                Précédent
              </app-button>
              <app-button
                variant="primary"
                icon="check"
                [loading]="submitting()"
                (clicked)="submitEnrollments()"
              >
                Confirmer l'inscription ({{ selectedCourseIds().size }} cours)
              </app-button>
            </div>
          </section>
        }
      }
    </main>
  `,
  styles: [`
    .page-container {
      padding: 2rem 2.5rem;
      max-width: 1080px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .wizard-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      text-decoration: none;
      font-weight: 600;
      margin-bottom: 0.5rem;

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .wizard-title {
      font-family: var(--font-family-display);
      font-size: 1.875rem;
      color: var(--color-text-headline);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .wizard-subtitle {
      color: var(--color-text-muted);
      font-size: var(--font-size-body-sm);
      margin: 0;
    }

    /* Stepper Nav */
    .stepper-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.75rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-ledger);
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .step-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--color-surface-subtle);
        border: 1px solid var(--color-border-hairline);
        font-weight: 700;
        font-size: var(--font-size-body-sm);
        color: var(--color-text-muted);

        .material-symbols-outlined {
          font-size: 18px;
        }
      }

      .step-text {
        display: flex;
        flex-direction: column;

        .step-label {
          font-size: var(--font-size-micro);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-subtle);
          font-weight: 600;
        }

        .step-name {
          font-size: var(--font-size-caption);
          font-weight: 600;
          color: var(--color-text-muted);
        }
      }

      &.active {
        .step-circle {
          background-color: var(--color-primary-container);
          color: #fff;
          border-color: var(--color-primary-container);
        }

        .step-text .step-name {
          color: var(--color-text-headline);
        }
      }

      &.completed {
        .step-circle {
          background-color: #def7ec;
          border-color: #bcf0da;
          color: #03543f;
        }

        .step-text .step-name {
          color: var(--color-text-main);
        }
      }
    }

    .step-connector {
      flex: 1;
      height: 2px;
      background-color: var(--color-border-hairline);
      margin: 0 1.25rem;

      &.completed {
        background-color: var(--color-primary-container);
      }
    }

    /* Wizard Card */
    .wizard-card {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      padding: 1.75rem;
      box-shadow: var(--shadow-ledger);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .step-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .card-title {
      font-family: var(--font-family-display);
      font-size: 1.35rem;
      color: var(--color-text-headline);
      margin: 0;
    }

    .card-desc {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      margin: 0.25rem 0 0 0;
    }

    .search-bar-row,
    .course-filters-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .student-search,
    .course-search {
      flex: 1;
    }

    .dept-filter-select {
      padding: 0.45rem 0.75rem;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-pure);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
    }

    /* Étape 1 : Liste Étudiants */
    .students-selection-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 400px;
      overflow-y: auto;
      padding-right: 0.25rem;
    }

    .student-option-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1.25rem;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-pure);
      cursor: pointer;
      transition: border-color var(--transition-fast), background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
      }

      &.selected {
        border-color: var(--color-primary-container);
        background-color: rgba(0, 58, 44, 0.03);
      }

      .radio-input {
        accent-color: var(--color-primary-container);
      }

      .student-meta {
        flex: 1;
        display: flex;
        flex-direction: column;

        .student-name {
          font-weight: 600;
          color: var(--color-text-headline);
          font-size: var(--font-size-body-sm);
        }

        .sub-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;

          .mat-tag {
            font-family: monospace;
            font-size: 0.75rem;
            color: var(--color-text-muted);
          }

          .email-text {
            font-size: var(--font-size-caption);
            color: var(--color-text-subtle);
          }
        }
      }
    }

    /* Étape 2 : ECTS badge & Cours */
    .ects-counter-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-text-main);

      .material-symbols-outlined {
        color: var(--color-primary-container);
      }

      &.recommanded {
        background-color: #def7ec;
        border-color: #bcf0da;
        color: #03543f;
      }
    }

    .courses-checkbox-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 420px;
      overflow-y: auto;
      padding-right: 0.25rem;
    }

    .course-checkbox-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1.25rem;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-pure);
      cursor: pointer;
      transition: border-color var(--transition-fast), background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
      }

      &.checked {
        border-color: var(--color-primary-container);
        background-color: rgba(0, 58, 44, 0.03);
      }

      .checkbox-input {
        accent-color: var(--color-primary-container);
        width: 18px;
        height: 18px;
      }

      .course-code-box {
        display: flex;
        flex-direction: column;
        width: 100px;

        .c-code {
          font-family: monospace;
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--color-primary-container);
        }

        .c-credits {
          font-size: 0.75rem;
          color: var(--color-text-subtle);
          font-weight: 600;
        }
      }

      .course-info-box {
        flex: 1;
        display: flex;
        flex-direction: column;

        .c-title {
          font-weight: 600;
          color: var(--color-text-headline);
          font-size: var(--font-size-body-sm);
        }

        .c-desc {
          font-size: var(--font-size-caption);
          color: var(--color-text-subtle);
          margin: 0.15rem 0 0 0;
          max-width: 500px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    /* Étape 3 : Récapitulatif */
    .enrollment-params-box {
      display: flex;
      gap: 1.5rem;
      padding: 1.25rem;
      background-color: var(--color-surface-subtle);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-hairline);

      .param-group {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        flex: 1;

        .param-label {
          font-size: var(--font-size-caption);
          font-weight: 600;
          color: var(--color-text-main);

          &.required::after {
            content: ' *';
            color: var(--color-status-failed);
          }
        }

        .param-input,
        .param-select {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-border-hairline);
          border-radius: var(--radius-sm);
          background-color: var(--color-surface-pure);
          font-size: var(--font-size-body-sm);
        }
      }
    }

    .summary-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .summary-heading {
        font-family: var(--font-family-display);
        font-size: 1.1rem;
        color: var(--color-text-headline);
        margin: 0;
      }
    }

    .summary-student-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-pure);

      .summary-st-info {
        flex: 1;
        display: flex;
        flex-direction: column;

        .st-name {
          font-weight: 700;
          font-size: var(--font-size-body-sm);
        }

        .st-mat {
          font-family: monospace;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .st-email {
          font-size: var(--font-size-caption);
          color: var(--color-text-subtle);
        }
      }
    }

    .summary-courses-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .summary-total-ects {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
    }

    .summary-courses-table {
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .summary-course-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--color-border-hairline);
      background-color: var(--color-surface-pure);

      &:last-child {
        border-bottom: none;
      }

      .s-code {
        font-family: monospace;
        font-weight: 700;
        font-size: 0.85rem;
        width: 100px;
        color: var(--color-primary-container);
      }

      .s-title {
        flex: 1;
        font-size: var(--font-size-body-sm);
        color: var(--color-text-main);
      }

      .s-ects {
        font-size: var(--font-size-caption);
        font-weight: 700;
        color: var(--color-text-muted);
      }
    }

    .wizard-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1.25rem;
      border-top: 1px solid var(--color-border-hairline);
    }

    .no-results-box {
      padding: 2.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--color-text-disabled);
      gap: 0.5rem;

      .material-symbols-outlined {
        font-size: 32px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewEnrollmentComponent implements OnInit {
  private readonly studentApi = inject(StudentApi);
  private readonly courseApi = inject(CourseApi);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly enrollmentApi = inject(EnrollmentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentStep = signal<number>(1);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);

  readonly students = signal<Student[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly departments = signal<Department[]>([]);

  // Étape 1 : Sélection étudiant
  readonly studentSearchQuery = signal<string>('');
  readonly selectedStudentId = signal<number | null>(null);

  // Étape 2 : Sélection des cours
  readonly courseSearchQuery = signal<string>('');
  readonly courseDeptFilter = signal<number | null>(null);
  readonly selectedCourseIds = signal<Set<number>>(new Set());

  // Étape 3 : Paramètres
  readonly enrollmentDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly enrollmentStatus = signal<EnrollmentStatus>('ACTIVE');

  readonly departmentsMap = computed(() => {
    const m = new Map<number, string>();
    for (const d of this.departments()) m.set(d.id, d.name);
    return m;
  });

  readonly filteredStudents = computed(() => {
    const q = this.studentSearchQuery().toLowerCase().trim();
    if (!q) return this.students();
    return this.students().filter(s => {
      const full = `${s.lastName} ${s.firstName}`.toLowerCase();
      const mat = getStudentMatricule(s).toLowerCase();
      return full.includes(q) || s.email.toLowerCase().includes(q) || mat.includes(q);
    });
  });

  readonly filteredCourses = computed(() => {
    const q = this.courseSearchQuery().toLowerCase().trim();
    const deptId = this.courseDeptFilter();
    let list = this.courses();

    if (deptId !== null) {
      list = list.filter(c => c.departmentId === deptId);
    }

    if (q) {
      list = list.filter(c => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
    }

    return list;
  });

  readonly chosenStudent = computed(() => {
    const id = this.selectedStudentId();
    if (!id) return null;
    return this.students().find(s => s.id === id) || null;
  });

  readonly selectedCourses = computed(() => {
    const ids = this.selectedCourseIds();
    return this.courses().filter(c => ids.has(c.id));
  });

  readonly totalSelectedEcts = computed(() => {
    return this.selectedCourses().reduce((sum, c) => sum + c.credits, 0);
  });

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params) => {
        const studentId = params['studentId'] ? Number.parseInt(params['studentId'], 10) : null;
        const courseId = params['courseId'] ? Number.parseInt(params['courseId'], 10) : null;

        if (studentId && !Number.isNaN(studentId)) {
          this.selectedStudentId.set(studentId);
          this.currentStep.set(2);
        }

        if (courseId && !Number.isNaN(courseId)) {
          this.selectedCourseIds.update(set => new Set(set).add(courseId));
        }

        this.loadCatalog();
      });
  }

  async loadCatalog(): Promise<void> {
    this.loading.set(true);
    try {
      const [studentsData, coursesData, deptsData] = await Promise.all([
        firstValueFrom(this.studentApi.getAll()),
        firstValueFrom(this.courseApi.getAllCatalog()),
        firstValueFrom(this.departmentApi.getAll()),
      ]);

      this.students.set(studentsData);
      this.courses.set(coursesData.filter(c => c.status === 'ACTIVE'));
      this.departments.set(deptsData);
      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement catalogue pour inscription', err);
      this.snackbar.error('Impossible de charger les données universitaires.');
      this.loading.set(false);
    }
  }

  getFullName(s: Student): string {
    return getStudentFullName(s);
  }

  getMatricule(s: Student): string {
    return getStudentMatricule(s);
  }

  getDeptName(departmentId: number): string {
    return this.departmentsMap().get(departmentId) || `Département #${departmentId}`;
  }

  selectStudent(id: number): void {
    this.selectedStudentId.set(id);
  }

  goToStep(step: number): void {
    this.currentStep.set(step);
  }

  isCourseSelected(courseId: number): boolean {
    return this.selectedCourseIds().has(courseId);
  }

  toggleCourse(courseId: number): void {
    this.selectedCourseIds.update(set => {
      const copy = new Set(set);
      if (copy.has(courseId)) {
        copy.delete(courseId);
      } else {
        copy.add(courseId);
      }
      return copy;
    });
  }

  onCourseDeptFilterChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    const id = val ? Number.parseInt(val, 10) : null;
    this.courseDeptFilter.set(id);
  }

  onDateChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    if (val) this.enrollmentDate.set(val);
  }

  onStatusChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value as EnrollmentStatus;
    if (val) this.enrollmentStatus.set(val);
  }

  async submitEnrollments(): Promise<void> {
    const studentId = this.selectedStudentId();
    const courseIds = Array.from(this.selectedCourseIds());
    if (!studentId || courseIds.length === 0) return;

    this.submitting.set(true);

    const date = this.enrollmentDate();
    const status = this.enrollmentStatus();

    let successCount = 0;
    const errors: string[] = [];

    // Isolation par cours
    for (const cId of courseIds) {
      const course = this.courses().find(c => c.id === cId);
      const courseLabel = course ? course.code : `#${cId}`;
      const req: EnrollmentCreateRequest = {
        studentId,
        courseId: cId,
        enrollmentDate: date,
        status,
        grade: null,
      };

      try {
        await firstValueFrom(this.enrollmentApi.create(req));
        successCount++;
      } catch (err) {
        console.error(`Erreur inscription au cours ${courseLabel}`, err);
        errors.push(courseLabel);
      }
    }

    this.submitting.set(false);

    if (errors.length === 0) {
      this.snackbar.success(
        `L'étudiant a été inscrit avec succès à ${successCount} enseignement(s).`
      );
      this.router.navigate(['/inscriptions']);
    } else if (successCount > 0) {
      this.snackbar.warning(
        `${successCount} cours inscrits avec succès. Échec pour : ${errors.join(', ')}.`
      );
      this.router.navigate(['/inscriptions']);
    } else {
      this.snackbar.error(
        `Échec de l'enregistrement de l'inscription pour tous les cours sélectionnés.`
      );
    }
  }
}

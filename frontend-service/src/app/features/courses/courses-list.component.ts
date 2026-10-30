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
import { Course, CourseRequest, CourseStatus } from '../../domain/course.model';
import { Department } from '../../domain/department.model';
import { formatDateFrShort } from '../../core/utils/date-utils';
import {
  ButtonComponent,
  StatusBadgeComponent,
  DepartmentTagComponent,
  DrawerComponent,
  PaginatorComponent,
  SearchFieldComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  SnackbarService,
} from '../../shared/ui';

@Component({
  selector: 'app-courses-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    StatusBadgeComponent,
    DepartmentTagComponent,
    DrawerComponent,
    PaginatorComponent,
    SearchFieldComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <main class="page-container">
      <!-- En-tête de la page -->
      <header class="courses-header">
        <div class="header-titles">
          <div class="breadcrumb">
            <span class="breadcrumb-item">Administration</span>
            <span class="material-symbols-outlined breadcrumb-sep" aria-hidden="true">chevron_right</span>
            <span class="breadcrumb-active">Catalogue des cours</span>
          </div>
          <h1 class="page-title">Enseignements & Unités de Valeur</h1>
          <p class="page-subtitle">
            Gestion du catalogue officiel des cours, répartition par département et barème d'ECTS.
          </p>
        </div>
        <div class="header-actions">
          <app-button
            variant="primary"
            icon="add"
            (clicked)="openCreateDrawer()"
          >
            Nouveau cours
          </app-button>
        </div>
      </header>

      <!-- Barre d'outils et de filtres (synchronisée avec l'URL) -->
      <section class="toolbar-card" aria-label="Filtres de recherche">
        <div class="toolbar-left">
          <app-search-field
            placeholder="Rechercher par code ou intitulé..."
            [value]="searchQuery()"
            (valueChange)="onSearchChange($event)"
            class="search-box"
          />

          <div class="filter-group">
            <label for="dept-filter" class="filter-label">Département :</label>
            <select
              id="dept-filter"
              class="filter-select"
              [value]="selectedDepartmentId() ?? ''"
              (change)="onDepartmentFilterChange($event)"
            >
              <option value="">Tous les départements</option>
              @for (dept of departments(); track dept.id) {
                <option [value]="dept.id">{{ dept.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label for="status-filter" class="filter-label">Statut :</label>
            <select
              id="status-filter"
              class="filter-select"
              [value]="selectedStatus() ?? ''"
              (change)="onStatusFilterChange($event)"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
        </div>

        <div class="toolbar-right">
          @if (hasActiveFilters()) {
            <button type="button" class="reset-filter-btn" (click)="resetFilters()">
              <span class="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
              <span>Réinitialiser les filtres</span>
            </button>
          }
          <span class="record-badge">
            <strong>{{ totalElements() }}</strong> cours au catalogue
          </span>
        </div>
      </section>

      <!-- Zone de contenu principal -->
      @if (loading()) {
        <section class="loading-container" aria-busy="true">
          <app-skeleton type="table-rows" [rows]="6" />
        </section>
      } @else if (error()) {
        <app-error-state
          title="Impossible de charger le catalogue"
          [message]="error()!"
          (retry)="loadData()"
        />
      } @else if (courses().length === 0) {
        <div class="empty-card">
          <app-empty-state
            icon="auto_stories"
            title="Aucun cours trouvé"
            [message]="hasActiveFilters() ? 'Aucun cours ne correspond aux critères de recherche spécifiés.' : 'Le catalogue officiel ne comporte aucun cours actuellement.'"
            [actionLabel]="hasActiveFilters() ? 'Effacer les filtres' : 'Créer un premier cours'"
            (action)="hasActiveFilters() ? resetFilters() : openCreateDrawer()"
          />
        </div>
      } @else {
        <!-- Registre officiel : table ledger -->
        <div class="table-container">
          <table class="ledger-table" aria-label="Liste officielle des cours">
            <thead>
              <tr>
                <th scope="col" class="th-code sortable" (click)="toggleSort('code')">
                  <div class="th-content">
                    <span>Code</span>
                    @if (sortField() === 'code') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">{{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-title sortable" (click)="toggleSort('title')">
                  <div class="th-content">
                    <span>Intitulé du cours</span>
                    @if (sortField() === 'title') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">{{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-dept">Département</th>
                <th scope="col" class="th-credits sortable" (click)="toggleSort('credits')">
                  <div class="th-content">
                    <span>Crédits</span>
                    @if (sortField() === 'credits') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">{{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-status">Statut</th>
                <th scope="col" class="th-date">Mise à jour</th>
                <th scope="col" class="th-actions text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (course of filteredCourses(); track course.id) {
                <tr class="ledger-row" [class.row-archived]="course.status === 'ARCHIVED'">
                  <td class="td-code">
                    <span class="code-badge">{{ course.code }}</span>
                  </td>
                  <td class="td-title">
                    <a [routerLink]="['/cours', course.id]" class="course-link">
                      {{ course.title }}
                    </a>
                    @if (course.description) {
                      <p class="course-desc-snippet">{{ course.description }}</p>
                    }
                  </td>
                  <td class="td-dept">
                    <app-department-tag
                      [name]="getDepartmentName(course.departmentId)"
                      [departmentId]="course.departmentId"
                    />
                  </td>
                  <td class="td-credits">
                    <span class="ects-pill">
                      <strong>{{ course.credits }}</strong> ECTS
                    </span>
                  </td>
                  <td class="td-status">
                    <app-status-badge [status]="course.status" />
                  </td>
                  <td class="td-date">
                    <time [attr.datetime]="course.updatedAt">
                      {{ formatDate(course.updatedAt) }}
                    </time>
                  </td>
                  <td class="td-actions">
                    <div class="action-buttons">
                      <a
                        [routerLink]="['/cours', course.id]"
                        class="icon-action-btn"
                        title="Consulter le dossier"
                        aria-label="Consulter le cours"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                      </a>

                      <button
                        type="button"
                        class="icon-action-btn"
                        (click)="openEditDrawer(course)"
                        title="Modifier l'intitulé ou les crédits"
                        aria-label="Modifier le cours"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                      </button>

                      @if (course.status === 'ACTIVE') {
                        <button
                          type="button"
                          class="icon-action-btn btn-archive"
                          (click)="archiveCourse(course)"
                          title="Archiver ce cours"
                          aria-label="Archiver le cours"
                        >
                          <span class="material-symbols-outlined" aria-hidden="true">archive</span>
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="icon-action-btn btn-activate"
                          (click)="reactivateCourse(course)"
                          title="Réactiver ce cours"
                          aria-label="Réactiver le cours"
                        >
                          <span class="material-symbols-outlined" aria-hidden="true">unarchive</span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Paginator -->
          <app-paginator
            [page]="page()"
            [pageSize]="pageSize()"
            [totalElements]="totalElements()"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      }

      <!-- Tiroir latéral (Drawer) pour Création et Édition -->
      <app-drawer
        [isOpen]="isDrawerOpen()"
        [title]="editingCourse() ? 'Modifier l’enseignement' : 'Nouvel enseignement'"
        [subtitle]="editingCourse() ? 'Mise à jour du registre' : 'Inscription au catalogue'"
        (closed)="closeDrawer()"
      >
        <form [formGroup]="courseForm" (ngSubmit)="onSubmitForm()" id="course-form" class="drawer-form">
          @if (formError()) {
            <div class="form-alert-error" role="alert">
              <span class="material-symbols-outlined" aria-hidden="true">error_outline</span>
              <span>{{ formError() }}</span>
            </div>
          }

          <div class="form-group">
            <label for="form-code" class="form-label required">Code de l'unité (Code UV)</label>
            <input
              id="form-code"
              type="text"
              formControlName="code"
              class="form-input text-uppercase"
              placeholder="ex: INFO-401, MATH-102"
              (input)="onCodeInput($event)"
              [attr.readonly]="editingCourse() ? true : null"
            />
            <span class="field-hint">Format recommandé : LETTRES-CHIFFRES (ex. BIO-201). Doit être unique.</span>
            @if (courseForm.get('code')?.invalid && (courseForm.get('code')?.touched || courseForm.get('code')?.dirty)) {
              <span class="field-error">Le code est obligatoire (min. 3 caractères, lettres majuscules et chiffres).</span>
            }
          </div>

          <div class="form-group">
            <label for="form-title" class="form-label required">Intitulé officiel</label>
            <input
              id="form-title"
              type="text"
              formControlName="title"
              class="form-input"
              placeholder="ex: Algorithmique avancée et structures de données"
            />
            @if (courseForm.get('title')?.invalid && (courseForm.get('title')?.touched || courseForm.get('title')?.dirty)) {
              <span class="field-error">L'intitulé est obligatoire (minimum 3 caractères).</span>
            }
          </div>

          <div class="form-group">
            <label for="form-dept" class="form-label required">Département de rattachement</label>
            <select id="form-dept" formControlName="departmentId" class="form-select">
              <option [value]="null" disabled>Sélectionnez un département académique</option>
              @for (dept of departments(); track dept.id) {
                <option [value]="dept.id">{{ dept.name }}</option>
              }
            </select>
            @if (courseForm.get('departmentId')?.invalid && (courseForm.get('departmentId')?.touched || courseForm.get('departmentId')?.dirty)) {
              <span class="field-error">Veuillez sélectionner le département d'appartenance.</span>
            }
          </div>

          <div class="form-group">
            <label for="form-credits" class="form-label required">Crédits ECTS attribués</label>
            <div class="stepper-wrapper">
              <button
                type="button"
                class="stepper-btn"
                (click)="decrementCredits()"
                [disabled]="creditsValue <= 1"
                aria-label="Diminuer les crédits"
              >
                <span class="material-symbols-outlined" aria-hidden="true">remove</span>
              </button>
              <input
                id="form-credits"
                type="number"
                min="1"
                max="30"
                formControlName="credits"
                class="stepper-input"
              />
              <button
                type="button"
                class="stepper-btn"
                (click)="incrementCredits()"
                [disabled]="creditsValue >= 30"
                aria-label="Augmenter les crédits"
              >
                <span class="material-symbols-outlined" aria-hidden="true">add</span>
              </button>
              <span class="stepper-unit">Crédits ECTS</span>
            </div>
            <span class="field-hint">Échelle standard européenne comprise entre 1 et 30 ECTS par cours.</span>
          </div>

          <div class="form-group">
            <label for="form-desc" class="form-label">Syllabus & description du cours</label>
            <textarea
              id="form-desc"
              formControlName="description"
              class="form-textarea"
              rows="4"
              placeholder="Objectifs pédagogiques, prérequis et thématiques abordées..."
            ></textarea>
          </div>
        </form>

        <div drawer-footer class="drawer-footer-actions">
          <app-button
            variant="secondary"
            (clicked)="closeDrawer()"
            [disabled]="submitting()"
          >
            Annuler
          </app-button>
          <app-button
            variant="primary"
            icon="check"
            [disabled]="courseForm.invalid || submitting()"
            (clicked)="onSubmitForm()"
          >
            {{ editingCourse() ? 'Enregistrer les modifications' : 'Inscrire le cours' }}
          </app-button>
        </div>
      </app-drawer>
    </main>
  `,
  styles: [`
    .page-container {
      padding: 2rem 2.5rem;
      max-width: 1440px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .courses-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .breadcrumb {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      margin-bottom: 0.25rem;

      .breadcrumb-sep {
        font-size: 14px;
        color: var(--color-text-subtle);
      }

      .breadcrumb-active {
        color: var(--color-primary-container);
        font-weight: 600;
      }
    }

    .page-title {
      font-family: var(--font-family-display);
      font-size: 1.875rem;
      color: var(--color-text-headline);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      color: var(--color-text-muted);
      font-size: var(--font-size-body-sm);
      margin: 0.25rem 0 0 0;
      max-width: 720px;
    }

    .toolbar-card {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      flex-wrap: wrap;
      box-shadow: var(--shadow-ledger);
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      flex: 1;
    }

    .search-box {
      min-width: 280px;
      max-width: 380px;
      flex: 1;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .filter-label {
        font-size: var(--font-size-caption);
        font-weight: 600;
        color: var(--color-text-subtle);
        white-space: nowrap;
      }

      .filter-select {
        padding: 0.4rem 0.75rem;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface-pure);
        color: var(--color-text-main);
        font-size: var(--font-size-body-sm);
        cursor: pointer;

        &:focus {
          outline: 2px solid var(--color-primary-container);
          outline-offset: 1px;
        }
      }
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .reset-filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: none;
      border: none;
      color: var(--color-status-failed);
      font-size: var(--font-size-caption);
      font-weight: 600;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);

      .material-symbols-outlined {
        font-size: 16px;
      }

      &:hover {
        background-color: var(--color-surface-hover);
        text-decoration: underline;
      }
    }

    .record-badge {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      background-color: var(--color-surface-subtle);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-hairline);

      strong {
        color: var(--color-text-main);
      }
    }

    .table-container {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-ledger);
      overflow: hidden;
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      thead {
        background-color: var(--color-surface-subtle);
        border-bottom: 2px solid var(--color-border-ledger);

        th {
          padding: 0.875rem 1.25rem;
          font-family: var(--font-family-body);
          font-size: var(--font-size-caption);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          white-space: nowrap;

          &.sortable {
            cursor: pointer;
            user-select: none;

            &:hover {
              color: var(--color-text-main);
            }
          }
        }
      }

      .th-content {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;

        .sort-icon {
          font-size: 16px;
          color: var(--color-primary-container);
        }
      }

      tbody tr {
        border-bottom: 1px solid var(--color-border-hairline);
        transition: background-color var(--transition-fast);

        &:hover {
          background-color: var(--color-surface-hover);
        }

        &.row-archived {
          background-color: rgba(0, 0, 0, 0.015);
          opacity: 0.85;
        }

        &:last-child {
          border-bottom: none;
        }
      }

      td {
        padding: 1rem 1.25rem;
        font-size: var(--font-size-body-sm);
        color: var(--color-text-main);
        vertical-align: middle;
      }
    }

    .td-code {
      width: 120px;
    }

    .code-badge {
      display: inline-block;
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-primary-container);
    }

    .course-link {
      font-weight: 600;
      color: var(--color-text-headline);
      text-decoration: none;
      display: block;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .course-desc-snippet {
      margin: 0.25rem 0 0 0;
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
      max-width: 480px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ects-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: var(--font-size-caption);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-text-muted);

      strong {
        color: var(--color-text-main);
      }
    }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
    }

    .icon-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      background: none;
      color: var(--color-text-muted);
      cursor: pointer;
      text-decoration: none;
      transition: background-color var(--transition-fast), color var(--transition-fast);

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        background-color: var(--color-surface-subtle);
        border-color: var(--color-border-hairline);
        color: var(--color-text-main);
      }

      &.btn-archive:hover {
        color: var(--color-status-failed);
      }

      &.btn-activate:hover {
        color: var(--color-status-active);
      }
    }

    /* Styles Formulaire Drawer */
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

    .text-uppercase {
      text-transform: uppercase;
      font-family: monospace;
      letter-spacing: 0.05em;
    }

    .stepper-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .stepper-btn {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--color-surface-subtle);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-sm);
        color: var(--color-text-main);
        cursor: pointer;

        &:hover:not(:disabled) {
          background-color: var(--color-surface-hover);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .material-symbols-outlined {
          font-size: 18px;
        }
      }

      .stepper-input {
        width: 70px;
        text-align: center;
        padding: 0.5rem;
        font-weight: 700;
        font-size: 1rem;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface-pure);
      }

      .stepper-unit {
        font-size: var(--font-size-caption);
        font-weight: 600;
        color: var(--color-text-muted);
      }
    }

    .field-hint {
      font-size: 0.75rem;
      color: var(--color-text-subtle);
    }

    .field-error {
      font-size: 0.75rem;
      color: var(--color-status-failed);
      font-weight: 500;
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
export class CoursesListComponent implements OnInit {
  private readonly courseApi = inject(CourseApi);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // Signaux d'état
  readonly courses = signal<Course[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Pagination & Tris
  readonly page = signal<number>(0);
  readonly pageSize = signal<number>(20);
  readonly totalElements = signal<number>(0);
  readonly sortField = signal<string>('code');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  // Filtres
  readonly searchQuery = signal<string>('');
  readonly selectedDepartmentId = signal<number | null>(null);
  readonly selectedStatus = signal<CourseStatus | null>(null);

  // Tiroir latéral d'édition / création
  readonly isDrawerOpen = signal<boolean>(false);
  readonly editingCourse = signal<Course | null>(null);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly departmentsMap = computed(() => {
    const map = new Map<number, string>();
    for (const d of this.departments()) {
      map.set(d.id, d.name);
    }
    return map;
  });

  readonly hasActiveFilters = computed(() => {
    return (
      this.searchQuery().trim().length > 0 ||
      this.selectedDepartmentId() !== null ||
      this.selectedStatus() !== null
    );
  });

  // Filtrage local en complément de la recherche rapide
  readonly filteredCourses = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.courses();
    return this.courses().filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  });

  readonly courseForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(20)],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    }),
    departmentId: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    credits: new FormControl<number>(6, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(30)],
    }),
    description: new FormControl<string>(''),
  });

  get creditsValue(): number {
    return this.courseForm.get('credits')?.value ?? 6;
  }

  ngOnInit(): void {
    // 1. Charger la liste des départements pour les filtres et le formulaire
    this.departmentApi
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: depts => this.departments.set(depts),
        error: err => console.error('Erreur chargement départements', err),
      });

    // 2. Écouter les paramètres d'URL pour synchroniser l'état
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const p = params['page'] ? Number.parseInt(params['page'], 10) : 0;
        const s = params['size'] ? Number.parseInt(params['size'], 10) : 20;
        const dept = params['departmentId'] ? Number.parseInt(params['departmentId'], 10) : null;
        const stat = (params['status'] as CourseStatus) || null;
        const sort = params['sort'] || 'code,asc';
        const q = params['q'] || '';

        const [field, dir] = sort.split(',');
        this.page.set(Number.isNaN(p) ? 0 : p);
        this.pageSize.set(Number.isNaN(s) ? 20 : s);
        this.selectedDepartmentId.set(Number.isNaN(dept) ? null : dept);
        this.selectedStatus.set(stat);
        this.searchQuery.set(q);
        if (field) this.sortField.set(field);
        if (dir === 'asc' || dir === 'desc') this.sortDir.set(dir);

        this.loadData();
      });
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    const sortParam = `${this.sortField()},${this.sortDir()}`;

    this.courseApi
      .getPage({
        page: this.page(),
        size: this.pageSize(),
        sort: sortParam,
        departmentId: this.selectedDepartmentId(),
        status: this.selectedStatus(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.courses.set(page.content);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: err => {
          console.error('Erreur chargement cours', err);
          this.error.set('La passerelle académique est temporairement indisponible.');
          this.loading.set(false);
        },
      });
  }

  private updateQueryParams(): void {
    const queryParams: Record<string, string | number | null> = {
      page: this.page() > 0 ? this.page() : null,
      size: this.pageSize() !== 20 ? this.pageSize() : null,
      departmentId: this.selectedDepartmentId(),
      status: this.selectedStatus(),
      sort: `${this.sortField()},${this.sortDir()}`,
      q: this.searchQuery() ? this.searchQuery() : null,
    };

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.page.set(0);
    this.updateQueryParams();
  }

  onDepartmentFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const deptId = val ? Number.parseInt(val, 10) : null;
    this.selectedDepartmentId.set(deptId);
    this.page.set(0);
    this.updateQueryParams();
  }

  onStatusFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedStatus.set((val as CourseStatus) || null);
    this.page.set(0);
    this.updateQueryParams();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedDepartmentId.set(null);
    this.selectedStatus.set(null);
    this.page.set(0);
    this.updateQueryParams();
  }

  toggleSort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(0);
    this.updateQueryParams();
  }

  onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.updateQueryParams();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.page.set(0);
    this.updateQueryParams();
  }

  getDepartmentName(departmentId: number): string {
    return this.departmentsMap().get(departmentId) || `Département n°${departmentId}`;
  }

  formatDate(dateString: string): string {
    return formatDateFrShort(dateString);
  }

  // --- Gestion du Tiroir (Drawer) ---
  openCreateDrawer(): void {
    this.editingCourse.set(null);
    this.formError.set(null);
    this.courseForm.reset({
      code: '',
      title: '',
      departmentId: this.departments().length > 0 ? this.departments()[0].id : null,
      credits: 6,
      description: '',
    });
    this.isDrawerOpen.set(true);
  }

  openEditDrawer(course: Course): void {
    this.editingCourse.set(course);
    this.formError.set(null);
    this.courseForm.reset({
      code: course.code,
      title: course.title,
      departmentId: course.departmentId,
      credits: course.credits,
      description: course.description || '',
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.editingCourse.set(null);
    this.formError.set(null);
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.toUpperCase();
    this.courseForm.get('code')?.setValue(input.value, { emitEvent: false });
  }

  incrementCredits(): void {
    const current = this.creditsValue;
    if (current < 30) {
      this.courseForm.get('credits')?.setValue(current + 1);
    }
  }

  decrementCredits(): void {
    const current = this.creditsValue;
    if (current > 1) {
      this.courseForm.get('credits')?.setValue(current - 1);
    }
  }

  async onSubmitForm(): Promise<void> {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    const formValue = this.courseForm.getRawValue();
    const req: CourseRequest = {
      code: formValue.code.trim().toUpperCase(),
      title: formValue.title.trim(),
      departmentId: formValue.departmentId!,
      credits: formValue.credits,
      description: formValue.description?.trim() || null,
    };

    try {
      if (this.editingCourse()) {
        const id = this.editingCourse()!.id;
        await firstValueFrom(this.courseApi.update(id, req));
        this.snackbar.success(`Le cours ${req.code} a été mis à jour avec succès.`);
      } else {
        await firstValueFrom(this.courseApi.create(req));
        this.snackbar.success(`Le cours ${req.code} a été inscrit au catalogue avec succès.`);
      }
      this.closeDrawer();
      this.loadData();
    } catch (err: unknown) {
      console.error('Erreur soumission cours', err);
      const httpErr = err as { status?: number };
      if (httpErr.status === 409) {
        this.formError.set(`Le code d'enseignement "${req.code}" est déjà utilisé dans l'établissement.`);
      } else {
        this.formError.set("Une erreur est survenue lors de l'enregistrement de l'enseignement.");
      }
    } finally {
      this.submitting.set(false);
    }
  }

  // --- Actions d'Archivage / Réactivation avec Annulation (Undo) ---
  archiveCourse(course: Course): void {
    this.courseApi
      .archive(course.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.info(`Le cours ${course.code} a été archivé.`, {
            label: 'Annuler',
            callback: () => this.reactivateCourse(course, true),
          });
          this.loadData();
        },
        error: () => {
          this.snackbar.error(`Impossible d'archiver le cours ${course.code}.`);
        },
      });
  }

  reactivateCourse(course: Course, isUndo = false): void {
    this.courseApi
      .activate(course.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (isUndo) {
            this.snackbar.success(`Archivage annulé : le cours ${course.code} est de nouveau actif.`);
          } else {
            this.snackbar.success(`Le cours ${course.code} a été réactivé avec succès.`);
          }
          this.loadData();
        },
        error: () => {
          this.snackbar.error(`Impossible de réactiver le cours ${course.code}.`);
        },
      });
  }
}

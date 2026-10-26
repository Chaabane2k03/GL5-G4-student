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
import { StudentApi } from '../../api/student/student.api';
import { DepartmentApi } from '../../api/department/department.api';
import { Student, StudentCreateRequest, StudentUpdateRequest, getStudentFullName, getStudentMatricule } from '../../domain/student.model';
import { Department } from '../../domain/department.model';
import { formatDateFrShort } from '../../core/utils/date-utils';
import {
  ButtonComponent,
  AvatarComponent,
  DepartmentTagComponent,
  DrawerComponent,
  PaginatorComponent,
  SearchFieldComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  ConfirmDialogComponent,
  SnackbarService,
} from '../../shared/ui';

@Component({
  selector: 'app-students-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    AvatarComponent,
    DepartmentTagComponent,
    DrawerComponent,
    PaginatorComponent,
    SearchFieldComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <main class="page-container">
      <!-- En-tête de la page -->
      <header class="page-header">
        <div class="header-titles">
          <div class="breadcrumb">
            <span class="breadcrumb-item">Scolarité</span>
            <span class="material-symbols-outlined breadcrumb-sep" aria-hidden="true">chevron_right</span>
            <span class="breadcrumb-active">Registre des étudiants</span>
          </div>
          <h1 class="page-title">Registre Général des Étudiants</h1>
          <p class="page-subtitle">
            Dossiers individuels, immatriculations académiques et affiliation aux départements de formation.
          </p>
        </div>
        <div class="header-actions">
          <app-button
            variant="primary"
            icon="person_add"
            (clicked)="openCreateDrawer()"
          >
            Admettre un étudiant
          </app-button>
        </div>
      </header>

      <!-- Barre d'outils et de filtrage -->
      <section class="toolbar-card" aria-label="Filtres de recherche des étudiants">
        <div class="toolbar-left">
          <app-search-field
            placeholder="Rechercher par nom, prénom, matricule ou email..."
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
        </div>

        <div class="toolbar-right">
          @if (hasActiveFilters()) {
            <button type="button" class="reset-filter-btn" (click)="resetFilters()">
              <span class="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
              <span>Réinitialiser</span>
            </button>
          }
          <span class="record-badge">
            <strong>{{ filteredStudents().length }}</strong> étudiants répertoriés
          </span>
        </div>
      </section>

      <!-- Zone de contenu -->
      @if (loading()) {
        <section class="loading-container" aria-busy="true">
          <app-skeleton type="table-rows" [rows]="8" />
        </section>
      } @else if (error()) {
        <app-error-state
          title="Impossible de charger le registre des étudiants"
          [message]="error()!"
          (retry)="loadData()"
        />
      } @else if (filteredStudents().length === 0) {
        <div class="empty-card">
          <app-empty-state
            icon="school"
            title="Aucun étudiant trouvé"
            [message]="hasActiveFilters() ? 'Aucun dossier étudiant ne correspond aux filtres.' : 'Le registre universitaire ne comporte aucun étudiant inscrit.'"
            [actionLabel]="hasActiveFilters() ? 'Effacer les filtres' : 'Admettre un premier étudiant'"
            (action)="hasActiveFilters() ? resetFilters() : openCreateDrawer()"
          />
        </div>
      } @else {
        <!-- Table ledger des étudiants -->
        <div class="table-container">
          <table class="ledger-table" aria-label="Registre académique des étudiants">
            <thead>
              <tr>
                <th scope="col" class="th-student sortable" (click)="toggleSort('name')">
                  <div class="th-content">
                    <span>Étudiant</span>
                    @if (sortField() === 'name') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-matricule sortable" (click)="toggleSort('matricule')">
                  <div class="th-content">
                    <span>Matricule</span>
                    @if (sortField() === 'matricule') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-dept">Département</th>
                <th scope="col" class="th-contact">Contact & Coordonnées</th>
                <th scope="col" class="th-dob sortable" (click)="toggleSort('dob')">
                  <div class="th-content">
                    <span>Date de naissance</span>
                    @if (sortField() === 'dob') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-actions text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (student of paginatedStudents(); track student.id) {
                <tr class="ledger-row">
                  <td class="td-student">
                    <div class="student-profile-cell">
                      <app-avatar [name]="getFullName(student)" size="sm" />
                      <div class="student-names">
                        <a [routerLink]="['/etudiants', student.id]" class="student-link">
                          {{ student.lastName.toUpperCase() }} {{ student.firstName }}
                        </a>
                        <span class="student-email">{{ student.email }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="td-matricule">
                    <span class="matricule-badge">{{ getMatricule(student) }}</span>
                  </td>
                  <td class="td-dept">
                    <app-department-tag
                      [name]="getDepartmentName(student.departmentId)"
                      [departmentId]="student.departmentId"
                    />
                  </td>
                  <td class="td-contact">
                    <div class="contact-line">
                      <span class="material-symbols-outlined" aria-hidden="true">call</span>
                      <span>{{ student.phone }}</span>
                    </div>
                  </td>
                  <td class="td-dob">
                    <time [attr.datetime]="student.dateOfBirth">
                      {{ formatDate(student.dateOfBirth) }}
                    </time>
                  </td>
                  <td class="td-actions text-right">
                    <div class="action-buttons">
                      <a
                        [routerLink]="['/etudiants', student.id]"
                        class="icon-action-btn"
                        title="Consulter le relevé de notes officiel"
                        aria-label="Consulter l'étudiant"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                      </a>

                      <button
                        type="button"
                        class="icon-action-btn"
                        (click)="openEditDrawer(student)"
                        title="Modifier l'état civil ou le rattachement"
                        aria-label="Modifier l'étudiant"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                      </button>

                      <button
                        type="button"
                        class="icon-action-btn btn-danger"
                        (click)="promptDelete(student)"
                        title="Supprimer définitivement cet étudiant"
                        aria-label="Supprimer l'étudiant"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <app-paginator
            [page]="page()"
            [pageSize]="pageSize()"
            [totalElements]="filteredStudents().length"
            [pageSizeOptions]="[10, 20, 50]"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      }

      <!-- Tiroir latéral pour Admission / Modification d'un étudiant -->
      <app-drawer
        [isOpen]="isDrawerOpen()"
        [title]="editingStudent() ? 'Modifier le dossier étudiant' : 'Nouvelle admission universitaire'"
        [subtitle]="editingStudent() ? 'Mise à jour du registre' : 'Matriculation scolarité'"
        (closed)="closeDrawer()"
      >
        <form [formGroup]="studentForm" (ngSubmit)="onSubmitForm()" class="drawer-form">
          @if (formError()) {
            <div class="form-alert-error" role="alert">
              <span class="material-symbols-outlined" aria-hidden="true">error_outline</span>
              <span>{{ formError() }}</span>
            </div>
          }

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="form-firstname" class="form-label required">Prénom</label>
              <input
                id="form-firstname"
                type="text"
                formControlName="firstName"
                class="form-input"
                placeholder="ex: Jean"
              />
              @if (studentForm.get('firstName')?.invalid && (studentForm.get('firstName')?.touched || studentForm.get('firstName')?.dirty)) {
                <span class="field-error">Le prénom est obligatoire.</span>
              }
            </div>

            <div class="form-group flex-1">
              <label for="form-lastname" class="form-label required">Nom de famille</label>
              <input
                id="form-lastname"
                type="text"
                formControlName="lastName"
                class="form-input"
                placeholder="ex: Dupont"
              />
              @if (studentForm.get('lastName')?.invalid && (studentForm.get('lastName')?.touched || studentForm.get('lastName')?.dirty)) {
                <span class="field-error">Le nom de famille est obligatoire.</span>
              }
            </div>
          </div>

          <div class="form-group">
            <label for="form-email" class="form-label required">Adresse email institutionnelle</label>
            <input
              id="form-email"
              type="email"
              formControlName="email"
              class="form-input"
              placeholder="ex: jean.dupont@universite.fr"
            />
            @if (studentForm.get('email')?.invalid && (studentForm.get('email')?.touched || studentForm.get('email')?.dirty)) {
              <span class="field-error">Veuillez renseigner une adresse email valide.</span>
            }
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="form-phone" class="form-label required">Téléphone portable</label>
              <input
                id="form-phone"
                type="tel"
                formControlName="phone"
                class="form-input"
                placeholder="ex: +33 6 12 34 56 78"
              />
              @if (studentForm.get('phone')?.invalid && (studentForm.get('phone')?.touched || studentForm.get('phone')?.dirty)) {
                <span class="field-error">Le numéro de téléphone est obligatoire.</span>
              }
            </div>

            <div class="form-group flex-1">
              <label for="form-dob" class="form-label required">Date de naissance</label>
              <input
                id="form-dob"
                type="date"
                formControlName="dateOfBirth"
                class="form-input"
              />
              @if (studentForm.get('dateOfBirth')?.invalid && (studentForm.get('dateOfBirth')?.touched || studentForm.get('dateOfBirth')?.dirty)) {
                <span class="field-error">La date de naissance est obligatoire.</span>
              }
            </div>
          </div>

          <div class="form-group">
            <label for="form-dept" class="form-label required">Département académique d'affiliation</label>
            <select id="form-dept" formControlName="departmentId" class="form-select">
              <option [value]="null" disabled>Sélectionnez une unité de formation</option>
              @for (dept of departments(); track dept.id) {
                <option [value]="dept.id">{{ dept.name }}</option>
              }
            </select>
            @if (studentForm.get('departmentId')?.invalid && (studentForm.get('departmentId')?.touched || studentForm.get('departmentId')?.dirty)) {
              <span class="field-error">L'affiliation à un département est requise.</span>
            }
          </div>

          <div class="form-group">
            <label for="form-address" class="form-label required">Adresse de résidence</label>
            <textarea
              id="form-address"
              formControlName="address"
              class="form-textarea"
              rows="3"
              placeholder="Numéro, rue, code postal et ville..."
            ></textarea>
            @if (studentForm.get('address')?.invalid && (studentForm.get('address')?.touched || studentForm.get('address')?.dirty)) {
              <span class="field-error">L'adresse postale est obligatoire.</span>
            }
          </div>
        </form>

        <div drawer-footer class="drawer-footer-actions">
          <app-button variant="secondary" (clicked)="closeDrawer()" [disabled]="submitting()">
            Annuler
          </app-button>
          <app-button
            variant="primary"
            icon="check"
            [disabled]="studentForm.invalid || submitting()"
            (clicked)="onSubmitForm()"
          >
            {{ editingStudent() ? 'Enregistrer les modifications' : 'Admettre l’étudiant' }}
          </app-button>
        </div>
      </app-drawer>

      <!-- Dialogue d'avertissement juridique de suppression définitive -->
      <app-confirm-dialog
        [isOpen]="isDeleteModalOpen()"
        title="Suppression définitive du dossier étudiant"
        badge="Acte administratif irréversible"
        [message]="deleteDialogMessage()"
        warning="Cette action est définitive."
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        variant="danger"
        icon="person_remove"
        [loading]="deleting()"
        (confirmed)="onConfirmDelete()"
        (cancelled)="cancelDelete()"
      />
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

    .page-header {
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
      min-width: 300px;
      max-width: 420px;
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

        &:last-child {
          border-bottom: none;
        }
      }

      td {
        padding: 0.875rem 1.25rem;
        font-size: var(--font-size-body-sm);
        color: var(--color-text-main);
        vertical-align: middle;
      }
    }

    .student-profile-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .student-names {
      display: flex;
      flex-direction: column;
    }

    .student-link {
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

    .matricule-badge {
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-primary-container);
    }

    .contact-line {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);

      .material-symbols-outlined {
        font-size: 15px;
        color: var(--color-text-subtle);
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

      &.btn-danger:hover {
        color: var(--color-status-failed);
      }
    }

    /* Drawer Form */
    .drawer-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-row {
      display: flex;
      gap: 1rem;
    }

    .flex-1 {
      flex: 1;
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
export class StudentsListComponent implements OnInit {
  private readonly studentApi = inject(StudentApi);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly students = signal<Student[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Filtres & Recherche
  readonly searchQuery = signal<string>('');
  readonly selectedDepartmentId = signal<number | null>(null);
  readonly sortField = signal<string>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  // Pagination
  readonly page = signal<number>(0);
  readonly pageSize = signal<number>(20);

  // Drawer
  readonly isDrawerOpen = signal<boolean>(false);
  readonly editingStudent = signal<Student | null>(null);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  // Modal de suppression
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly deletingStudent = signal<Student | null>(null);
  readonly deleting = signal<boolean>(false);

  readonly departmentsMap = computed(() => {
    const map = new Map<number, string>();
    for (const d of this.departments()) {
      map.set(d.id, d.name);
    }
    return map;
  });

  readonly hasActiveFilters = computed(() => {
    return this.searchQuery().trim().length > 0 || this.selectedDepartmentId() !== null;
  });

  readonly filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const deptId = this.selectedDepartmentId();
    let list = this.students();

    if (deptId !== null) {
      list = list.filter(s => s.departmentId === deptId);
    }

    if (q) {
      list = list.filter(s => {
        const matricule = getStudentMatricule(s).toLowerCase();
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        return (
          fullName.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          matricule.includes(q) ||
          s.phone.toLowerCase().includes(q)
        );
      });
    }

    const field = this.sortField();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (field === 'name') {
        const nameA = `${a.lastName} ${a.firstName}`;
        const nameB = `${b.lastName} ${b.firstName}`;
        return nameA.localeCompare(nameB, 'fr') * dir;
      }
      if (field === 'matricule') {
        return getStudentMatricule(a).localeCompare(getStudentMatricule(b)) * dir;
      }
      if (field === 'dob') {
        return a.dateOfBirth.localeCompare(b.dateOfBirth) * dir;
      }
      return 0;
    });
  });

  readonly paginatedStudents = computed(() => {
    const list = this.filteredStudents();
    const start = this.page() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly deleteDialogMessage = computed(() => {
    const s = this.deletingStudent();
    if (!s) return '';
    return `Êtes-vous certain de vouloir radier et supprimer définitivement le dossier de l'étudiant ${s.firstName} ${s.lastName} (Matricule: ${getStudentMatricule(s)}) ?`;
  });

  readonly studentForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    dateOfBirth: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    departmentId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] }),
  });

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const dept = params['departmentId'] ? Number.parseInt(params['departmentId'], 10) : null;
        if (dept !== null && !Number.isNaN(dept)) {
          this.selectedDepartmentId.set(dept);
        }
        this.loadData();
      });
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [studentsData, deptsData] = await Promise.all([
        firstValueFrom(this.studentApi.getAll()),
        firstValueFrom(this.departmentApi.getAll()),
      ]);

      this.students.set(studentsData);
      this.departments.set(deptsData);
      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement registre étudiants', err);
      this.error.set('Impossible de charger le registre des étudiants.');
      this.loading.set(false);
    }
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.page.set(0);
  }

  onDepartmentFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const deptId = val ? Number.parseInt(val, 10) : null;
    this.selectedDepartmentId.set(deptId);
    this.page.set(0);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedDepartmentId.set(null);
    this.page.set(0);
  }

  toggleSort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(0);
  }

  onPageChange(newPage: number): void {
    this.page.set(newPage);
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.page.set(0);
  }

  getFullName(student: Student): string {
    return getStudentFullName(student);
  }

  getMatricule(student: Student): string {
    return getStudentMatricule(student);
  }

  getDepartmentName(departmentId: number): string {
    return this.departmentsMap().get(departmentId) || `Département #${departmentId}`;
  }

  formatDate(date: string): string {
    return formatDateFrShort(date);
  }

  openCreateDrawer(): void {
    this.editingStudent.set(null);
    this.formError.set(null);
    this.studentForm.reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '2004-01-01',
      departmentId: this.departments().length > 0 ? this.departments()[0].id : null,
      address: '',
    });
    this.isDrawerOpen.set(true);
  }

  openEditDrawer(student: Student): void {
    this.editingStudent.set(student);
    this.formError.set(null);
    this.studentForm.reset({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      dateOfBirth: student.dateOfBirth,
      departmentId: student.departmentId,
      address: student.address,
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.editingStudent.set(null);
    this.formError.set(null);
  }

  async onSubmitForm(): Promise<void> {
    if (this.studentForm.invalid) {
      this.studentForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    const f = this.studentForm.getRawValue();

    try {
      if (this.editingStudent()) {
        const id = this.editingStudent()!.id;
        const req: StudentUpdateRequest = {
          id,
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          email: f.email.trim(),
          phone: f.phone.trim(),
          dateOfBirth: f.dateOfBirth,
          address: f.address.trim(),
          departmentId: f.departmentId!,
        };
        await firstValueFrom(this.studentApi.update(req));
        this.snackbar.success(`Dossier de ${req.firstName} ${req.lastName} mis à jour.`);
      } else {
        const req: StudentCreateRequest = {
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          email: f.email.trim(),
          phone: f.phone.trim(),
          dateOfBirth: f.dateOfBirth,
          address: f.address.trim(),
          departmentId: f.departmentId!,
        };
        await firstValueFrom(this.studentApi.create(req));
        this.snackbar.success(`L'étudiant ${req.firstName} ${req.lastName} a été admis avec succès.`);
      }
      this.closeDrawer();
      this.loadData();
    } catch (err) {
      console.error('Erreur soumission étudiant', err);
      this.formError.set("Impossible d'enregistrer le dossier de l'étudiant.");
    } finally {
      this.submitting.set(false);
    }
  }

  promptDelete(student: Student): void {
    this.deletingStudent.set(student);
    this.isDeleteModalOpen.set(true);
  }

  cancelDelete(): void {
    this.isDeleteModalOpen.set(false);
    this.deletingStudent.set(null);
  }

  async onConfirmDelete(): Promise<void> {
    const s = this.deletingStudent();
    if (!s) return;

    this.deleting.set(true);
    try {
      await firstValueFrom(this.studentApi.delete(s.id));
      this.snackbar.success(`Le dossier de ${s.firstName} ${s.lastName} a été définitivement supprimé.`);
      this.cancelDelete();
      this.loadData();
    } catch (err) {
      console.error('Erreur suppression étudiant', err);
      this.snackbar.error(`Impossible de supprimer le dossier de l'étudiant. Des inscriptions sont peut-être encore actives.`);
    } finally {
      this.deleting.set(false);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DepartmentApi } from '../../api/department/department.api';
import { CourseApi } from '../../api/course/course.api';
import { StudentApi } from '../../api/student/student.api';
import { Department, DepartmentCreateRequest } from '../../domain/department.model';
import {
  ButtonComponent,
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

interface DepartmentSummary extends Department {
  courseCount: number;
  studentCount: number;
}

@Component({
  selector: 'app-departments-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
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
            <span class="breadcrumb-item">Administration</span>
            <span class="material-symbols-outlined breadcrumb-sep" aria-hidden="true">chevron_right</span>
            <span class="breadcrumb-active">Départements académiques</span>
          </div>
          <h1 class="page-title">Départements & Unités de Formation</h1>
          <p class="page-subtitle">
            Organisation structurelle des filières universitaires, directions pédagogiques et rattachement des enseignements.
          </p>
        </div>
        <div class="header-actions">
          <app-button
            variant="primary"
            icon="add"
            (clicked)="openCreateDrawer()"
          >
            Nouveau département
          </app-button>
        </div>
      </header>

      <!-- Barre d'outils et de filtres -->
      <section class="toolbar-card" aria-label="Recherche et indicateurs">
        <div class="toolbar-left">
          <app-search-field
            placeholder="Rechercher par intitulé, directeur, localisation..."
            [value]="searchQuery()"
            (valueChange)="onSearchChange($event)"
            class="search-box"
          />
        </div>

        <div class="toolbar-right">
          @if (searchQuery().trim()) {
            <button type="button" class="reset-filter-btn" (click)="searchQuery.set('')">
              <span class="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
              <span>Effacer la recherche</span>
            </button>
          }
          <span class="record-badge">
            <strong>{{ filteredDepartments().length }}</strong> départements actifs
          </span>
        </div>
      </section>

      <!-- Zone de contenu -->
      @if (loading()) {
        <section class="loading-container" aria-busy="true">
          <app-skeleton type="table-rows" [rows]="5" />
        </section>
      } @else if (error()) {
        <app-error-state
          title="Impossible de charger les départements"
          [message]="error()!"
          (retry)="loadData()"
        />
      } @else if (filteredDepartments().length === 0) {
        <div class="empty-card">
          <app-empty-state
            icon="apartment"
            title="Aucun département trouvé"
            [message]="searchQuery().trim() ? 'Aucun département ne correspond à votre recherche.' : 'Aucun département n’est enregistré dans le système.'"
            [actionLabel]="searchQuery().trim() ? 'Effacer la recherche' : 'Créer un département'"
            (action)="searchQuery().trim() ? searchQuery.set('') : openCreateDrawer()"
          />
        </div>
      } @else {
        <!-- Table Registre des départements -->
        <div class="table-container">
          <table class="ledger-table" aria-label="Liste officielle des départements">
            <thead>
              <tr>
                <th scope="col" class="th-dept sortable" (click)="toggleSort('name')">
                  <div class="th-content">
                    <span>Département</span>
                    @if (sortField() === 'name') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-head sortable" (click)="toggleSort('head')">
                  <div class="th-content">
                    <span>Direction académique</span>
                    @if (sortField() === 'head') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-location">Localisation & Secrétariat</th>
                <th scope="col" class="th-courses text-center sortable" (click)="toggleSort('courseCount')">
                  <div class="th-content center">
                    <span>Cours</span>
                    @if (sortField() === 'courseCount') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-students text-center sortable" (click)="toggleSort('studentCount')">
                  <div class="th-content center">
                    <span>Étudiants</span>
                    @if (sortField() === 'studentCount') {
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
              @for (dept of paginatedDepartments(); track dept.id) {
                <tr class="ledger-row">
                  <td class="td-dept">
                    <div class="dept-title-cell">
                      <app-department-tag
                        [name]="dept.name"
                        [departmentId]="dept.id"
                      />
                      <a [routerLink]="['/departements', dept.id]" class="dept-link">
                        {{ dept.name }}
                      </a>
                    </div>
                  </td>
                  <td class="td-head">
                    <div class="head-info">
                      <span class="material-symbols-outlined head-icon" aria-hidden="true">badge</span>
                      <span class="head-name">{{ dept.head }}</span>
                    </div>
                  </td>
                  <td class="td-location">
                    <div class="contact-stack">
                      <span class="location-item">
                        <span class="material-symbols-outlined" aria-hidden="true">place</span>
                        <span>{{ dept.location }}</span>
                      </span>
                      <span class="phone-item">
                        <span class="material-symbols-outlined" aria-hidden="true">call</span>
                        <span>{{ dept.phone }}</span>
                      </span>
                    </div>
                  </td>
                  <td class="td-courses text-center">
                    <span class="metric-pill">
                      <strong>{{ dept.courseCount }}</strong> cours
                    </span>
                  </td>
                  <td class="td-students text-center">
                    <span class="metric-pill">
                      <strong>{{ dept.studentCount }}</strong> étudiants
                    </span>
                  </td>
                  <td class="td-actions text-right">
                    <div class="action-buttons">
                      <a
                        [routerLink]="['/departements', dept.id]"
                        class="icon-action-btn"
                        title="Consulter le dossier"
                        aria-label="Consulter le département"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                      </a>

                      <button
                        type="button"
                        class="icon-action-btn"
                        (click)="openEditDrawer(dept)"
                        title="Modifier les coordonnées du département"
                        aria-label="Modifier le département"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                      </button>

                      <button
                        type="button"
                        class="icon-action-btn btn-danger"
                        (click)="promptDelete(dept)"
                        title="Supprimer ce département"
                        aria-label="Supprimer le département"
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
            [totalElements]="filteredDepartments().length"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      }

      <!-- Tiroir latéral pour Création / Modification de département -->
      <app-drawer
        [isOpen]="isDrawerOpen()"
        [title]="editingDept() ? 'Modifier le département' : 'Nouveau département'"
        [subtitle]="editingDept() ? 'Mise à jour de l’unité' : 'Constitution administrative'"
        (closed)="closeDrawer()"
      >
        <form [formGroup]="deptForm" (ngSubmit)="onSubmitForm()" class="drawer-form">
          @if (formError()) {
            <div class="form-alert-error" role="alert">
              <span class="material-symbols-outlined" aria-hidden="true">error_outline</span>
              <span>{{ formError() }}</span>
            </div>
          }

          <div class="form-group">
            <label for="dept-name" class="form-label required">Nom du département</label>
            <input
              id="dept-name"
              type="text"
              formControlName="name"
              class="form-input"
              placeholder="ex: Informatique & Systèmes Numériques"
            />
            @if (deptForm.get('name')?.invalid && (deptForm.get('name')?.touched || deptForm.get('name')?.dirty)) {
              <span class="field-error">Le nom du département est requis (minimum 3 caractères).</span>
            }
          </div>

          <div class="form-group">
            <label for="dept-head" class="form-label required">Directeur / Responsable académique</label>
            <input
              id="dept-head"
              type="text"
              formControlName="head"
              class="form-input"
              placeholder="ex: Pr. Antoine Dubois"
            />
            @if (deptForm.get('head')?.invalid && (deptForm.get('head')?.touched || deptForm.get('head')?.dirty)) {
              <span class="field-error">Le nom du directeur est obligatoire.</span>
            }
          </div>

          <div class="form-group">
            <label for="dept-location" class="form-label required">Bâtiment & Localisation</label>
            <input
              id="dept-location"
              type="text"
              formControlName="location"
              class="form-input"
              placeholder="ex: Campus Central, Bâtiment Turing, Aile Ouest"
            />
            @if (deptForm.get('location')?.invalid && (deptForm.get('location')?.touched || deptForm.get('location')?.dirty)) {
              <span class="field-error">La localisation physique du département est obligatoire.</span>
            }
          </div>

          <div class="form-group">
            <label for="dept-phone" class="form-label required">Téléphone du secrétariat</label>
            <input
              id="dept-phone"
              type="text"
              formControlName="phone"
              class="form-input"
              placeholder="ex: +33 1 44 27 00 00"
            />
            @if (deptForm.get('phone')?.invalid && (deptForm.get('phone')?.touched || deptForm.get('phone')?.dirty)) {
              <span class="field-error">Le téléphone de contact est obligatoire.</span>
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
            [disabled]="deptForm.invalid || submitting()"
            (clicked)="onSubmitForm()"
          >
            {{ editingDept() ? 'Enregistrer les modifications' : 'Créer le département' }}
          </app-button>
        </div>
      </app-drawer>

      <!-- Boîte de dialogue de suppression stricte avec avertissement définitif -->
      <app-confirm-dialog
        [isOpen]="isDeleteModalOpen()"
        title="Supprimer le département académique"
        badge="Acte administratif irréversible"
        [message]="deleteDialogMessage()"
        warning="Cette action est définitive."
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        variant="danger"
        icon="delete_forever"
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
      flex: 1;
      max-width: 480px;
    }

    .search-box {
      width: 100%;
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

        &.center {
          justify-content: center;
        }

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
        padding: 1rem 1.25rem;
        font-size: var(--font-size-body-sm);
        color: var(--color-text-main);
        vertical-align: middle;
      }
    }

    .dept-title-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .dept-link {
      font-weight: 600;
      color: var(--color-text-headline);
      text-decoration: none;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .head-info {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      color: var(--color-text-main);

      .head-icon {
        font-size: 16px;
        color: var(--color-text-muted);
      }

      .head-name {
        font-weight: 500;
      }
    }

    .contact-stack {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);

      .location-item,
      .phone-item {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;

        .material-symbols-outlined {
          font-size: 15px;
          color: var(--color-text-subtle);
        }
      }
    }

    .metric-pill {
      display: inline-block;
      font-size: var(--font-size-caption);
      padding: 0.25rem 0.625rem;
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

    .form-input {
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

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentsListComponent implements OnInit {
  private readonly departmentApi = inject(DepartmentApi);
  private readonly courseApi = inject(CourseApi);
  private readonly studentApi = inject(StudentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly departments = signal<DepartmentSummary[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Recherche & Tris
  readonly searchQuery = signal<string>('');
  readonly sortField = signal<string>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  // Pagination locale
  readonly page = signal<number>(0);
  readonly pageSize = signal<number>(10);

  // Drawer Création / Édition
  readonly isDrawerOpen = signal<boolean>(false);
  readonly editingDept = signal<Department | null>(null);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  // Modal de suppression
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly deletingDept = signal<DepartmentSummary | null>(null);
  readonly deleting = signal<boolean>(false);

  readonly deptForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    }),
    head: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    location: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(150)],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(30)],
    }),
  });

  readonly filteredDepartments = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    let list = this.departments();

    if (q) {
      list = list.filter(
        d =>
          d.name.toLowerCase().includes(q) ||
          d.head.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q) ||
          d.phone.toLowerCase().includes(q)
      );
    }

    const field = this.sortField();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (field === 'name') return a.name.localeCompare(b.name, 'fr') * dir;
      if (field === 'head') return a.head.localeCompare(b.head, 'fr') * dir;
      if (field === 'courseCount') return (a.courseCount - b.courseCount) * dir;
      if (field === 'studentCount') return (a.studentCount - b.studentCount) * dir;
      return 0;
    });
  });

  readonly paginatedDepartments = computed(() => {
    const list = this.filteredDepartments();
    const start = this.page() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly deleteDialogMessage = computed(() => {
    const d = this.deletingDept();
    if (!d) return '';
    return `Êtes-vous certain de vouloir supprimer le département "${d.name}" (${d.courseCount} cours, ${d.studentCount} étudiants rattachés) du registre universitaire ?`;
  });

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [depts, courses, students] = await Promise.all([
        firstValueFrom(this.departmentApi.getAll()),
        firstValueFrom(this.courseApi.getAllCatalog()),
        firstValueFrom(this.studentApi.getAll()),
      ]);

      const courseCountMap = new Map<number, number>();
      for (const c of courses) {
        courseCountMap.set(c.departmentId, (courseCountMap.get(c.departmentId) || 0) + 1);
      }

      const studentCountMap = new Map<number, number>();
      for (const s of students) {
        studentCountMap.set(s.departmentId, (studentCountMap.get(s.departmentId) || 0) + 1);
      }

      const summaries: DepartmentSummary[] = depts.map(d => ({
        ...d,
        courseCount: courseCountMap.get(d.id) || 0,
        studentCount: studentCountMap.get(d.id) || 0,
      }));

      this.departments.set(summaries);
      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement départements', err);
      this.error.set('Impossible de charger la structure des départements académiques.');
      this.loading.set(false);
    }
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
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

  openCreateDrawer(): void {
    this.editingDept.set(null);
    this.formError.set(null);
    this.deptForm.reset({
      name: '',
      head: '',
      location: '',
      phone: '',
    });
    this.isDrawerOpen.set(true);
  }

  openEditDrawer(dept: Department): void {
    this.editingDept.set(dept);
    this.formError.set(null);
    this.deptForm.reset({
      name: dept.name,
      head: dept.head,
      location: dept.location,
      phone: dept.phone,
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.editingDept.set(null);
    this.formError.set(null);
  }

  async onSubmitForm(): Promise<void> {
    if (this.deptForm.invalid) {
      this.deptForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    const f = this.deptForm.getRawValue();
    const req: DepartmentCreateRequest = {
      name: f.name.trim(),
      head: f.head.trim(),
      location: f.location.trim(),
      phone: f.phone.trim(),
    };

    try {
      if (this.editingDept()) {
        const id = this.editingDept()!.id;
        await firstValueFrom(this.departmentApi.update(id, req));
        this.snackbar.success(`Le département ${req.name} a été mis à jour.`);
      } else {
        await firstValueFrom(this.departmentApi.create(req));
        this.snackbar.success(`Le département ${req.name} a été créé avec succès.`);
      }
      this.closeDrawer();
      this.loadData();
    } catch (err) {
      console.error('Erreur soumission département', err);
      this.formError.set('Impossible d’enregistrer le département académique.');
    } finally {
      this.submitting.set(false);
    }
  }

  promptDelete(dept: DepartmentSummary): void {
    this.deletingDept.set(dept);
    this.isDeleteModalOpen.set(true);
  }

  cancelDelete(): void {
    this.isDeleteModalOpen.set(false);
    this.deletingDept.set(null);
  }

  async onConfirmDelete(): Promise<void> {
    const dept = this.deletingDept();
    if (!dept) return;

    this.deleting.set(true);
    try {
      await firstValueFrom(this.departmentApi.delete(dept.id));
      this.snackbar.success(`Le département "${dept.name}" a été définitivement supprimé.`);
      this.cancelDelete();
      this.loadData();
    } catch (err) {
      console.error('Erreur suppression département', err);
      this.snackbar.error(`Impossible de supprimer le département "${dept.name}". Des cours ou étudiants y sont peut-être rattachés.`);
    } finally {
      this.deleting.set(false);
    }
  }
}

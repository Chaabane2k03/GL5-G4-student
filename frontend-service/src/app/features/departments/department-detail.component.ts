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
import { DepartmentApi } from '../../api/department/department.api';
import { CourseApi } from '../../api/course/course.api';
import { StudentApi } from '../../api/student/student.api';
import { Department, DepartmentUpdateRequest } from '../../domain/department.model';
import { Course } from '../../domain/course.model';
import { Student, getStudentFullName, getStudentMatricule } from '../../domain/student.model';
import {
  ButtonComponent,
  DepartmentTagComponent,
  StatusBadgeComponent,
  AvatarComponent,
  DrawerComponent,
  SearchFieldComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  ConfirmDialogComponent,
  SnackbarService,
} from '../../shared/ui';

@Component({
  selector: 'app-department-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    DepartmentTagComponent,
    StatusBadgeComponent,
    AvatarComponent,
    DrawerComponent,
    SearchFieldComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ConfirmDialogComponent,
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
          title="Département introuvable"
          [message]="error()!"
          (retry)="loadData()"
        />
      } @else if (department()) {
        <!-- En-tête du Département -->
        <header class="dept-header-card">
          <div class="header-top-nav">
            <a routerLink="/departements" class="back-link">
              <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              <span>Retour à la liste des départements</span>
            </a>
            <div class="header-action-group">
              <app-button
                variant="secondary"
                icon="edit"
                (clicked)="openEditDrawer()"
              >
                Modifier
              </app-button>
              <app-button
                variant="danger"
                icon="delete_forever"
                (clicked)="promptDelete()"
              >
                Supprimer
              </app-button>
            </div>
          </div>

          <div class="header-main-info">
            <div class="title-row">
              <app-department-tag
                [name]="department()!.name"
                [departmentId]="department()!.id"
              />
              <h1 class="dept-title">{{ department()!.name }}</h1>
            </div>

            <div class="contact-badges-row">
              <span class="meta-item">
                <span class="material-symbols-outlined meta-icon" aria-hidden="true">badge</span>
                <span>Directeur : <strong>{{ department()!.head }}</strong></span>
              </span>
              <span class="meta-separator" aria-hidden="true">•</span>
              <span class="meta-item">
                <span class="material-symbols-outlined meta-icon" aria-hidden="true">place</span>
                <span>{{ department()!.location }}</span>
              </span>
              <span class="meta-separator" aria-hidden="true">•</span>
              <span class="meta-item">
                <span class="material-symbols-outlined meta-icon" aria-hidden="true">call</span>
                <span>{{ department()!.phone }}</span>
              </span>
            </div>
          </div>
        </header>

        <!-- Métriques du département -->
        <section class="dept-stats-grid" aria-label="Statistiques du département">
          <article class="stat-card">
            <span class="stat-label">Enseignements</span>
            <div class="stat-value-group">
              <span class="stat-number">{{ courses().length }}</span>
              <span class="material-symbols-outlined stat-icon" aria-hidden="true">auto_stories</span>
            </div>
            <span class="stat-subtext">
              {{ activeCoursesCount() }} cours actifs &bull; {{ archivedCoursesCount() }} archivés
            </span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Crédits ECTS cumulés</span>
            <div class="stat-value-group">
              <span class="stat-number">{{ totalEcts() }}</span>
              <span class="material-symbols-outlined stat-icon" aria-hidden="true">school</span>
            </div>
            <span class="stat-subtext">Volume pédagogique total</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Effectif étudiant</span>
            <div class="stat-value-group">
              <span class="stat-number">{{ students().length }}</span>
              <span class="material-symbols-outlined stat-icon" aria-hidden="true">groups</span>
            </div>
            <span class="stat-subtext">Étudiants rattachés à la filière</span>
          </article>
        </section>

        <!-- Navigation par onglets -->
        <section class="tabs-section">
          <div class="tabs-header" role="tablist">
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'courses'"
              (click)="activeTab.set('courses')"
              role="tab"
              [attr.aria-selected]="activeTab() === 'courses'"
            >
              <span class="material-symbols-outlined" aria-hidden="true">auto_stories</span>
              <span>Cours dispensés</span>
              <span class="tab-badge">{{ courses().length }}</span>
            </button>

            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'students'"
              (click)="activeTab.set('students')"
              role="tab"
              [attr.aria-selected]="activeTab() === 'students'"
            >
              <span class="material-symbols-outlined" aria-hidden="true">school</span>
              <span>Étudiants inscrits</span>
              <span class="tab-badge">{{ students().length }}</span>
            </button>
          </div>

          <!-- Contenu Onglet 1 : Cours -->
          @if (activeTab() === 'courses') {
            <div class="tab-pane">
              <div class="tab-toolbar">
                <app-search-field
                  placeholder="Filtrer les cours de ce département..."
                  [value]="courseQuery()"
                  (valueChange)="courseQuery.set($event)"
                  class="tab-search"
                />
                <a
                  routerLink="/cours"
                  [queryParams]="{ departmentId: department()!.id }"
                  class="link-add-record"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">add</span>
                  <span>Gérer dans le catalogue</span>
                </a>
              </div>

              @if (filteredCourses().length === 0) {
                <div class="empty-tab-box">
                  <app-empty-state
                    icon="auto_stories"
                    title="Aucun cours répertorié"
                    [message]="courseQuery() ? 'Aucun cours ne correspond à ce filtre.' : 'Aucun cours n’est actuellement rattaché à ce département.'"
                  />
                </div>
              } @else {
                <div class="table-container">
                  <table class="ledger-table" aria-label="Liste des cours du département">
                    <thead>
                      <tr>
                        <th scope="col" class="th-code">Code</th>
                        <th scope="col" class="th-title">Intitulé</th>
                        <th scope="col" class="th-credits">Crédits</th>
                        <th scope="col" class="th-status">Statut</th>
                        <th scope="col" class="th-actions text-right">Détail</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of filteredCourses(); track c.id) {
                        <tr class="ledger-row">
                          <td class="td-code">
                            <span class="code-pill">{{ c.code }}</span>
                          </td>
                          <td class="td-title">
                            <a [routerLink]="['/cours', c.id]" class="table-link">
                              {{ c.title }}
                            </a>
                          </td>
                          <td class="td-credits">
                            <span class="ects-pill"><strong>{{ c.credits }}</strong> ECTS</span>
                          </td>
                          <td class="td-status">
                            <app-status-badge [status]="c.status" />
                          </td>
                          <td class="td-actions text-right">
                            <a [routerLink]="['/cours', c.id]" class="icon-link-btn" title="Consulter la fiche du cours">
                              <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
                            </a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          <!-- Contenu Onglet 2 : Étudiants -->
          @if (activeTab() === 'students') {
            <div class="tab-pane">
              <div class="tab-toolbar">
                <app-search-field
                  placeholder="Filtrer les étudiants de cette filière..."
                  [value]="studentQuery()"
                  (valueChange)="studentQuery.set($event)"
                  class="tab-search"
                />
                <a
                  routerLink="/etudiants"
                  [queryParams]="{ departmentId: department()!.id }"
                  class="link-add-record"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">person_add</span>
                  <span>Voir dans le registre étudiants</span>
                </a>
              </div>

              @if (filteredStudents().length === 0) {
                <div class="empty-tab-box">
                  <app-empty-state
                    icon="groups"
                    title="Aucun étudiant rattaché"
                    [message]="studentQuery() ? 'Aucun étudiant ne correspond à ce filtre.' : 'Aucun étudiant n’est rattaché à ce département pour le moment.'"
                  />
                </div>
              } @else {
                <div class="table-container">
                  <table class="ledger-table" aria-label="Liste des étudiants du département">
                    <thead>
                      <tr>
                        <th scope="col" class="th-student">Étudiant</th>
                        <th scope="col" class="th-matricule">Matricule</th>
                        <th scope="col" class="th-contact">Coordonnées</th>
                        <th scope="col" class="th-actions text-right">Dossier</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of filteredStudents(); track s.id) {
                        <tr class="ledger-row">
                          <td class="td-student">
                            <div class="student-cell">
                              <app-avatar [name]="getStudentName(s)" size="sm" />
                              <div class="student-details">
                                <a [routerLink]="['/etudiants', s.id]" class="table-link">
                                  {{ s.lastName.toUpperCase() }} {{ s.firstName }}
                                </a>
                              </div>
                            </div>
                          </td>
                          <td class="td-matricule">
                            <span class="matricule-tag">{{ getMatricule(s) }}</span>
                          </td>
                          <td class="td-contact">
                            <div class="contact-sub">
                              <span>{{ s.email }}</span>
                              <span class="phone-sub">{{ s.phone }}</span>
                            </div>
                          </td>
                          <td class="td-actions text-right">
                            <a [routerLink]="['/etudiants', s.id]" class="icon-link-btn" title="Consulter le relevé de notes">
                              <span class="material-symbols-outlined" aria-hidden="true">person</span>
                            </a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        </section>

        <!-- Tiroir de modification du département -->
        <app-drawer
          [isOpen]="isDrawerOpen()"
          title="Modifier le département"
          subtitle="Mise à jour des coordonnées"
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
              <label for="edit-name" class="form-label required">Nom du département</label>
              <input id="edit-name" type="text" formControlName="name" class="form-input" />
            </div>

            <div class="form-group">
              <label for="edit-head" class="form-label required">Directeur / Responsable académique</label>
              <input id="edit-head" type="text" formControlName="head" class="form-input" />
            </div>

            <div class="form-group">
              <label for="edit-location" class="form-label required">Bâtiment & Localisation</label>
              <input id="edit-location" type="text" formControlName="location" class="form-input" />
            </div>

            <div class="form-group">
              <label for="edit-phone" class="form-label required">Téléphone du secrétariat</label>
              <input id="edit-phone" type="text" formControlName="phone" class="form-input" />
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
              Enregistrer
            </app-button>
          </div>
        </app-drawer>

        <!-- Modal de suppression définitive -->
        <app-confirm-dialog
          [isOpen]="isDeleteModalOpen()"
          title="Supprimer définitivement le département"
          badge="Avertissement juridique"
          [message]="'Êtes-vous certain de vouloir supprimer le département ' + department()!.name + ' ? Tous les cours et étudiants rattachés doivent impérativement être réaffectés.'"
          warning="Cette action est définitive."
          confirmLabel="Supprimer définitivement"
          cancelLabel="Annuler"
          variant="danger"
          icon="delete_forever"
          [loading]="deleting()"
          (confirmed)="onConfirmDelete()"
          (cancelled)="isDeleteModalOpen.set(false)"
        />
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

    .dept-header-card {
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

    .dept-title {
      font-family: var(--font-family-display);
      font-size: 1.875rem;
      color: var(--color-text-headline);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .contact-badges-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;

      .meta-icon {
        font-size: 16px;
        color: var(--color-primary-container);
      }
    }

    .meta-separator {
      color: var(--color-border-hairline);
    }

    /* Statistiques */
    .dept-stats-grid {
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
      }
    }

    .stat-subtext {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
    }

    /* Tabs */
    .tabs-section {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-ledger);
      overflow: hidden;
    }

    .tabs-header {
      display: flex;
      align-items: center;
      background-color: var(--color-surface-subtle);
      border-bottom: 2px solid var(--color-border-ledger);
      padding: 0 1rem;
      gap: 0.5rem;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      color: var(--color-text-muted);
      font-size: var(--font-size-body-sm);
      font-weight: 600;
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast);

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        color: var(--color-text-main);
      }

      &.active {
        color: var(--color-primary-container);
        border-bottom-color: var(--color-primary-container);
      }
    }

    .tab-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
    }

    .tab-pane {
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .tab-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .tab-search {
      max-width: 380px;
      flex: 1;
    }

    .link-add-record {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      color: var(--color-text-main);
      font-size: var(--font-size-caption);
      font-weight: 600;
      text-decoration: none;

      .material-symbols-outlined {
        font-size: 16px;
      }

      &:hover {
        background-color: var(--color-surface-hover);
      }
    }

    .empty-tab-box {
      padding: 2.5rem 1rem;
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

    .code-pill {
      font-family: monospace;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-primary-container);
    }

    .table-link {
      font-weight: 600;
      color: var(--color-text-headline);
      text-decoration: none;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .ects-pill {
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

    .student-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
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

    .contact-sub {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      .phone-sub {
        font-size: var(--font-size-caption);
        color: var(--color-text-subtle);
      }
    }

    .icon-link-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      text-decoration: none;

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        background-color: var(--color-surface-subtle);
        color: var(--color-primary-container);
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
export class DepartmentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly courseApi = inject(CourseApi);
  private readonly studentApi = inject(StudentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly department = signal<Department | null>(null);
  readonly courses = signal<Course[]>([]);
  readonly students = signal<Student[]>([]);

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly activeTab = signal<'courses' | 'students'>('courses');
  readonly courseQuery = signal<string>('');
  readonly studentQuery = signal<string>('');

  // Drawer d'édition
  readonly isDrawerOpen = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  // Modal de suppression
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly deleting = signal<boolean>(false);

  readonly activeCoursesCount = computed(() => {
    return this.courses().filter(c => c.status === 'ACTIVE').length;
  });

  readonly archivedCoursesCount = computed(() => {
    return this.courses().filter(c => c.status === 'ARCHIVED').length;
  });

  readonly totalEcts = computed(() => {
    return this.courses().reduce((sum, c) => sum + c.credits, 0);
  });

  readonly filteredCourses = computed(() => {
    const q = this.courseQuery().toLowerCase().trim();
    if (!q) return this.courses();
    return this.courses().filter(
      c => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
  });

  readonly filteredStudents = computed(() => {
    const q = this.studentQuery().toLowerCase().trim();
    if (!q) return this.students();
    return this.students().filter(
      s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  });

  readonly deptForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    head: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    location: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const idParam = params.get('id');
        if (idParam) {
          const id = Number.parseInt(idParam, 10);
          if (!Number.isNaN(id)) {
            void this.loadData(id);
          }
        }
      });
  }

  async loadData(deptId?: number): Promise<void> {
    const id = deptId ?? this.department()?.id;
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const [dept, allCourses, allStudents] = await Promise.all([
        firstValueFrom(this.departmentApi.getById(id)),
        firstValueFrom(this.courseApi.getAllCatalog()),
        firstValueFrom(this.studentApi.getAll()),
      ]);

      this.department.set(dept);
      this.courses.set(allCourses.filter(c => c.departmentId === id));
      this.students.set(allStudents.filter(s => s.departmentId === id));
      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement détails département', err);
      this.error.set('Impossible de charger les données du département académique.');
      this.loading.set(false);
    }
  }

  getStudentName(student: Student): string {
    return getStudentFullName(student);
  }

  getMatricule(student: Student): string {
    return getStudentMatricule(student);
  }

  openEditDrawer(): void {
    const d = this.department();
    if (!d) return;

    this.formError.set(null);
    this.deptForm.reset({
      name: d.name,
      head: d.head,
      location: d.location,
      phone: d.phone,
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.formError.set(null);
  }

  async onSubmitForm(): Promise<void> {
    if (this.deptForm.invalid || !this.department()) return;

    this.submitting.set(true);
    this.formError.set(null);

    const f = this.deptForm.getRawValue();
    const req: DepartmentUpdateRequest = {
      name: f.name.trim(),
      head: f.head.trim(),
      location: f.location.trim(),
      phone: f.phone.trim(),
    };

    try {
      await firstValueFrom(this.departmentApi.update(this.department()!.id, req));
      this.snackbar.success('Coordonnées du département mises à jour.');
      this.closeDrawer();
      void this.loadData(this.department()!.id);
    } catch (err) {
      console.error('Erreur mise à jour département', err);
      this.formError.set('Impossible de modifier le département.');
    } finally {
      this.submitting.set(false);
    }
  }

  promptDelete(): void {
    this.isDeleteModalOpen.set(true);
  }

  async onConfirmDelete(): Promise<void> {
    const d = this.department();
    if (!d) return;

    this.deleting.set(true);
    try {
      await firstValueFrom(this.departmentApi.delete(d.id));
      this.snackbar.success(`Le département ${d.name} a été supprimé.`);
      this.isDeleteModalOpen.set(false);
      void this.router.navigate(['/departements']);
    } catch (err) {
      console.error('Erreur suppression département', err);
      this.snackbar.error('Impossible de supprimer ce département car des cours ou des étudiants y sont rattachés.');
    } finally {
      this.deleting.set(false);
    }
  }
}

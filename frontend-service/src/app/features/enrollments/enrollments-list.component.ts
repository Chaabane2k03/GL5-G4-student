import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { EnrollmentApi } from '../../api/enrollment/enrollment.api';
import { StudentApi } from '../../api/student/student.api';
import { CourseApi } from '../../api/course/course.api';
import { DepartmentApi } from '../../api/department/department.api';
import { Enrollment, EnrollmentStatus, EnrollmentUpdateRequest, ENROLLMENT_STATUS_LABELS } from '../../domain/enrollment.model';
import { Student, getStudentFullName, getStudentMatricule } from '../../domain/student.model';
import { Course } from '../../domain/course.model';
import { Department } from '../../domain/department.model';
import { formatDateFrShort } from '../../core/utils/date-utils';
import {
  ButtonComponent,
  AvatarComponent,
  StatusBadgeComponent,
  PaginatorComponent,
  SearchFieldComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  ModalComponent,
  ConfirmDialogComponent,
  SnackbarService,
} from '../../shared/ui';

export interface EnrollmentEnriched {
  enrollment: Enrollment;
  student: Student | null;
  course: Course | null;
}

@Component({
  selector: 'app-enrollments-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DragDropModule,
    ButtonComponent,
    AvatarComponent,
    StatusBadgeComponent,
    PaginatorComponent,
    SearchFieldComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
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
            <span class="breadcrumb-active">Inscriptions universitaires</span>
          </div>
          <h1 class="page-title">Gestion des Inscriptions & Validations</h1>
          <p class="page-subtitle">
            Attribution des cours, suivi semestriel de l'assiduité et procès-verbal de notation académique.
          </p>
        </div>
        <div class="header-actions">
          <!-- Bascule Vue Table / Kanban -->
          <div class="view-switch" role="group" aria-label="Mode d'affichage">
            <button
              type="button"
              class="switch-btn"
              [class.active]="viewMode() === 'table'"
              (click)="viewMode.set('table')"
              title="Vue Registre / Tableau"
            >
              <span class="material-symbols-outlined" aria-hidden="true">table_rows</span>
              <span>Tableau</span>
            </button>
            <button
              type="button"
              class="switch-btn"
              [class.active]="viewMode() === 'kanban'"
              (click)="viewMode.set('kanban')"
              title="Vue Tableau Kanban d'évaluation"
            >
              <span class="material-symbols-outlined" aria-hidden="true">view_kanban</span>
              <span>Kanban</span>
            </button>
          </div>

          <a routerLink="/inscriptions/nouvelle" class="action-new-btn">
            <span class="material-symbols-outlined" aria-hidden="true">add</span>
            <span>Nouvelle inscription</span>
          </a>
        </div>
      </header>

      <!-- Barre d'outils et de filtres -->
      <section class="toolbar-card" aria-label="Filtres de recherche des inscriptions">
        <div class="toolbar-left">
          <app-search-field
            placeholder="Rechercher par étudiant, matricule ou cours..."
            [value]="searchQuery()"
            (valueChange)="onSearchChange($event)"
            class="search-box"
          />

          <div class="filter-group">
            <label for="status-filter" class="filter-label">Statut :</label>
            <select
              id="status-filter"
              class="filter-select"
              [value]="selectedStatus() ?? ''"
              (change)="onStatusFilterChange($event)"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">En cours</option>
              <option value="COMPLETED">Validée</option>
              <option value="FAILED">Échouée</option>
              <option value="DROPPED">Abandonnée</option>
              <option value="WITHDRAWN">Désistement</option>
            </select>
          </div>

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
            <strong>{{ filteredItems().length }}</strong> inscriptions
          </span>
        </div>
      </section>

      <!-- Zone de contenu principal -->
      @if (loading()) {
        <section class="loading-container" aria-busy="true">
          <app-skeleton type="table-rows" [rows]="8" />
        </section>
      } @else if (error()) {
        <app-error-state
          title="Impossible de charger le registre des inscriptions"
          [message]="error()!"
          (retry)="loadData()"
        />
      } @else if (filteredItems().length === 0) {
        <div class="empty-card">
          <app-empty-state
            icon="how_to_reg"
            title="Aucune inscription trouvée"
            [message]="hasActiveFilters() ? 'Aucune inscription ne correspond aux critères de filtre.' : 'Aucune inscription n’est enregistrée dans le système.'"
            [actionLabel]="hasActiveFilters() ? 'Effacer les filtres' : 'Créer une inscription'"
            (action)="hasActiveFilters() ? resetFilters() : navigateToNew()"
          />
        </div>
      } @else if (viewMode() === 'table') {
        <!-- VUE 1 : Registre en table ledger -->
        <div class="table-container">
          <table class="ledger-table" aria-label="Registre exhaustif des inscriptions">
            <thead>
              <tr>
                <th scope="col" class="th-student sortable" (click)="toggleSort('student')">
                  <div class="th-content">
                    <span>Étudiant</span>
                    @if (sortField() === 'student') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-course sortable" (click)="toggleSort('course')">
                  <div class="th-content">
                    <span>Cours & UV</span>
                    @if (sortField() === 'course') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-date sortable" (click)="toggleSort('date')">
                  <div class="th-content">
                    <span>Date d'inscription</span>
                    @if (sortField() === 'date') {
                      <span class="material-symbols-outlined sort-icon" aria-hidden="true">
                        {{ sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
                      </span>
                    }
                  </div>
                </th>
                <th scope="col" class="th-status">Statut</th>
                <th scope="col" class="th-grade sortable" (click)="toggleSort('grade')">
                  <div class="th-content">
                    <span>Note / 20</span>
                    @if (sortField() === 'grade') {
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
              @for (item of paginatedItems(); track item.enrollment.id) {
                <tr class="ledger-row">
                  <td class="td-student">
                    <div class="student-cell">
                      <app-avatar [name]="getStudentName(item.student)" size="sm" />
                      <div class="student-info">
                        @if (item.student) {
                          <a [routerLink]="['/etudiants', item.student.id]" class="table-link">
                            {{ item.student.lastName.toUpperCase() }} {{ item.student.firstName }}
                          </a>
                          <span class="matricule-sub">{{ getMatricule(item.student) }}</span>
                        } @else {
                          <span class="unknown-fallback">Étudiant #{{ item.enrollment.studentId }}</span>
                        }
                      </div>
                    </div>
                  </td>

                  <td class="td-course">
                    <div class="course-cell">
                      @if (item.course) {
                        <div class="course-code-line">
                          <span class="code-pill">{{ item.course.code }}</span>
                          <span class="ects-tag">{{ item.course.credits }} ECTS</span>
                        </div>
                        <a [routerLink]="['/cours', item.course.id]" class="course-title-sub">
                          {{ item.course.title }}
                        </a>
                      } @else {
                        <span class="unknown-fallback">Cours #{{ item.enrollment.courseId }}</span>
                      }
                    </div>
                  </td>

                  <td class="td-date">
                    <time [attr.datetime]="item.enrollment.enrollmentDate">
                      {{ formatDate(item.enrollment.enrollmentDate) }}
                    </time>
                  </td>

                  <td class="td-status">
                    <app-status-badge [status]="item.enrollment.status" context="enrollment" />
                  </td>

                  <td class="td-grade">
                    @if (item.enrollment.grade !== null) {
                      <span
                        class="grade-pill"
                        [class.grade-passed]="item.enrollment.grade >= 10"
                        [class.grade-failed]="item.enrollment.grade < 10"
                      >
                        <strong>{{ item.enrollment.grade }}</strong> / 20
                      </span>
                    } @else {
                      <span class="grade-pending">En cours</span>
                    }
                  </td>

                  <td class="td-actions text-right">
                    <div class="action-buttons">
                      <button
                        type="button"
                        class="icon-action-btn"
                        (click)="openGradeModal(item)"
                        title="Saisir ou modifier la note"
                        aria-label="Modifier la note"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">rate_review</span>
                      </button>

                      <button
                        type="button"
                        class="icon-action-btn btn-danger"
                        (click)="promptDelete(item)"
                        title="Supprimer cette inscription"
                        aria-label="Supprimer l'inscription"
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
            [totalElements]="filteredItems().length"
            [pageSizeOptions]="[10, 20, 50, 100]"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      } @else {
        <!-- VUE 2 : Tableau Kanban avec Drag & Drop CDK -->
        <section class="kanban-board" aria-label="Tableau Kanban de suivi des inscriptions">
          @for (col of kanbanColumns; track col.status) {
            <div class="kanban-column" [class]="'col-' + col.status.toLowerCase()">
              <div class="kanban-col-header">
                <div class="col-title-group">
                  <span class="status-indicator-dot" [class]="col.status.toLowerCase()"></span>
                  <h3 class="col-title">{{ col.label }}</h3>
                </div>
                <span class="col-count-badge">{{ getColumnItems(col.status).length }}</span>
              </div>

              <div
                class="kanban-drop-zone"
                cdkDropList
                [id]="col.status"
                [cdkDropListData]="getColumnItems(col.status)"
                [cdkDropListConnectedTo]="kanbanConnectedLists"
                (cdkDropListDropped)="onDropCard($event, col.status)"
              >
                @for (item of getColumnItems(col.status); track item.enrollment.id) {
                  <div class="kanban-card" cdkDrag [cdkDragData]="item">
                    <div class="card-top">
                      <span class="card-course-code">{{ item.course?.code || ('UV #' + item.enrollment.courseId) }}</span>
                      @if (item.course) {
                        <span class="card-ects">{{ item.course.credits }} ECTS</span>
                      }
                    </div>

                    <h4 class="card-course-title">{{ item.course?.title || 'Cours universitaire' }}</h4>

                    <div class="card-student-row">
                      <app-avatar [name]="getStudentName(item.student)" size="sm" />
                      <div class="card-student-names">
                        <span class="student-name-text">
                          {{ item.student ? (item.student.lastName.toUpperCase() + ' ' + item.student.firstName) : 'Étudiant #' + item.enrollment.studentId }}
                        </span>
                        <span class="student-mat-text">{{ getMatricule(item.student) }}</span>
                      </div>
                    </div>

                    <div class="card-footer">
                      <div class="card-grade-zone">
                        @if (item.enrollment.grade !== null) {
                          <span
                            class="grade-pill-sm"
                            [class.grade-passed]="item.enrollment.grade >= 10"
                            [class.grade-failed]="item.enrollment.grade < 10"
                          >
                            <strong>{{ item.enrollment.grade }}</strong>/20
                          </span>
                        } @else {
                          <span class="grade-none">Pas de note</span>
                        }
                      </div>

                      <button
                        type="button"
                        class="btn-quick-grade"
                        (click)="openGradeModal(item)"
                        title="Noter cet étudiant"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">edit_note</span>
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="kanban-empty-placeholder">
                    <span>Aucun dossier</span>
                  </div>
                }
              </div>
            </div>
          }
        </section>
      }

      <!-- Modal de Notation et Changement de Statut -->
      <app-modal
        [isOpen]="isGradeModalOpen()"
        title="Procès-Verbal d'Évaluation"
        badge="Contrôle des connaissances"
        size="sm"
        (closed)="closeGradeModal()"
      >
        @if (selectedItemForGrade()) {
          <div class="modal-context-box">
            <div class="context-item">
              <span class="context-lbl">Étudiant :</span>
              <strong>{{ getStudentName(selectedItemForGrade()!.student) }}</strong>
              <span class="context-mat">({{ getMatricule(selectedItemForGrade()!.student) }})</span>
            </div>
            <div class="context-item">
              <span class="context-lbl">Enseignement :</span>
              <strong>{{ selectedItemForGrade()!.course?.code }}</strong>
              <span>- {{ selectedItemForGrade()!.course?.title }}</span>
            </div>
          </div>

          <form [formGroup]="gradeForm" (ngSubmit)="onSubmitGrade()" class="grade-form">
            <div class="form-group">
              <label for="modal-grade" class="form-label">Note obtenue (sur 20)</label>
              <input
                id="modal-grade"
                type="number"
                step="0.25"
                min="0"
                max="20"
                formControlName="grade"
                class="form-input"
                placeholder="ex: 14.5"
              />
              <span class="field-hint">Échelle standard de 0 à 20 (seuil de validation : 10/20).</span>
            </div>

            <div class="form-group">
              <label for="modal-status" class="form-label required">Statut d'inscription</label>
              <select id="modal-status" formControlName="status" class="form-select">
                <option value="ACTIVE">En cours (ACTIVE)</option>
                <option value="COMPLETED">Validée (COMPLETED)</option>
                <option value="FAILED">Échouée / Non validée (FAILED)</option>
                <option value="DROPPED">Abandonnée (DROPPED)</option>
                <option value="WITHDRAWN">Désistement administratif (WITHDRAWN)</option>
              </select>
            </div>
          </form>
        }

        <div modal-footer class="modal-footer-btns">
          <app-button variant="outline" (clicked)="closeGradeModal()" [disabled]="submittingGrade()">
            Annuler
          </app-button>
          <app-button
            variant="primary"
            icon="check"
            [disabled]="gradeForm.invalid || submittingGrade()"
            (clicked)="onSubmitGrade()"
          >
            Valider et enregistrer
          </app-button>
        </div>
      </app-modal>

      <!-- Confirmation de Suppression d'inscription -->
      <app-confirm-dialog
        [isOpen]="isDeleteModalOpen()"
        title="Annuler l'inscription académique"
        badge="Suppression de registre"
        [message]="deleteMessage()"
        warning="Cette action est définitive."
        confirmLabel="Supprimer l'inscription"
        cancelLabel="Conserver"
        variant="danger"
        icon="delete"
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .view-switch {
      display: inline-flex;
      background-color: var(--color-surface-subtle);
      padding: 0.25rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-hairline);

      .switch-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.35rem 0.65rem;
        border-radius: var(--radius-xs);
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        font-size: var(--font-size-caption);
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--transition-fast), color var(--transition-fast);

        .material-symbols-outlined {
          font-size: 16px;
        }

        &.active {
          background-color: var(--color-surface-paper);
          color: var(--color-text-main);
          box-shadow: var(--shadow-sm);
        }
      }
    }

    .action-new-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      background-color: var(--color-primary-container);
      color: #fff;
      border-radius: var(--radius-md);
      font-size: var(--font-size-body-sm);
      font-weight: 600;
      text-decoration: none;

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        background-color: #003a2c;
      }
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

    .student-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .student-info {
      display: flex;
      flex-direction: column;
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

    .matricule-sub {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--color-text-subtle);
    }

    .course-cell {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .course-code-line {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .code-pill {
      font-family: monospace;
      font-weight: 700;
      font-size: 0.8rem;
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-primary-container);
    }

    .ects-tag {
      font-size: 0.75rem;
      color: var(--color-text-subtle);
    }

    .course-title-sub {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-main);
      text-decoration: none;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
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

      .material-symbols-outlined {
        font-size: 18px;
      }

      &:hover {
        background-color: var(--color-surface-subtle);
        color: var(--color-primary-container);
      }

      &.btn-danger:hover {
        color: var(--color-status-failed);
      }
    }

    /* KANBAN BOARD */
    .kanban-board {
      display: grid;
      grid-template-columns: repeat(5, minmax(260px, 1fr));
      gap: 1.25rem;
      overflow-x: auto;
      padding-bottom: 1.5rem;
      align-items: flex-start;
    }

    .kanban-column {
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 280px);
      min-height: 400px;
    }

    .kanban-col-header {
      padding: 1rem;
      background-color: var(--color-surface-paper);
      border-bottom: 2px solid var(--color-border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top-left-radius: var(--radius-md);
      border-top-right-radius: var(--radius-md);
    }

    .col-title-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.active { background-color: #1a56db; }
      &.completed { background-color: #0e9f6e; }
      &.failed { background-color: #e02424; }
      &.dropped { background-color: #76a9fa; }
      &.withdrawn { background-color: #6b7280; }
    }

    .col-title {
      font-size: var(--font-size-body-sm);
      font-weight: 700;
      color: var(--color-text-headline);
      margin: 0;
    }

    .col-count-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 10px;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-text-muted);
    }

    .kanban-drop-zone {
      flex: 1;
      padding: 0.75rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 300px;
    }

    .kanban-card {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      padding: 0.875rem;
      box-shadow: var(--shadow-sm);
      cursor: grab;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: box-shadow var(--transition-fast), transform var(--transition-fast);

      &:active {
        cursor: grabbing;
      }

      &.cdk-drag-placeholder {
        opacity: 0.3;
        border: 2px dashed var(--color-primary-container);
      }

      &.cdk-drag-animating {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-course-code {
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.1rem 0.35rem;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-xs);
      color: var(--color-primary-container);
    }

    .card-ects {
      font-size: 0.7rem;
      color: var(--color-text-subtle);
      font-weight: 600;
    }

    .card-course-title {
      font-size: var(--font-size-body-sm);
      font-weight: 600;
      color: var(--color-text-headline);
      margin: 0;
      line-height: 1.3;
    }

    .card-student-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--color-border-hairline);
    }

    .card-student-names {
      display: flex;
      flex-direction: column;
    }

    .student-name-text {
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-text-main);
    }

    .student-mat-text {
      font-family: monospace;
      font-size: 0.7rem;
      color: var(--color-text-subtle);
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.25rem;
    }

    .grade-pill-sm {
      font-size: 0.75rem;
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-xs);

      &.grade-passed {
        background-color: #def7ec;
        color: #03543f;
      }

      &.grade-failed {
        background-color: #fde8e8;
        color: #9b1c1c;
      }
    }

    .grade-none {
      font-size: 0.75rem;
      color: var(--color-text-subtle);
      font-style: italic;
    }

    .btn-quick-grade {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.2rem;
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      border-radius: var(--radius-xs);

      .material-symbols-outlined {
        font-size: 16px;
      }

      &:hover {
        color: var(--color-primary-container);
        background-color: var(--color-surface-subtle);
      }
    }

    .kanban-empty-placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-caption);
      color: var(--color-text-disabled);
      font-style: italic;
    }

    /* Modal Context & Form */
    .modal-context-box {
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: var(--font-size-body-sm);
      margin-bottom: 1.25rem;
    }

    .context-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;

      .context-lbl {
        color: var(--color-text-muted);
        font-size: var(--font-size-caption);
        font-weight: 600;
      }

      .context-mat {
        font-family: monospace;
        font-size: 0.8rem;
        color: var(--color-text-subtle);
      }
    }

    .grade-form {
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
    .form-select {
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

    .modal-footer-btns {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      width: 100%;
    }

    .text-right {
      text-align: right;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollmentsListComponent implements OnInit {
  private readonly enrollmentApi = inject(EnrollmentApi);
  private readonly studentApi = inject(StudentApi);
  private readonly courseApi = inject(CourseApi);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewMode = signal<'table' | 'kanban'>('table');

  readonly rawEnrollments = signal<Enrollment[]>([]);
  readonly studentsMap = signal<Map<number, Student>>(new Map());
  readonly coursesMap = signal<Map<number, Course>>(new Map());
  readonly departments = signal<Department[]>([]);

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Filtres
  readonly searchQuery = signal<string>('');
  readonly selectedStatus = signal<EnrollmentStatus | null>(null);
  readonly selectedDepartmentId = signal<number | null>(null);

  // Tris & Pagination
  readonly sortField = signal<string>('date');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal<number>(0);
  readonly pageSize = signal<number>(20);

  // Colonnes Kanban
  readonly kanbanColumns: { status: EnrollmentStatus; label: string }[] = [
    { status: 'ACTIVE', label: 'En cours' },
    { status: 'COMPLETED', label: 'Validées' },
    { status: 'FAILED', label: 'Échouées' },
    { status: 'DROPPED', label: 'Abandonnées' },
    { status: 'WITHDRAWN', label: 'Désistements' },
  ];

  readonly kanbanConnectedLists = ['ACTIVE', 'COMPLETED', 'FAILED', 'DROPPED', 'WITHDRAWN'];

  // Modal de notation / statut
  readonly isGradeModalOpen = signal<boolean>(false);
  readonly selectedItemForGrade = signal<EnrollmentEnriched | null>(null);
  readonly submittingGrade = signal<boolean>(false);

  // Modal de confirmation de suppression
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly selectedItemForDelete = signal<EnrollmentEnriched | null>(null);
  readonly deleting = signal<boolean>(false);

  readonly gradeForm = new FormGroup({
    grade: new FormControl<number | null>(null, [Validators.min(0), Validators.max(20)]),
    status: new FormControl<EnrollmentStatus>('ACTIVE', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly enrichedItems = computed<EnrollmentEnriched[]>(() => {
    const sMap = this.studentsMap();
    const cMap = this.coursesMap();
    return this.rawEnrollments().map(e => ({
      enrollment: e,
      student: sMap.get(e.studentId) || null,
      course: cMap.get(e.courseId) || null,
    }));
  });

  readonly hasActiveFilters = computed(() => {
    return (
      this.searchQuery().trim().length > 0 ||
      this.selectedStatus() !== null ||
      this.selectedDepartmentId() !== null
    );
  });

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.selectedStatus();
    const deptId = this.selectedDepartmentId();
    let list = this.enrichedItems();

    if (status) {
      list = list.filter(i => i.enrollment.status === status);
    }

    if (deptId !== null) {
      list = list.filter(
        i =>
          (i.student && i.student.departmentId === deptId) ||
          (i.course && i.course.departmentId === deptId)
      );
    }

    if (q) {
      list = list.filter(i => {
        const studentName = i.student ? `${i.student.lastName} ${i.student.firstName}`.toLowerCase() : '';
        const matricule = i.student ? getStudentMatricule(i.student).toLowerCase() : '';
        const courseCode = i.course ? i.course.code.toLowerCase() : '';
        const courseTitle = i.course ? i.course.title.toLowerCase() : '';
        return (
          studentName.includes(q) ||
          matricule.includes(q) ||
          courseCode.includes(q) ||
          courseTitle.includes(q)
        );
      });
    }

    const field = this.sortField();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      if (field === 'student') {
        const nameA = a.student ? `${a.student.lastName} ${a.student.firstName}` : '';
        const nameB = b.student ? `${b.student.lastName} ${b.student.firstName}` : '';
        return nameA.localeCompare(nameB, 'fr') * dir;
      }
      if (field === 'course') {
        const codeA = a.course ? a.course.code : '';
        const codeB = b.course ? b.course.code : '';
        return codeA.localeCompare(codeB) * dir;
      }
      if (field === 'date') {
        const dateA = a.enrollment.enrollmentDate ?? '';
        const dateB = b.enrollment.enrollmentDate ?? '';
        return dateA.localeCompare(dateB) * dir;
      }
      if (field === 'grade') {
        const gA = a.enrollment.grade ?? -1;
        const gB = b.enrollment.grade ?? -1;
        return (gA - gB) * dir;
      }
      return 0;
    });
  });

  readonly paginatedItems = computed(() => {
    const list = this.filteredItems();
    const start = this.page() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly deleteMessage = computed(() => {
    const item = this.selectedItemForDelete();
    if (!item) return '';
    const studentName = item.student ? getStudentFullName(item.student) : `Étudiant #${item.enrollment.studentId}`;
    const courseCode = item.course ? item.course.code : `Cours #${item.enrollment.courseId}`;
    return `Êtes-vous certain de vouloir annuler et supprimer l'inscription de ${studentName} au cours ${courseCode} ?`;
  });

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [enrollments, students, courses, depts] = await Promise.all([
        firstValueFrom(this.enrollmentApi.getAll()),
        firstValueFrom(this.studentApi.getAll()),
        firstValueFrom(this.courseApi.getAllCatalog()),
        firstValueFrom(this.departmentApi.getAll()),
      ]);

      const sMap = new Map<number, Student>();
      for (const s of students) sMap.set(s.id, s);

      const cMap = new Map<number, Course>();
      for (const c of courses) cMap.set(c.id, c);

      this.rawEnrollments.set(enrollments);
      this.studentsMap.set(sMap);
      this.coursesMap.set(cMap);
      this.departments.set(depts);
      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement inscriptions', err);
      this.error.set('Impossible de charger le registre des inscriptions académiques.');
      this.loading.set(false);
    }
  }

  getColumnItems(status: EnrollmentStatus): EnrollmentEnriched[] {
    return this.filteredItems().filter(i => i.enrollment.status === status);
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.page.set(0);
  }

  onStatusFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedStatus.set((val as EnrollmentStatus) || null);
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
    this.selectedStatus.set(null);
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

  onPageChange(p: number): void {
    this.page.set(p);
  }

  onPageSizeChange(s: number): void {
    this.pageSize.set(s);
    this.page.set(0);
  }

  getStudentName(student: Student | null): string {
    return student ? getStudentFullName(student) : 'Étudiant';
  }

  getMatricule(student: Student | null): string {
    return student ? getStudentMatricule(student) : '—';
  }

  formatDate(date: string | null | undefined): string {
    return formatDateFrShort(date);
  }

  navigateToNew(): void {
    this.router.navigate(['/inscriptions/nouvelle']);
  }

  // --- Drag & Drop Kanban ---
  async onDropCard(event: CdkDragDrop<EnrollmentEnriched[]>, targetStatus: EnrollmentStatus): Promise<void> {
    const item = event.item.data as EnrollmentEnriched;
    if (!item || item.enrollment.status === targetStatus) return;

    if (targetStatus === 'COMPLETED' || targetStatus === 'FAILED') {
      // Ouvre le modal de notation pour saisir la note exigée
      this.selectedItemForGrade.set(item);
      const defaultGrade = targetStatus === 'COMPLETED' ? (item.enrollment.grade ?? 12) : (item.enrollment.grade ?? 7);
      this.gradeForm.reset({
        grade: defaultGrade,
        status: targetStatus,
      });
      this.isGradeModalOpen.set(true);
      return;
    }

    // Mise à jour de statut direct
    const req: EnrollmentUpdateRequest = {
      idEnrollment: item.enrollment.id,
      enrollmentDate: item.enrollment.enrollmentDate,
      studentId: item.enrollment.studentId,
      courseId: item.enrollment.courseId,
      grade: item.enrollment.grade,
      status: targetStatus,
    };

    try {
      await firstValueFrom(this.enrollmentApi.update(req));
      this.snackbar.success(`Statut mis à jour : ${ENROLLMENT_STATUS_LABELS[targetStatus]}.`);
      this.loadData();
    } catch (err) {
      console.error('Erreur déplacement carte', err);
      this.snackbar.error('Impossible de modifier le statut de cette inscription.');
    }
  }

  openGradeModal(item: EnrollmentEnriched): void {
    this.selectedItemForGrade.set(item);
    this.gradeForm.reset({
      grade: item.enrollment.grade,
      status: item.enrollment.status,
    });
    this.isGradeModalOpen.set(true);
  }

  closeGradeModal(): void {
    this.isGradeModalOpen.set(false);
    this.selectedItemForGrade.set(null);
  }

  async onSubmitGrade(): Promise<void> {
    const item = this.selectedItemForGrade();
    if (!item || this.gradeForm.invalid) return;

    this.submittingGrade.set(true);
    const f = this.gradeForm.getRawValue();

    const req: EnrollmentUpdateRequest = {
      idEnrollment: item.enrollment.id,
      enrollmentDate: item.enrollment.enrollmentDate,
      studentId: item.enrollment.studentId,
      courseId: item.enrollment.courseId,
      grade: f.grade !== null && !Number.isNaN(f.grade) ? f.grade : null,
      status: f.status,
    };

    try {
      await firstValueFrom(this.enrollmentApi.update(req));
      this.snackbar.success('Procès-verbal de notation mis à jour.');
      this.closeGradeModal();
      this.loadData();
    } catch (err) {
      console.error('Erreur mise à jour note', err);
      this.snackbar.error('Impossible d’enregistrer la note sur le serveur.');
    } finally {
      this.submittingGrade.set(false);
    }
  }

  promptDelete(item: EnrollmentEnriched): void {
    this.selectedItemForDelete.set(item);
    this.isDeleteModalOpen.set(true);
  }

  cancelDelete(): void {
    this.isDeleteModalOpen.set(false);
    this.selectedItemForDelete.set(null);
  }

  async onConfirmDelete(): Promise<void> {
    const item = this.selectedItemForDelete();
    if (!item) return;

    this.deleting.set(true);
    try {
      await firstValueFrom(this.enrollmentApi.delete(item.enrollment.id));
      this.snackbar.success('Inscription supprimée avec succès.');
      this.cancelDelete();
      this.loadData();
    } catch (err) {
      console.error('Erreur suppression inscription', err);
      this.snackbar.error('Impossible de supprimer cette inscription.');
    } finally {
      this.deleting.set(false);
    }
  }
}

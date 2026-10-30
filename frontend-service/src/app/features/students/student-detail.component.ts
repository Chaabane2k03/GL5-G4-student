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
import { CourseApi } from '../../api/course/course.api';
import { EnrollmentApi } from '../../api/enrollment/enrollment.api';
import { Student, StudentUpdateRequest, getStudentFullName, getStudentMatricule } from '../../domain/student.model';
import { Department } from '../../domain/department.model';
import { Course } from '../../domain/course.model';
import { Enrollment, EnrollmentStatus, EnrollmentUpdateRequest } from '../../domain/enrollment.model';
import { getStudentAcademicSummary } from '../../core/utils/academic-metrics';
import { formatDateFrLong, formatDateFrShort } from '../../core/utils/date-utils';
import {
  ButtonComponent,
  AvatarComponent,
  DepartmentTagComponent,
  StatusBadgeComponent,
  DrawerComponent,
  ModalComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  ConfirmDialogComponent,
  SnackbarService,
} from '../../shared/ui';

interface TranscriptItem {
  enrollment: Enrollment;
  course: Course | null;
}

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    AvatarComponent,
    DepartmentTagComponent,
    StatusBadgeComponent,
    DrawerComponent,
    ModalComponent,
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
          <app-skeleton type="table-rows" [rows]="5" />
        </div>
      } @else if (error()) {
        <app-error-state
          title="Dossier étudiant introuvable"
          [message]="error()!"
          (retry)="loadData()"
        />
      } @else if (student()) {
        <!-- En-tête officiel du dossier étudiant -->
        <header class="student-header-card">
          <div class="header-top-nav">
            <a routerLink="/etudiants" class="back-link">
              <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              <span>Retour au registre des étudiants</span>
            </a>
            <div class="header-action-group">
              <app-button
                variant="secondary"
                icon="edit"
                (clicked)="openEditDrawer()"
              >
                Modifier le dossier
              </app-button>
              <app-button
                variant="danger"
                icon="person_remove"
                (clicked)="promptDelete()"
              >
                Supprimer
              </app-button>
            </div>
          </div>

          <div class="student-profile-main">
            <app-avatar [name]="fullName()" size="lg" />
            <div class="profile-text-group">
              <div class="name-matricule-row">
                <h1 class="student-full-name">{{ fullName() }}</h1>
                <span class="matricule-badge">{{ matricule() }}</span>
                <app-department-tag
                  [name]="departmentName()"
                  [departmentId]="student()!.departmentId"
                />
              </div>

              <div class="contact-details-row">
                <span class="meta-item">
                  <span class="material-symbols-outlined meta-icon" aria-hidden="true">mail</span>
                  <span>{{ student()!.email }}</span>
                </span>
                <span class="meta-separator" aria-hidden="true">•</span>
                <span class="meta-item">
                  <span class="material-symbols-outlined meta-icon" aria-hidden="true">call</span>
                  <span>{{ student()!.phone }}</span>
                </span>
                <span class="meta-separator" aria-hidden="true">•</span>
                <span class="meta-item">
                  <span class="material-symbols-outlined meta-icon" aria-hidden="true">cake</span>
                  <span>Né(e) le {{ formatDateLong(student()!.dateOfBirth) }}</span>
                </span>
                <span class="meta-separator" aria-hidden="true">•</span>
                <span class="meta-item">
                  <span class="material-symbols-outlined meta-icon" aria-hidden="true">home</span>
                  <span>{{ student()!.address }}</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        <!-- Tableau synthétique des performances académiques (LMD) -->
        <section class="academic-kpi-grid" aria-label="Indicateurs de progression universitaire">
          <article class="kpi-card">
            <span class="kpi-label">Crédits validés</span>
            <div class="kpi-value-group">
              <span class="kpi-number text-success">{{ academicSummary().validatedCredits }}</span>
              <span class="material-symbols-outlined kpi-icon icon-success" aria-hidden="true">verified</span>
            </div>
            <span class="kpi-subtext">ECTS acquis (statut validé)</span>
          </article>

          <article class="kpi-card">
            <span class="kpi-label">Crédits en cours</span>
            <div class="kpi-value-group">
              <span class="kpi-number text-info">{{ academicSummary().inProgressCredits }}</span>
              <span class="material-symbols-outlined kpi-icon icon-info" aria-hidden="true">pending</span>
            </div>
            <span class="kpi-subtext">ECTS inscrits ce semestre</span>
          </article>

          <article class="kpi-card">
            <span class="kpi-label">Moyenne pondérée</span>
            <div class="kpi-value-group">
              <span class="kpi-number">
                @if (academicSummary().weightedAverage !== null) {
                  {{ academicSummary().weightedAverage }}/20
                } @else {
                  —
                }
              </span>
              <span class="material-symbols-outlined kpi-icon" aria-hidden="true">insights</span>
            </div>
            <span class="kpi-subtext">Pondérée selon les ECTS</span>
          </article>

          <article class="kpi-card">
            <span class="kpi-label">Mention académique</span>
            <div class="kpi-value-group">
              <span class="kpi-number mention-text">
                {{ academicSummary().mention || 'En cours' }}
              </span>
              <span class="material-symbols-outlined kpi-icon icon-accent" aria-hidden="true">school</span>
            </div>
            <span class="kpi-subtext">
              @if (academicSummary().weightedAverage !== null) {
                Résultat délibéré par le jury
              } @else {
                En attente des évaluations
              }
            </span>
          </article>
        </section>

        <!-- Relevé de Notes & Registre des Inscriptions -->
        <section class="transcript-section" aria-label="Relevé officiel de notes">
          <div class="transcript-header">
            <div>
              <h2 class="transcript-title">Relevé Officiel de Notes & Inscriptions</h2>
              <p class="transcript-subtitle">
                Historique certifié des enseignements suivis, crédits associés et procès-verbaux de notation.
              </p>
            </div>
            <a
              [routerLink]="['/inscriptions/nouvelle']"
              [queryParams]="{ studentId: student()!.id }"
              class="btn-new-enroll"
            >
              <span class="material-symbols-outlined" aria-hidden="true">add</span>
              <span>Inscrire à un cours</span>
            </a>
          </div>

          @if (transcriptItems().length === 0) {
            <div class="empty-transcript-box">
              <app-empty-state
                icon="menu_book"
                title="Aucune inscription enregistrée"
                message="Cet étudiant n'est inscrit à aucune unité d'enseignement pour le moment."
                actionLabel="Procéder à une inscription"
                (action)="navigateToEnrollment()"
              />
            </div>
          } @else {
            <div class="table-container">
              <table class="ledger-table" aria-label="Tableau certifié du relevé de notes">
                <thead>
                  <tr>
                    <th scope="col" class="th-code">Code UV</th>
                    <th scope="col" class="th-title">Enseignement & Intitulé</th>
                    <th scope="col" class="th-credits">Crédits</th>
                    <th scope="col" class="th-date">Inscription</th>
                    <th scope="col" class="th-status">Statut</th>
                    <th scope="col" class="th-grade">Note / 20</th>
                    <th scope="col" class="th-actions text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of transcriptItems(); track item.enrollment.id) {
                    <tr class="ledger-row">
                      <td class="td-code">
                        <span class="code-pill">
                          {{ item.course ? item.course.code : '—' }}
                        </span>
                      </td>
                      <td class="td-title">
                        @if (item.course) {
                          <a [routerLink]="['/cours', item.course.id]" class="course-link">
                            {{ item.course.title }}
                          </a>
                        } @else {
                          <span class="course-id-fallback">Cours #{{ item.enrollment.courseId }}</span>
                        }
                      </td>
                      <td class="td-credits">
                        <span class="ects-tag">
                          <strong>{{ item.course ? item.course.credits : 0 }}</strong> ECTS
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
                          <span
                            class="grade-pill"
                            [class.grade-passed]="item.enrollment.grade >= 10"
                            [class.grade-failed]="item.enrollment.grade < 10"
                          >
                            <strong>{{ item.enrollment.grade }}</strong> / 20
                          </span>
                        } @else {
                          <span class="grade-pending">Non noté</span>
                        }
                      </td>
                      <td class="td-actions text-right">
                        <div class="table-actions">
                          <button
                            type="button"
                            class="icon-action-btn"
                            (click)="openGradeModal(item.enrollment)"
                            title="Saisir ou modifier la note"
                            aria-label="Modifier la note"
                          >
                            <span class="material-symbols-outlined" aria-hidden="true">rate_review</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Tiroir de modification du dossier étudiant -->
        <app-drawer
          [isOpen]="isDrawerOpen()"
          title="Modifier le dossier étudiant"
          subtitle="Mise à jour de la scolarité"
          (closed)="closeDrawer()"
        >
          <form [formGroup]="studentForm" (ngSubmit)="onSubmitStudentForm()" class="drawer-form">
            @if (formError()) {
              <div class="form-alert-error" role="alert">
                <span class="material-symbols-outlined" aria-hidden="true">error_outline</span>
                <span>{{ formError() }}</span>
              </div>
            }

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="edit-firstname" class="form-label required">Prénom</label>
                <input id="edit-firstname" type="text" formControlName="firstName" class="form-input" />
              </div>
              <div class="form-group flex-1">
                <label for="edit-lastname" class="form-label required">Nom</label>
                <input id="edit-lastname" type="text" formControlName="lastName" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label for="edit-email" class="form-label required">Email</label>
              <input id="edit-email" type="email" formControlName="email" class="form-input" />
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="edit-phone" class="form-label required">Téléphone</label>
                <input id="edit-phone" type="tel" formControlName="phone" class="form-input" />
              </div>
              <div class="form-group flex-1">
                <label for="edit-dob" class="form-label required">Date de naissance</label>
                <input id="edit-dob" type="date" formControlName="dateOfBirth" class="form-input" />
              </div>
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
              <label for="edit-address" class="form-label required">Adresse postale</label>
              <textarea id="edit-address" formControlName="address" class="form-textarea" rows="3"></textarea>
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
              (clicked)="onSubmitStudentForm()"
            >
              Enregistrer
            </app-button>
          </div>
        </app-drawer>

        <!-- Modal de Saisie / Modification de Note et Statut -->
        <app-modal
          [isOpen]="isGradeModalOpen()"
          title="Attribution de Note & Statut"
          badge="Jury d'examen"
          size="sm"
          (closed)="closeGradeModal()"
        >
          @if (editingEnrollment()) {
            <form [formGroup]="gradeForm" (ngSubmit)="onSubmitGrade()" class="grade-modal-form">
              <div class="form-group">
                <label for="grade-input" class="form-label">Note obtenue (/20)</label>
                <input
                  id="grade-input"
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  formControlName="grade"
                  class="form-input"
                  placeholder="Note de 0 à 20"
                />
                <span class="field-hint">Note sur 20. Laissez vide pour une inscription en cours sans note finale.</span>
              </div>

              <div class="form-group">
                <label for="status-select" class="form-label required">Statut d'inscription</label>
                <select id="status-select" formControlName="status" class="form-select">
                  <option value="ACTIVE">En cours (ACTIVE)</option>
                  <option value="COMPLETED">Validé (COMPLETED)</option>
                  <option value="FAILED">Ajourné / Non validé (FAILED)</option>
                  <option value="DROPPED">Abandonné (DROPPED)</option>
                  <option value="WITHDRAWN">Désistement (WITHDRAWN)</option>
                </select>
              </div>
            </form>
          }

          <div modal-footer class="modal-footer-btns">
            <app-button variant="outline" (clicked)="closeGradeModal()">Annuler</app-button>
            <app-button variant="primary" icon="check" (clicked)="onSubmitGrade()" [disabled]="gradeSubmitting()">
              Enregistrer la note
            </app-button>
          </div>
        </app-modal>

        <!-- Modal de suppression stricte avec avertissement définitif -->
        <app-confirm-dialog
          [isOpen]="isDeleteModalOpen()"
          title="Supprimer définitivement l'étudiant"
          badge="Acte administratif irréversible"
          [message]="'Êtes-vous certain de vouloir supprimer le dossier de ' + fullName() + ' ? Cette opération détruit son immatriculation et son historique académique.'"
          warning="Cette action est définitive."
          confirmLabel="Supprimer définitivement"
          cancelLabel="Annuler"
          variant="danger"
          icon="person_remove"
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

    .student-header-card {
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

    .student-profile-main {
      display: flex;
      align-items: flex-start;
      gap: 1.25rem;
      flex-wrap: wrap;
    }

    .profile-text-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }

    .name-matricule-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .student-full-name {
      font-family: var(--font-family-display);
      font-size: 1.875rem;
      color: var(--color-text-headline);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .matricule-badge {
      font-family: monospace;
      font-size: 0.95rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      color: var(--color-primary-container);
      letter-spacing: 0.05em;
    }

    .contact-details-row {
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

    /* KPI Grid */
    .academic-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .kpi-card {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      box-shadow: var(--shadow-ledger);
    }

    .kpi-label {
      font-size: var(--font-size-caption);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      color: var(--color-text-muted);
    }

    .kpi-value-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;

      .kpi-number {
        font-family: var(--font-family-display);
        font-size: 1.875rem;
        font-weight: 700;
        color: var(--color-text-headline);
        line-height: 1.2;

        &.text-success {
          color: var(--color-status-completed);
        }

        &.text-info {
          color: var(--color-status-active);
        }

        &.mention-text {
          font-size: 1.4rem;
        }
      }

      .kpi-icon {
        font-size: 28px;
        color: var(--color-border-ledger);

        &.icon-success {
          color: var(--color-status-completed);
        }

        &.icon-info {
          color: var(--color-status-active);
        }

        &.icon-accent {
          color: var(--color-primary-container);
        }
      }
    }

    .kpi-subtext {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
    }

    /* Section Transcript */
    .transcript-section {
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-ledger);
      overflow: hidden;
    }

    .transcript-header {
      padding: 1.25rem 1.5rem;
      background-color: var(--color-surface-subtle);
      border-bottom: 2px solid var(--color-border-ledger);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .transcript-title {
      font-family: var(--font-family-display);
      font-size: 1.25rem;
      color: var(--color-text-headline);
      margin: 0;
    }

    .transcript-subtitle {
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      margin: 0.25rem 0 0 0;
    }

    .btn-new-enroll {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.4rem 0.75rem;
      background-color: var(--color-surface-paper);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-sm);
      color: var(--color-text-main);
      font-size: var(--font-size-caption);
      font-weight: 600;
      text-decoration: none;

      .material-symbols-outlined {
        font-size: 16px;
      }

      &:hover {
        background-color: var(--color-surface-hover);
        border-color: var(--color-text-muted);
      }
    }

    .empty-transcript-box {
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

    .course-link {
      font-weight: 600;
      color: var(--color-text-headline);
      text-decoration: none;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .course-id-fallback {
      color: var(--color-text-muted);
      font-style: italic;
    }

    .ects-tag {
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

    .table-actions {
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

    /* Modal Form */
    .grade-modal-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 0.5rem 0;
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
export class StudentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentApi = inject(StudentApi);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly courseApi = inject(CourseApi);
  private readonly enrollmentApi = inject(EnrollmentApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly student = signal<Student | null>(null);
  readonly departments = signal<Department[]>([]);
  readonly enrollments = signal<Enrollment[]>([]);
  readonly coursesMap = signal<Map<number, Course>>(new Map());

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Drawer d'édition étudiant
  readonly isDrawerOpen = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  // Modal de notation
  readonly isGradeModalOpen = signal<boolean>(false);
  readonly editingEnrollment = signal<Enrollment | null>(null);
  readonly gradeSubmitting = signal<boolean>(false);

  // Modal de suppression
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly deleting = signal<boolean>(false);

  readonly fullName = computed(() => {
    const s = this.student();
    return s ? getStudentFullName(s) : '';
  });

  readonly matricule = computed(() => {
    const s = this.student();
    return s ? getStudentMatricule(s) : '';
  });

  readonly departmentName = computed(() => {
    const s = this.student();
    if (!s) return '';
    const dept = this.departments().find(d => d.id === s.departmentId);
    return dept ? dept.name : `Département #${s.departmentId}`;
  });

  // Synthèse LMD complète (ECTS acquis, ECTS en cours, moyenne pondérée, mention)
  readonly academicSummary = computed(() => {
    return getStudentAcademicSummary(this.enrollments(), this.coursesMap());
  });

  // Lignes du relevé certifié
  readonly transcriptItems = computed<TranscriptItem[]>(() => {
    const map = this.coursesMap();
    return this.enrollments().map(e => ({
      enrollment: e,
      course: map.get(e.courseId) || null,
    }));
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

  readonly gradeForm = new FormGroup({
    grade: new FormControl<number | null>(null, [Validators.min(0), Validators.max(20)]),
    status: new FormControl<EnrollmentStatus>('ACTIVE', { nonNullable: true, validators: [Validators.required] }),
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

  async loadData(studentId?: number): Promise<void> {
    const id = studentId ?? this.student()?.id;
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const [studentData, deptsData, enrollmentsData, allCourses] = await Promise.all([
        firstValueFrom(this.studentApi.getById(id)),
        firstValueFrom(this.departmentApi.getAll()),
        firstValueFrom(this.enrollmentApi.getByStudentId(id)),
        firstValueFrom(this.courseApi.getAllCatalog()),
      ]);

      this.student.set(studentData);
      this.departments.set(deptsData);
      this.enrollments.set(enrollmentsData);

      const cMap = new Map<number, Course>();
      for (const c of allCourses) {
        cMap.set(c.id, c);
      }
      this.coursesMap.set(cMap);

      this.loading.set(false);
    } catch (err) {
      console.error('Erreur chargement détails étudiant', err);
      this.error.set('Impossible de charger le dossier académique de cet étudiant.');
      this.loading.set(false);
    }
  }

  formatDateLong(date: string): string {
    return formatDateFrLong(date);
  }

  formatDateShort(date: string): string {
    return formatDateFrShort(date);
  }

  navigateToEnrollment(): void {
    void this.router.navigate(['/inscriptions/nouvelle'], {
      queryParams: { studentId: this.student()?.id },
    });
  }

  openEditDrawer(): void {
    const s = this.student();
    if (!s) return;

    this.formError.set(null);
    this.studentForm.reset({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone,
      dateOfBirth: s.dateOfBirth,
      departmentId: s.departmentId,
      address: s.address,
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.formError.set(null);
  }

  async onSubmitStudentForm(): Promise<void> {
    if (this.studentForm.invalid || !this.student()) return;

    this.submitting.set(true);
    this.formError.set(null);

    const f = this.studentForm.getRawValue();
    const req: StudentUpdateRequest = {
      id: this.student()!.id,
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      dateOfBirth: f.dateOfBirth,
      address: f.address.trim(),
      departmentId: f.departmentId!,
    };

    try {
      await firstValueFrom(this.studentApi.update(req));
      this.snackbar.success('Dossier étudiant mis à jour avec succès.');
      this.closeDrawer();
      void this.loadData(this.student()!.id);
    } catch (err) {
      console.error('Erreur mise à jour étudiant', err);
      this.formError.set('Impossible de modifier le dossier étudiant.');
    } finally {
      this.submitting.set(false);
    }
  }

  openGradeModal(enrollment: Enrollment): void {
    this.editingEnrollment.set(enrollment);
    this.gradeForm.reset({
      grade: enrollment.grade,
      status: enrollment.status,
    });
    this.isGradeModalOpen.set(true);
  }

  closeGradeModal(): void {
    this.isGradeModalOpen.set(false);
    this.editingEnrollment.set(null);
  }

  async onSubmitGrade(): Promise<void> {
    const e = this.editingEnrollment();
    if (!e || this.gradeForm.invalid) return;

    this.gradeSubmitting.set(true);
    const f = this.gradeForm.getRawValue();
    const req: EnrollmentUpdateRequest = {
      idEnrollment: e.id,
      enrollmentDate: e.enrollmentDate,
      studentId: e.studentId,
      courseId: e.courseId,
      grade: f.grade !== null && !Number.isNaN(f.grade) ? f.grade : null,
      status: f.status,
    };

    try {
      await firstValueFrom(this.enrollmentApi.update(req));
      this.snackbar.success('Note et statut enregistrés sur le relevé.');
      this.closeGradeModal();
      void this.loadData(this.student()!.id);
    } catch (err) {
      console.error('Erreur saisie note', err);
      this.snackbar.error('Impossible d’enregistrer la note sur le serveur.');
    } finally {
      this.gradeSubmitting.set(false);
    }
  }

  promptDelete(): void {
    this.isDeleteModalOpen.set(true);
  }

  async onConfirmDelete(): Promise<void> {
    const s = this.student();
    if (!s) return;

    this.deleting.set(true);
    try {
      await firstValueFrom(this.studentApi.delete(s.id));
      this.snackbar.success(`Le dossier de l'étudiant ${this.fullName()} a été définitivement supprimé.`);
      this.isDeleteModalOpen.set(false);
      void this.router.navigate(['/etudiants']);
    } catch (err) {
      console.error('Erreur suppression étudiant', err);
      this.snackbar.error('Impossible de supprimer le dossier de cet étudiant.');
    } finally {
      this.deleting.set(false);
    }
  }
}

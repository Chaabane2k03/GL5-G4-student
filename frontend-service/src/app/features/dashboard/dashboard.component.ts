import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DepartmentApi } from '../../api/department/department.api';
import { CourseApi } from '../../api/course/course.api';
import { StudentApi } from '../../api/student/student.api';
import { EnrollmentApi } from '../../api/enrollment/enrollment.api';
import { Department } from '../../domain/department.model';
import { Course } from '../../domain/course.model';
import { Student, getStudentMatricule } from '../../domain/student.model';
import { Enrollment, ENROLLMENT_STATUS_LABELS } from '../../domain/enrollment.model';
import {
  calculateDashboardAlerts,
  DecanatAlert,
} from '../../core/utils/academic-metrics';
import { formatDateFrShort } from '../../core/utils/date-utils';
import { AuthService } from '../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';

interface StatusDistribution {
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED' | 'FAILED' | 'WITHDRAWN';
  label: string;
  count: number;
  percentage: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

interface MonthlyDataPoint {
  monthKey: string;
  label: string;
  count: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    StatusBadgeComponent,
    SkeletonComponent,
    ErrorStateComponent,
    ButtonComponent,
  ],
  template: `
    <div class="dashboard-page">
      <!-- Salutation décanale et en-tête -->
      <header class="dashboard-header">
        <div class="greeting-zone">
          <div class="academic-badge" aria-hidden="true">
            <span class="badge-dot"></span>
            <span>Année Universitaire 2025–2026 &bull; Session Principale</span>
          </div>
          <h1 class="dashboard-title">
            Bonjour, {{ authService.greetingName() || 'Monsieur le Doyen' }}
          </h1>
          <p class="dashboard-subtitle">
            Voici la situation consolidée des registres d'inscription, effectifs étudiants et cours académiques.
          </p>
        </div>

        <div class="quick-actions">
          <app-button
            variant="outline"
            size="md"
            icon="refresh"
            [loading]="loading()"
            (clicked)="loadDashboardData()"
          >
            Actualiser
          </app-button>
          <a routerLink="/inscriptions/nouvelle" class="action-link-btn">
            <span class="material-symbols-outlined" aria-hidden="true">add</span>
            <span>Nouvelle inscription</span>
          </a>
        </div>
      </header>

      @if (error()) {
        <app-error-state
          title="Impossible de charger les indicateurs du décanat"
          [message]="error()!"
          (retry)="loadDashboardData()"
        ></app-error-state>
      } @else if (loading()) {
        <div class="loading-grid">
          <app-skeleton type="card"></app-skeleton>
          <app-skeleton type="card"></app-skeleton>
          <app-skeleton type="card"></app-skeleton>
          <app-skeleton type="card"></app-skeleton>
        </div>
        <div class="mt-4">
          <app-skeleton type="table-rows" [rows]="6"></app-skeleton>
        </div>
      } @else {
        <!-- Métriques exécutives décanales -->
        <section class="metrics-grid" aria-label="Indicateurs clés du décanat">
          <div class="metric-card" tabindex="0">
            <div class="metric-icon-wrap depts">
              <span class="material-symbols-outlined" aria-hidden="true">apartment</span>
            </div>
            <div class="metric-content">
              <span class="metric-label">Départements</span>
              <span class="metric-value">{{ departments().length }}</span>
            </div>
            <a routerLink="/departements" class="metric-link" aria-label="Consulter les départements">
              <span>Voir registre</span>
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </a>
          </div>

          <div class="metric-card" tabindex="0">
            <div class="metric-icon-wrap courses">
              <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
            </div>
            <div class="metric-content">
              <span class="metric-label">Enseignements actifs</span>
              <span class="metric-value">{{ activeCoursesCount() }}</span>
              <span class="metric-sub">{{ totalCoursesCount() }} au catalogue total</span>
            </div>
            <a routerLink="/cours" class="metric-link" aria-label="Consulter le catalogue des cours">
              <span>Voir catalogue</span>
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </a>
          </div>

          <div class="metric-card" tabindex="0">
            <div class="metric-icon-wrap students">
              <span class="material-symbols-outlined" aria-hidden="true">group</span>
            </div>
            <div class="metric-content">
              <span class="metric-label">Étudiants immatriculés</span>
              <span class="metric-value">{{ students().length }}</span>
            </div>
            <a routerLink="/etudiants" class="metric-link" aria-label="Consulter les étudiants">
              <span>Voir effectifs</span>
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </a>
          </div>

          <div class="metric-card" tabindex="0">
            <div class="metric-icon-wrap enrollments">
              <span class="material-symbols-outlined" aria-hidden="true">assignment</span>
            </div>
            <div class="metric-content">
              <span class="metric-label">Inscriptions en cours</span>
              <span class="metric-value">{{ activeEnrollmentsCount() }}</span>
              <span class="metric-sub">{{ enrollments().length }} actes au total</span>
            </div>
            <a routerLink="/inscriptions" class="metric-link" aria-label="Consulter les inscriptions">
              <span>Voir registre</span>
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </a>
          </div>
        </section>

        <!-- Graphiques d'activité : Trajectoire mensuelle & Répartition des statuts -->
        <section class="charts-section" aria-label="Analyses graphiques">
          <!-- Graphique de trajectoire mensuelle SVG fait main -->
          <div class="chart-card trajectory-card">
            <div class="card-header">
              <div class="header-titles">
                <span class="card-kicker">Rythme des admissions</span>
                <h2 class="card-title">Trajectoire des inscriptions</h2>
              </div>
              <span class="period-indicator">Septembre – Août</span>
            </div>

            <div class="svg-chart-container">
              <svg viewBox="0 0 600 220" class="trajectory-svg" preserveAspectRatio="none">
                <!-- Lignes de repère horizontales -->
                <line x1="40" y1="30" x2="580" y2="30" class="grid-line" />
                <line x1="40" y1="80" x2="580" y2="80" class="grid-line" />
                <line x1="40" y1="130" x2="580" y2="130" class="grid-line" />
                <line x1="40" y1="180" x2="580" y2="180" class="grid-axis" />

                <!-- Graduations Y -->
                <text x="32" y="34" class="axis-label" text-anchor="end">{{ maxMonthlyCount() }}</text>
                <text x="32" y="109" class="axis-label" text-anchor="end">{{ halfMonthlyCount() }}</text>
                <text x="32" y="184" class="axis-label" text-anchor="end">0</text>

                <!-- Aire sous la courbe avec dégradé subtil -->
                <defs>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#2f5d4e" stop-opacity="0.22" />
                    <stop offset="100%" stop-color="#2f5d4e" stop-opacity="0.01" />
                  </linearGradient>
                </defs>

                @if (monthlyDataPoints().length > 0) {
                  <path [attr.d]="svgAreaPath()" fill="url(#areaGradient)" />
                  <path [attr.d]="svgLinePath()" class="chart-line" />

                  <!-- Points de données -->
                  @for (pt of monthlyDataPoints(); track pt.monthKey) {
                    <g class="data-point-group">
                      <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" class="data-circle" />
                      <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="8" class="data-circle-hover" />
                      <!-- Étiquette mois sous l'axe X -->
                      <text [attr.x]="pt.x" y="202" class="axis-label" text-anchor="middle">
                        {{ pt.label }}
                      </text>
                    </g>
                  }
                }
              </svg>
            </div>
          </div>

          <!-- Jauge / Donut SVG fait main des statuts d'inscription -->
          <div class="chart-card distribution-card">
            <div class="card-header">
              <div class="header-titles">
                <span class="card-kicker">Exécution des études</span>
                <h2 class="card-title">Statut des inscriptions</h2>
              </div>
            </div>

            <div class="donut-content">
              <div class="donut-svg-wrap">
                <svg viewBox="0 0 160 160" class="donut-svg">
                  <!-- Cercle de fond -->
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke="var(--color-surface-subtle)"
                    stroke-width="18"
                  />
                  <!-- Segments colorés des 5 statuts -->
                  @for (seg of statusDistribution(); track seg.status) {
                    @if (seg.count > 0) {
                      <circle
                        cx="80"
                        cy="80"
                        r="60"
                        fill="none"
                        [attr.stroke]="seg.color"
                        stroke-width="18"
                        [attr.stroke-dasharray]="seg.dashArray"
                        [attr.stroke-dashoffset]="seg.dashOffset"
                        stroke-linecap="butt"
                        class="donut-segment"
                      />
                    }
                  }
                </svg>
                <div class="donut-center-label">
                  <span class="donut-total">{{ enrollments().length }}</span>
                  <span class="donut-text">Inscriptions</span>
                </div>
              </div>

              <!-- Légende des statuts -->
              <div class="donut-legend">
                @for (seg of statusDistribution(); track seg.status) {
                  <div class="legend-row">
                    <span class="legend-dot" [style.background-color]="seg.color"></span>
                    <span class="legend-label">{{ seg.label }}</span>
                    <span class="legend-count">{{ seg.count }}</span>
                    <span class="legend-pct">({{ seg.percentage }}%)</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- Alertes du Décanat & Dernières Inscriptions -->
        <section class="bottom-grid">
          <!-- Alertes académiques du Décanat -->
          <div class="card alerts-card">
            <div class="card-header">
              <div class="header-titles">
                <span class="card-kicker">Surveillance du registre</span>
                <h2 class="card-title">Alertes administratives</h2>
              </div>
              <span class="alerts-count-badge">{{ decanatAlerts().length }}</span>
            </div>

            @if (decanatAlerts().length === 0) {
              <div class="empty-alerts">
                <span class="material-symbols-outlined check-icon" aria-hidden="true">verified</span>
                <p>Aucune anomalie détectée dans les registres académiques.</p>
              </div>
            } @else {
              <div class="alerts-list">
                @for (alert of decanatAlerts(); track alert.id) {
                  <a [routerLink]="alert.route" class="alert-item" [class]="'severity-' + alert.severity">
                    <div class="alert-icon-box">
                      <span class="material-symbols-outlined" aria-hidden="true">
                        @if (alert.severity === 'error') {
                          report
                        } @else {
                          warning
                        }
                      </span>
                    </div>
                    <div class="alert-info">
                      <span class="alert-item-title">{{ alert.title }}</span>
                      <div class="alert-tags">
                        @for (tag of alert.tags; track tag) {
                          <span class="alert-tag">{{ tag }}</span>
                        }
                      </div>
                    </div>
                    <span class="material-symbols-outlined alert-chevron" aria-hidden="true">chevron_right</span>
                  </a>
                }
              </div>
            }
          </div>

          <!-- Dernières inscriptions enregistrées -->
          <div class="card latest-enrollments-card">
            <div class="card-header">
              <div class="header-titles">
                <span class="card-kicker">Actes récents</span>
                <h2 class="card-title">Dernières inscriptions</h2>
              </div>
              <a routerLink="/inscriptions" class="header-link">Tout afficher</a>
            </div>

            @if (latestEnrollments().length === 0) {
              <div class="empty-table-hint">
                <p>Aucune inscription n'a encore été enregistrée dans le système.</p>
              </div>
            } @else {
              <div class="table-container">
                <table class="ledger-table" aria-label="Dernières inscriptions">
                  <thead>
                    <tr>
                      <th scope="col">Étudiant</th>
                      <th scope="col">Enseignement</th>
                      <th scope="col">Date</th>
                      <th scope="col">Statut</th>
                      <th scope="col" class="text-right">Note /20</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of latestEnrollments(); track item.enrollment.id) {
                      <tr>
                        <td>
                          <div class="student-cell">
                            <a [routerLink]="['/etudiants', item.enrollment.studentId]" class="cell-link">
                              {{ item.studentName }}
                            </a>
                            <span class="student-mat">{{ item.studentMatricule }}</span>
                          </div>
                        </td>
                        <td>
                          <div class="course-cell">
                            <a [routerLink]="['/cours', item.enrollment.courseId]" class="cell-link">
                              <span class="code-tag">{{ item.courseCode }}</span>
                              <span class="course-title">{{ item.courseTitle }}</span>
                            </a>
                          </div>
                        </td>
                        <td class="date-cell">
                          {{ item.formattedDate }}
                        </td>
                        <td>
                          <app-status-badge [status]="item.enrollment.status" context="enrollment"></app-status-badge>
                        </td>
                        <td class="text-right grade-cell">
                          @if (item.enrollment.grade !== null) {
                            <strong [class.failing]="item.enrollment.grade < 10">
                              {{ item.enrollment.grade | number:'1.1-2':'fr' }}
                            </strong>
                          } @else {
                            <span class="grade-pending">—</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .academic-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--font-size-caption);
      color: var(--color-primary);
      background-color: rgba(47, 93, 78, 0.1);
      border: 1px solid rgba(47, 93, 78, 0.2);
      border-radius: var(--radius-full);
      padding: 0.25rem 0.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;

      .badge-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--color-primary-container);
      }
    }

    .dashboard-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-lg);
      font-weight: 700;
      color: var(--color-text-headline);
      margin: 0 0 0.25rem 0;
      line-height: 1.2;
    }

    .dashboard-subtitle {
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      margin: 0;
    }

    .quick-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .action-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background-color: var(--color-primary-container);
      color: var(--color-on-primary);
      border-radius: var(--radius-md);
      font-size: var(--font-size-body-sm);
      font-weight: 600;
      text-decoration: none;
      box-shadow: var(--shadow-sm);
      transition: background-color var(--transition-fast);

      &:hover {
        background-color: var(--color-primary-hover);
      }

      .material-symbols-outlined {
        font-size: 18px;
      }
    }

    .loading-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }

    .mt-4 {
      margin-top: 1.5rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }

    .metric-card {
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: box-shadow var(--transition-fast), border-color var(--transition-fast);

      &:hover {
        box-shadow: var(--shadow-md);
        border-color: var(--color-border-strong);
      }
    }

    .metric-icon-wrap {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;

      &.depts {
        background-color: rgba(47, 93, 78, 0.12);
        color: var(--color-primary-container);
      }
      &.courses {
        background-color: rgba(184, 92, 56, 0.12);
        color: var(--color-secondary-container);
      }
      &.students {
        background-color: rgba(74, 107, 130, 0.12);
        color: var(--dept-tone-2);
      }
      &.enrollments {
        background-color: rgba(194, 141, 53, 0.14);
        color: var(--status-dropped-border);
      }

      .material-symbols-outlined {
        font-size: 22px;
      }
    }

    .metric-content {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .metric-label {
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-value {
      font-family: var(--font-family-display);
      font-size: 2rem;
      font-weight: 700;
      color: var(--color-text-headline);
      line-height: 1.1;
    }

    .metric-sub {
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
    }

    .metric-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-primary-container);
      text-decoration: none;
      margin-top: auto;

      &:hover {
        text-decoration: underline;
      }

      .material-symbols-outlined {
        font-size: 16px;
      }
    }

    .charts-section {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.25rem;

      @media (max-width: 960px) {
        grid-template-columns: 1fr;
      }
    }

    .chart-card {
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--color-border-hairline);
      padding-bottom: 0.75rem;
    }

    .header-titles {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .card-kicker {
      font-size: var(--font-size-micro);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-subtle);
      font-weight: 600;
    }

    .card-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-headline-sm);
      color: var(--color-text-headline);
      margin: 0;
      font-weight: 600;
    }

    .period-indicator {
      font-size: var(--font-size-caption);
      color: var(--color-text-subtle);
      background-color: var(--color-surface-subtle);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-xs);
    }

    .svg-chart-container {
      width: 100%;
      height: 220px;
    }

    .trajectory-svg {
      width: 100%;
      height: 100%;
    }

    .grid-line {
      stroke: var(--color-surface-subtle);
      stroke-width: 1;
      stroke-dasharray: 4 3;
    }

    .grid-axis {
      stroke: var(--color-border-hairline);
      stroke-width: 1;
    }

    .axis-label {
      font-family: var(--font-family-mono);
      font-size: 10px;
      fill: var(--color-text-subtle);
    }

    .chart-line {
      fill: none;
      stroke: var(--color-primary-container);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .data-circle {
      fill: var(--color-surface-pure);
      stroke: var(--color-primary-container);
      stroke-width: 2.5;
    }

    .data-circle-hover {
      fill: var(--color-primary-container);
      opacity: 0;
      cursor: pointer;
      transition: opacity var(--transition-fast);

      &:hover {
        opacity: 0.3;
      }
    }

    .donut-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    .donut-svg-wrap {
      position: relative;
      width: 150px;
      height: 150px;
    }

    .donut-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .donut-segment {
      transition: stroke-width var(--transition-fast);

      &:hover {
        stroke-width: 22;
      }
    }

    .donut-center-label {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .donut-total {
      font-family: var(--font-family-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text-headline);
      line-height: 1;
    }

    .donut-text {
      font-size: var(--font-size-micro);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .donut-legend {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--font-size-caption);
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-label {
      flex: 1;
      color: var(--color-text-main);
    }

    .legend-count {
      font-family: var(--font-family-mono);
      font-weight: 600;
      color: var(--color-text-headline);
    }

    .legend-pct {
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
      width: 38px;
      text-align: right;
    }

    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1.25rem;

      @media (max-width: 960px) {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background-color: var(--color-surface-pure);
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .alerts-count-badge {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-caption);
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-full);
      background-color: var(--status-dropped-bg);
      color: var(--status-dropped-text);
      font-weight: 700;
    }

    .empty-alerts {
      padding: 2.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.5rem;
      color: var(--color-text-muted);
      font-size: var(--font-size-body-sm);

      .check-icon {
        font-size: 32px;
        color: var(--color-primary-container);
      }
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .alert-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border-hairline);
      background-color: var(--color-surface-paper);
      text-decoration: none;
      transition: background-color var(--transition-fast), border-color var(--transition-fast);

      &:hover {
        background-color: var(--color-surface-hover);
        border-color: var(--color-border-strong);
      }

      &.severity-error {
        border-left: 3px solid var(--status-failed-border);
        .alert-icon-box {
          color: var(--status-failed-border);
        }
      }

      &.severity-warning {
        border-left: 3px solid var(--status-dropped-border);
        .alert-icon-box {
          color: var(--status-dropped-border);
        }
      }
    }

    .alert-icon-box {
      font-size: 20px;
      flex-shrink: 0;
    }

    .alert-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .alert-item-title {
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-text-main);
      line-height: 1.3;
    }

    .alert-tags {
      display: flex;
      gap: 0.375rem;
    }

    .alert-tag {
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
      background-color: var(--color-surface-subtle);
      padding: 0.1rem 0.375rem;
      border-radius: var(--radius-xs);
    }

    .alert-chevron {
      font-size: 18px;
      color: var(--color-text-subtle);
    }

    .header-link {
      font-size: var(--font-size-caption);
      font-weight: 600;
      color: var(--color-primary-container);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .table-container {
      overflow-x: auto;
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-body-sm);
      text-align: left;

      th {
        font-size: var(--font-size-caption);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-subtle);
        padding: 0.625rem 0.75rem;
        border-bottom: 1px solid var(--color-border-hairline);
        background-color: var(--color-surface-subtle);
      }

      td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--color-border-hairline);
        vertical-align: middle;
      }

      tbody tr:hover {
        background-color: var(--color-surface-hover);
      }
    }

    .student-cell {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .cell-link {
      color: var(--color-text-main);
      font-weight: 600;
      text-decoration: none;

      &:hover {
        color: var(--color-primary-container);
        text-decoration: underline;
      }
    }

    .student-mat {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-micro);
      color: var(--color-text-subtle);
    }

    .course-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .code-tag {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-micro);
      font-weight: 700;
      background-color: var(--color-surface-subtle);
      border: 1px solid var(--color-border-hairline);
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-xs);
    }

    .course-title {
      font-size: var(--font-size-caption);
      color: var(--color-text-main);
    }

    .date-cell {
      font-size: var(--font-size-caption);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .text-right {
      text-align: right;
    }

    .grade-cell {
      font-family: var(--font-family-mono);
      font-weight: 600;

      .failing {
        color: var(--status-failed-border);
      }

      .grade-pending {
        color: var(--color-text-disabled);
      }
    }

    .empty-table-hint {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-body-sm);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly departmentApi = inject(DepartmentApi);
  private readonly courseApi = inject(CourseApi);
  private readonly studentApi = inject(StudentApi);
  private readonly enrollmentApi = inject(EnrollmentApi);

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly departments = signal<Department[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly students = signal<Student[]>([]);
  readonly enrollments = signal<Enrollment[]>([]);

  readonly activeCoursesCount = computed(
    () => this.courses().filter((c) => c.status === 'ACTIVE').length
  );
  readonly totalCoursesCount = computed(() => this.courses().length);

  readonly activeEnrollmentsCount = computed(
    () => this.enrollments().filter((e) => e.status === 'ACTIVE').length
  );

  readonly decanatAlerts = computed<DecanatAlert[]>(() => {
    const deptMap = new Map(this.departments().map((d) => [d.id, d.name]));
    return calculateDashboardAlerts(
      this.courses(),
      this.students(),
      this.enrollments(),
      deptMap
    );
  });

  // Calcul du donut SVG des statuts
  readonly statusDistribution = computed<StatusDistribution[]>(() => {
    const list = this.enrollments();
    const total = list.length;
    const circumference = 2 * Math.PI * 60; // r=60 -> ~376.99

    const config: {
      status: StatusDistribution['status'];
      color: string;
    }[] = [
      { status: 'ACTIVE', color: '#2f5d4e' },
      { status: 'COMPLETED', color: '#154537' },
      { status: 'DROPPED', color: '#c28d35' },
      { status: 'FAILED', color: '#ba1a1a' },
      { status: 'WITHDRAWN', color: '#8a7e74' },
    ];

    let currentOffset = 0;

    return config.map((cfg) => {
      const count = list.filter((e) => e.status === cfg.status).length;
      const fraction = total > 0 ? count / total : 0;
      const strokeLength = fraction * circumference;
      const dashArray = `${strokeLength} ${circumference - strokeLength}`;
      const dashOffset = -currentOffset;
      currentOffset += strokeLength;

      return {
        status: cfg.status,
        label: ENROLLMENT_STATUS_LABELS[cfg.status],
        count,
        percentage: total > 0 ? Math.round(fraction * 100) : 0,
        color: cfg.color,
        dashArray,
        dashOffset,
      };
    });
  });

  // Calcul de la trajectoire mensuelle SVG
  readonly monthlyDataPoints = computed<MonthlyDataPoint[]>(() => {
    const list = this.enrollments();
    // 12 mois de l'année universitaire de Septembre à Août
    const months = [
      { key: '09', label: 'Sept' },
      { key: '10', label: 'Oct' },
      { key: '11', label: 'Nov' },
      { key: '12', label: 'Déc' },
      { key: '01', label: 'Jan' },
      { key: '02', label: 'Fév' },
      { key: '03', label: 'Mar' },
      { key: '04', label: 'Avr' },
      { key: '05', label: 'Mai' },
      { key: '06', label: 'Juin' },
      { key: '07', label: 'Juil' },
      { key: '08', label: 'Août' },
    ];

    const counts: Record<string, number> = {};
    for (const m of months) {
      counts[m.key] = 0;
    }

    for (const e of list) {
      if (e.enrollmentDate) {
        const parts = e.enrollmentDate.split('-');
        if (parts.length >= 2) {
          const mKey = parts[1];
          if (counts[mKey] !== undefined) {
            counts[mKey]++;
          }
        }
      }
    }

    const maxVal = Math.max(1, ...Object.values(counts));
    const startX = 60;
    const endX = 560;
    const stepX = (endX - startX) / (months.length - 1);
    const topY = 30;
    const bottomY = 180;
    const height = bottomY - topY;

    return months.map((m, index) => {
      const c = counts[m.key] || 0;
      const x = Math.round(startX + index * stepX);
      const y = Math.round(bottomY - (c / maxVal) * height);
      return {
        monthKey: m.key,
        label: m.label,
        count: c,
        x,
        y,
      };
    });
  });

  readonly maxMonthlyCount = computed(() => {
    const pts = this.monthlyDataPoints();
    const max = Math.max(0, ...pts.map((p) => p.count));
    return max === 0 ? 5 : max;
  });

  readonly halfMonthlyCount = computed(() => Math.round(this.maxMonthlyCount() / 2));

  readonly svgLinePath = computed(() => {
    const pts = this.monthlyDataPoints();
    if (pts.length === 0) return '';
    return pts.reduce(
      (path, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`),
      ''
    );
  });

  readonly svgAreaPath = computed(() => {
    const pts = this.monthlyDataPoints();
    if (pts.length === 0) return '';
    const line = this.svgLinePath();
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${line} L ${last.x} 180 L ${first.x} 180 Z`;
  });

  // Dernières 6 inscriptions enrichies
  readonly latestEnrollments = computed(() => {
    const enrList = [...this.enrollments()].reverse().slice(0, 6);
    const studentMap = new Map(this.students().map((s) => [s.id, s]));
    const courseMap = new Map(this.courses().map((c) => [c.id, c]));

    return enrList.map((e) => {
      const student = studentMap.get(e.studentId);
      const course = courseMap.get(e.courseId);

      return {
        enrollment: e,
        studentName: student
          ? `${student.firstName} ${student.lastName}`
          : `Étudiant n°${e.studentId}`,
        studentMatricule: student ? getStudentMatricule(student) : `#${e.studentId}`,
        courseCode: course ? course.code : `C-${e.courseId}`,
        courseTitle: course ? course.title : `Cours n°${e.courseId}`,
        formattedDate: formatDateFrShort(e.enrollmentDate),
      };
    });
  });

  ngOnInit(): void {
    void this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [depts, courses, students, enrollments] = await Promise.all([
        firstValueFrom(this.departmentApi.getAll()),
        firstValueFrom(this.courseApi.getAllCatalog()),
        firstValueFrom(this.studentApi.getAll()),
        firstValueFrom(this.enrollmentApi.getAll()),
      ]);

      this.departments.set(depts);
      this.courses.set(courses);
      this.students.set(students);
      this.enrollments.set(enrollments);
    } catch (err: unknown) {
      console.error('Erreur lors du chargement du tableau de bord:', err);
      this.error.set(
        'Impossible de charger les registres académiques depuis la passerelle universitaire.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}

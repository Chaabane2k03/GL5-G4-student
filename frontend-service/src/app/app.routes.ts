import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'connexion',
    loadComponent: () =>
      import('./features/auth/connexion.component').then((m) => m.ConnexionComponent),
  },
  {
    path: '403',
    loadComponent: () =>
      import('./features/errors/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: '404',
    loadComponent: () =>
      import('./features/errors/not-found.component').then((m) => m.NotFoundComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tableau-de-bord',
      },
      {
        path: 'tableau-de-bord',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'cours',
        loadComponent: () =>
          import('./features/courses/courses-list.component').then((m) => m.CoursesListComponent),
      },
      {
        path: 'cours/:id',
        loadComponent: () =>
          import('./features/courses/course-detail.component').then((m) => m.CourseDetailComponent),
      },
      {
        path: 'departements',
        loadComponent: () =>
          import('./features/departments/departments-list.component').then(
            (m) => m.DepartmentsListComponent
          ),
      },
      {
        path: 'departements/:id',
        loadComponent: () =>
          import('./features/departments/department-detail.component').then(
            (m) => m.DepartmentDetailComponent
          ),
      },
      {
        path: 'etudiants',
        loadComponent: () =>
          import('./features/students/students-list.component').then((m) => m.StudentsListComponent),
      },
      {
        path: 'etudiants/:id',
        loadComponent: () =>
          import('./features/students/student-detail.component').then((m) => m.StudentDetailComponent),
      },
      {
        path: 'inscriptions',
        loadComponent: () =>
          import('./features/enrollments/enrollments-list.component').then(
            (m) => m.EnrollmentsListComponent
          ),
      },
      {
        path: 'inscriptions/nouvelle',
        loadComponent: () =>
          import('./features/enrollments/new-enrollment.component').then(
            (m) => m.NewEnrollmentComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '404',
  },
];

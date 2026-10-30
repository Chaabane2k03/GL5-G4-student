import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CourseApi } from '../../../app/api/course/course.api';
import { DepartmentApi } from '../../../app/api/department/department.api';
import { StudentApi } from '../../../app/api/student/student.api';
import { AuthService } from '../../../app/core/auth/auth.service';
import { ConfigService } from '../../../app/core/config/runtime-config';

export const authService = {
  currentUser: signal({
    username: 'ada',
    email: 'ada@example.com',
    fullName: 'Ada Lovelace',
  }),
  isSessionExpired: signal(false),
  logout: jasmine.createSpy('logout').and.resolveTo(),
  closeSessionExpiredModal: jasmine.createSpy('closeSessionExpiredModal'),
  login: jasmine.createSpy('login').and.resolveTo(),
};

export function configureLayoutTestBed(): void {
  authService.logout.calls.reset();
  authService.closeSessionExpiredModal.calls.reset();
  authService.login.calls.reset();

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authService },
      { provide: ConfigService, useValue: { apiBaseUrl: 'http://test', keycloak: {} } },
      { provide: DepartmentApi, useValue: { getAll: () => of([]) } },
      { provide: CourseApi, useValue: { getAllCatalog: () => of([]) } },
      { provide: StudentApi, useValue: { getAll: () => of([]) } },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

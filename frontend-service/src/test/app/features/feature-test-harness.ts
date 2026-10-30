import { NO_ERRORS_SCHEMA, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { CourseApi } from '../../../app/api/course/course.api';
import { DepartmentApi } from '../../../app/api/department/department.api';
import { EnrollmentApi } from '../../../app/api/enrollment/enrollment.api';
import { StudentApi } from '../../../app/api/student/student.api';
import { AuthService } from '../../../app/core/auth/auth.service';
import { Course } from '../../../app/domain/course.model';
import { Department } from '../../../app/domain/department.model';
import { Enrollment } from '../../../app/domain/enrollment.model';
import { Student } from '../../../app/domain/student.model';
import { SnackbarService } from '../../../app/shared/ui/snackbar/snackbar.service';

export const department: Department = {
  id: 1,
  name: 'Informatique',
  head: 'Dr Martin',
  location: 'Bâtiment A',
  phone: '0102030405',
};

export const course: Course = {
  id: 1,
  code: 'INF101',
  title: 'Algorithmique',
  departmentId: 1,
  credits: 6,
  description: 'Cours',
  status: 'ACTIVE',
  createdAt: '2025-01-01T00:00:00',
  updatedAt: '2025-01-01T00:00:00',
};

export const student: Student = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Martin',
  email: 'alice@example.com',
  phone: '0612345678',
  dateOfBirth: '2004-01-01',
  address: '1 rue de Paris',
  departmentId: 1,
};

export const enrollment: Enrollment = {
  id: 1,
  enrollmentDate: '2025-01-01',
  grade: 12,
  status: 'ACTIVE',
  studentId: 1,
  courseId: 1,
};

export const enrichedEnrollment = { enrollment, student, course };

const makeMocks = () => {
  const snackbar = {
    success: jasmine.createSpy('snackbar.success'),
    error: jasmine.createSpy('snackbar.error'),
    info: jasmine.createSpy('snackbar.info'),
    warning: jasmine.createSpy('snackbar.warning'),
  };

  const router = {
    navigate: jasmine.createSpy('router.navigate').and.resolveTo(true),
    navigateByUrl: jasmine.createSpy('router.navigateByUrl').and.resolveTo(true),
  };

  const departmentApi = {
    getAll: jasmine.createSpy('departmentApi.getAll').and.returnValue(of([department])),
    getById: jasmine.createSpy('departmentApi.getById').and.returnValue(of(department)),
    create: jasmine.createSpy('departmentApi.create').and.returnValue(of(department)),
    update: jasmine.createSpy('departmentApi.update').and.returnValue(of(department)),
    delete: jasmine.createSpy('departmentApi.delete').and.returnValue(of(void 0)),
  };

  const courseApi = {
    getPage: jasmine.createSpy('courseApi.getPage').and.returnValue(
      of({ content: [course], totalElements: 1, totalPages: 1, page: 0, size: 20, first: true, last: true }),
    ),
    getAllCatalog: jasmine.createSpy('courseApi.getAllCatalog').and.returnValue(of([course])),
    getById: jasmine.createSpy('courseApi.getById').and.returnValue(of(course)),
    create: jasmine.createSpy('courseApi.create').and.returnValue(of(course)),
    update: jasmine.createSpy('courseApi.update').and.returnValue(of(course)),
    archive: jasmine.createSpy('courseApi.archive').and.returnValue(of(void 0)),
    activate: jasmine.createSpy('courseApi.activate').and.returnValue(of(course)),
  };

  const studentApi = {
    getAll: jasmine.createSpy('studentApi.getAll').and.returnValue(of([student])),
    getById: jasmine.createSpy('studentApi.getById').and.returnValue(of(student)),
    create: jasmine.createSpy('studentApi.create').and.returnValue(of(student)),
    update: jasmine.createSpy('studentApi.update').and.returnValue(of(student)),
    delete: jasmine.createSpy('studentApi.delete').and.returnValue(of(void 0)),
  };

  const enrollmentApi = {
    getAll: jasmine.createSpy('enrollmentApi.getAll').and.returnValue(of([enrollment])),
    getByCourseId: jasmine.createSpy('enrollmentApi.getByCourseId').and.returnValue(of([enrollment])),
    getByStudentId: jasmine.createSpy('enrollmentApi.getByStudentId').and.returnValue(of([enrollment])),
    create: jasmine.createSpy('enrollmentApi.create').and.returnValue(of(1)),
    update: jasmine.createSpy('enrollmentApi.update').and.returnValue(of(void 0)),
    delete: jasmine.createSpy('enrollmentApi.delete').and.returnValue(of(void 0)),
  };

  const authService = {
    greetingName: () => 'Dr Martin',
  };

  return { snackbar, router, departmentApi, courseApi, studentApi, enrollmentApi, authService };
};

export type FeatureTestMocks = ReturnType<typeof makeMocks>;

export const setup = async <T>(
  component: Type<T>,
  routeOverrides: Record<string, unknown> = {},
): Promise<{ fixture: ComponentFixture<T>; component: T; mocks: FeatureTestMocks }> => {
  const mocks = makeMocks();
  const route = {
    paramMap: of(convertToParamMap({ id: '1' })),
    queryParams: of({}),
    ...routeOverrides,
  };

  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: mocks.router },
      { provide: DepartmentApi, useValue: mocks.departmentApi },
      { provide: CourseApi, useValue: mocks.courseApi },
      { provide: StudentApi, useValue: mocks.studentApi },
      { provide: EnrollmentApi, useValue: mocks.enrollmentApi },
      { provide: SnackbarService, useValue: mocks.snackbar },
      { provide: AuthService, useValue: mocks.authService },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  }).compileComponents();

  const fixture = TestBed.createComponent(component);
  return { fixture, component: fixture.componentInstance, mocks };
};

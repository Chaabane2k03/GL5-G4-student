import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { Enrollment } from '../../../../app/domain/enrollment.model';
import { setup, department, course, student, enrollment } from '../feature-test-harness';
import { DashboardComponent } from '../../../../app/features/dashboard/dashboard.component';

describe('DashboardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers dashboard initialization', async () => {
    const { fixture, component } = await setup(DashboardComponent);

    component.ngOnInit();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.loading()).toBeFalse();
    expect(component.departments()).toEqual([department]);
  });

  it('covers dashboard indicators, computations and error fallback', async () => {
    const { fixture, component, mocks } = await setup(DashboardComponent);

    component.ngOnInit();
    await fixture.whenStable();

    const activeCourse = { ...course, id: 1, status: 'ACTIVE' as const };
    const archivedCourse = { ...course, id: 2, status: 'ARCHIVED' as const };
    const enrollmentsList: Enrollment[] = [
      { id: 1, studentId: 1, courseId: 1, grade: 15, status: 'ACTIVE', enrollmentDate: '2025-09-10' },
      { id: 2, studentId: 1, courseId: 2, grade: 18, status: 'COMPLETED', enrollmentDate: '2025-10-15' },
      { id: 3, studentId: 2, courseId: 1, grade: 8, status: 'FAILED', enrollmentDate: '2025-11-20' },
      { id: 4, studentId: 2, courseId: 2, grade: null, status: 'DROPPED', enrollmentDate: '2025-12-05' },
      { id: 5, studentId: 3, courseId: 1, grade: null, status: 'WITHDRAWN', enrollmentDate: '2026-01-12' },
    ];

    component.courses.set([activeCourse, archivedCourse]);
    component.students.set([student]);
    component.enrollments.set(enrollmentsList);

    expect(component.activeCoursesCount()).toBe(1);
    expect(component.totalCoursesCount()).toBe(2);
    expect(component.activeEnrollmentsCount()).toBe(1);
    expect(component.statusDistribution().length).toBe(5);
    expect(component.monthlyDataPoints().length).toBe(12);
    expect(component.svgLinePath().startsWith('M')).toBeTrue();
    expect(component.svgAreaPath().includes('Z')).toBeTrue();
    expect(component.latestEnrollments().length).toBeGreaterThan(0);

    // Test error branch
    mocks.courseApi.getAllCatalog.and.returnValue(throwError(() => new Error('Gateway 503')));
    await component.loadDashboardData();
    expect(component.error()).toContain('Impossible de charger');
  });

  it('covers DashboardComponent decanatAlerts and maxMonthlyCount fallback', async () => {
    const { component } = await setup(DashboardComponent);

    component.enrollments.set([]);
    expect(component.maxMonthlyCount()).toBe(5);
    expect(component.halfMonthlyCount()).toBe(3);

    component.departments.set([department]);
    component.courses.set([{ ...course, status: 'ACTIVE' as const }]);
    expect(component.decanatAlerts().length).toBeGreaterThan(0);
  });

  it('covers DashboardComponent empty state SVG paths and fallback latest enrollments', async () => {
    const { component } = await setup(DashboardComponent);

    // Empty enrollments state
    component.enrollments.set([]);
    component.students.set([]);
    component.courses.set([]);

    expect(component.svgLinePath()).toContain('M 60 180');
    expect(component.svgAreaPath()).toContain('Z');

    const dist = component.statusDistribution();
    expect(dist[0].percentage).toBe(0);

    // Latest enrollments with null student and null course
    component.enrollments.set([enrollment]);
    const latest = component.latestEnrollments();
    expect(latest[0].studentName).toContain('Étudiant n°');
    expect(latest[0].courseCode).toBe('C-1');
    expect(latest[0].courseTitle).toBe('Cours n°1');
  });

  it('DashboardComponent: latestEnrollments with known student/course fills names', async () => {
    const { component } = await setup(DashboardComponent);
    component.enrollments.set([enrollment]);
    component.students.set([student]);
    component.courses.set([course]);
    const latest = component.latestEnrollments();
    expect(latest[0].studentName).toBe('Alice Martin');
    expect(latest[0].courseCode).toBe('INF101');
  });

  it('DashboardComponent: svgLinePath with single data point', async () => {
    const { component } = await setup(DashboardComponent);
    component.enrollments.set([enrollment]);
    const path = component.svgLinePath();
    expect(path).toContain('M');
  });
});

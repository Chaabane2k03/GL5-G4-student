import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { setup, department, course, student } from '../feature-test-harness';
import { NewEnrollmentComponent } from '../../../../app/features/enrollments/new-enrollment.component';

describe('NewEnrollmentComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers new enrollment success and partial failure navigation', async () => {
    const { fixture, component, mocks } = await setup(NewEnrollmentComponent, {
      queryParams: of({ studentId: '1', courseId: '1' }),
    });

    component.ngOnInit();
    await fixture.whenStable();
    mocks.enrollmentApi.create.and.returnValue(of(1));
    await component.submitEnrollments();
    expect(mocks.router.navigate).toHaveBeenCalledWith(['/inscriptions']);

    mocks.router.navigate.calls.reset();
    mocks.enrollmentApi.create.and.returnValues(throwError(() => new Error('fail')) as unknown as Observable<number>, of(1));
    component.selectedCourseIds.set(new Set([1, 2]));
    component.courses.set([course, { ...course, id: 2, code: 'INF102' }]);
    await component.submitEnrollments();

    expect(mocks.snackbar.warning).toHaveBeenCalled();
    expect(mocks.router.navigate).toHaveBeenCalledWith(['/inscriptions']);
  });

  it('covers NewEnrollmentComponent steps, filters, selection, and error branches', async () => {
    const { component, mocks } = await setup(NewEnrollmentComponent);

    component.departments.set([department]);
    component.students.set([student, { ...student, id: 2, firstName: 'Bob', lastName: 'Dylan', email: 'bob@univ.tn' }]);
    component.courses.set([course, { ...course, id: 2, code: 'MAT201', title: 'Calcul', departmentId: 2, credits: 4, status: 'ACTIVE' }]);

    // Computed properties & helpers
    expect(component.departmentsMap().get(1)).toBe('Informatique');
    expect(component.getFullName(student)).toBe('Alice Martin');
    expect(component.getMatricule(student)).toContain('MAT');
    expect(component.getDeptName(1)).toBe('Informatique');
    expect(component.getDeptName(999)).toBe('Département #999');

    // Filtering students and courses
    component.studentSearchQuery.set('Dylan');
    expect(component.filteredStudents().length).toBe(1);
    component.studentSearchQuery.set('');

    component.courseDeptFilter.set(1);
    expect(component.filteredCourses().length).toBe(1);
    component.courseSearchQuery.set('Algo');
    expect(component.filteredCourses().length).toBe(1);
    component.courseDeptFilter.set(null);
    component.courseSearchQuery.set('');

    // Selection, steps and toggling
    component.selectStudent(1);
    expect(component.selectedStudentId()).toBe(1);
    expect(component.chosenStudent()?.id).toBe(1);

    component.goToStep(2);
    expect(component.currentStep()).toBe(2);

    expect(component.isCourseSelected(1)).toBeFalse();
    component.toggleCourse(1);
    expect(component.isCourseSelected(1)).toBeTrue();
    expect(component.totalSelectedEcts()).toBe(6);
    component.toggleCourse(1);
    expect(component.isCourseSelected(1)).toBeFalse();

    // Event handlers
    component.onCourseDeptFilterChange({ target: { value: '1' } } as unknown as Event);
    expect(component.courseDeptFilter()).toBe(1);
    component.onDateChange({ target: { value: '2025-09-01' } } as unknown as Event);
    expect(component.enrollmentDate()).toBe('2025-09-01');
    component.onStatusChange({ target: { value: 'ACTIVE' } } as unknown as Event);
    expect(component.enrollmentStatus()).toBe('ACTIVE');

    // Load catalog error
    mocks.studentApi.getAll.and.returnValue(throwError(() => new Error('Cat error')));
    await component.loadCatalog();
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Submit failure on all courses (line 1097)
    mocks.enrollmentApi.create.and.returnValue(throwError(() => new Error('Fail all')));
    component.selectedCourseIds.set(new Set([1]));
    await component.submitEnrollments();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('covers NewEnrollmentComponent query params, search filters, and submit validation branches', async () => {
    const { component, mocks } = await setup(NewEnrollmentComponent);

    component.students.set([student]);
    component.courses.set([course]);

    // filteredStudents with email & matricule match
    component.studentSearchQuery.set('alice@example.com');
    expect(component.filteredStudents().length).toBe(1);
    component.studentSearchQuery.set('MAT-2004');
    expect(component.filteredStudents().length).toBe(1);
    component.studentSearchQuery.set('');

    // chosenStudent null branches
    component.selectedStudentId.set(null);
    expect(component.chosenStudent()).toBeNull();
    component.selectedStudentId.set(9999);
    expect(component.chosenStudent()).toBeNull();

    // onCourseDeptFilterChange with empty string
    component.onCourseDeptFilterChange({ target: { value: '' } } as unknown as Event);
    expect(component.courseDeptFilter()).toBeNull();

    // submitEnrollments early return branches
    component.selectedStudentId.set(null);
    component.selectedCourseIds.set(new Set());
    await component.submitEnrollments();
    expect(mocks.enrollmentApi.create).not.toHaveBeenCalled();

    component.selectedStudentId.set(1);
    component.selectedCourseIds.set(new Set());
    await component.submitEnrollments();
    expect(mocks.enrollmentApi.create).not.toHaveBeenCalled();
  });

  it('NewEnrollmentComponent: loadCatalog error branch', async () => {
    const { component, mocks } = await setup(NewEnrollmentComponent);
    mocks.courseApi.getAllCatalog.and.returnValue(throwError(() => new Error('fail')));
    await component.loadCatalog();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('NewEnrollmentComponent: submitEnrollments with null studentId exits early', async () => {
    const { component, mocks } = await setup(NewEnrollmentComponent);
    component.selectedStudentId.set(null);
    component.selectedCourseIds.set(new Set([1]));
    await component.submitEnrollments();
    expect(mocks.enrollmentApi.create).not.toHaveBeenCalled();
  });

  it('NewEnrollmentComponent: filteredCourses with no dept filter returns all', async () => {
    const { component } = await setup(NewEnrollmentComponent);
    component.courses.set([course]);
    component.courseDeptFilter.set(null);
    component.courseSearchQuery.set('');
    expect(component.filteredCourses().length).toBe(1);
  });

  it('NewEnrollmentComponent: filteredStudents matches matricule', async () => {
    const { component } = await setup(NewEnrollmentComponent);
    component.students.set([student]);
    component.studentSearchQuery.set('MAT');
    expect(component.filteredStudents().length).toBe(1);
  });
});

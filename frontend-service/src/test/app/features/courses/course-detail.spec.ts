import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { setup, department, course, student, enrollment } from '../feature-test-harness';
import { CourseDetailComponent } from '../../../../app/features/courses/course-detail.component';

describe('CourseDetailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers course detail loading, navigation, status toggle and form submission', async () => {
    const { fixture, component, mocks } = await setup(CourseDetailComponent);

    component.ngOnInit();
    await fixture.whenStable();
    component.course.set(course);
    component.navigateToNewEnrollment();
    component.toggleStatus();
    await fixture.whenStable();

    component.courseForm.setValue({
      code: 'INF101',
      title: 'Algorithmique avancée',
      departmentId: 1,
      credits: 6,
      description: 'Cours',
    });
    await component.onSubmitForm();

    expect(mocks.courseApi.archive).toHaveBeenCalledWith(1);
    expect(mocks.courseApi.update).toHaveBeenCalled();
    expect(mocks.router.navigate).toHaveBeenCalledWith(['/inscriptions/nouvelle'], {
      queryParams: { courseId: 1 },
    });
  });

  it('covers course detail cohort calculations, drawer and status activation', async () => {
    const { component, mocks } = await setup(CourseDetailComponent);

    const activeEnrollment = { ...enrollment, id: 1, status: 'ACTIVE' as const, grade: null };
    const completedEnrollment = { ...enrollment, id: 2, status: 'COMPLETED' as const, grade: 16 };
    const failedEnrollment = { ...enrollment, id: 3, status: 'FAILED' as const, grade: 8 };

    component.course.set({ ...course, status: 'ARCHIVED' as const });
    component.departments.set([department]);
    component.enrollments.set([activeEnrollment, completedEnrollment, failedEnrollment]);
    component.studentsMap.set(new Map([[1, student]]));

    // Cohort computed properties
    expect(component.departmentName()).toBe('Informatique');
    expect(component.activeCount()).toBe(1);
    expect(component.completedCount()).toBe(1);
    expect(component.failedCount()).toBe(1);
    expect(component.finishedCount()).toBe(2);
    expect(component.successRate()).toBe(50);
    expect(component.averageGrade()).toBe(12);
    expect(component.cohortMention()).toBe('Assez Bien');
    expect(component.enrolledStudents().length).toBe(3);

    // Toggle status from ARCHIVED to ACTIVE
    mocks.courseApi.activate.and.returnValue(of({ ...course, status: 'ACTIVE' as const }));
    component.toggleStatus();
    expect(mocks.courseApi.activate).toHaveBeenCalledWith(1);

    // Drawer open / close
    component.openEditDrawer();
    expect(component.isDrawerOpen()).toBeTrue();
    component.closeDrawer();
    expect(component.isDrawerOpen()).toBeFalse();

    // Form submission error branch
    component.openEditDrawer();
    mocks.courseApi.update.and.returnValue(throwError(() => new Error('Update failed')));
    await component.onSubmitForm();
    expect(component.formError()).toContain('Impossible de modifier');

    // Load data error branch
    mocks.courseApi.getById.and.returnValue(throwError(() => new Error('Course 404')));
    await component.loadCourseData(1);
    expect(component.error()).toContain('Impossible de charger');
  });

  it('covers CourseDetailComponent helpers, mentions, and toggle error branches', async () => {
    const { component, mocks } = await setup(CourseDetailComponent);

    component.course.set(course);

    expect(component.formatDateLong('2025-10-24')).toBe('24 octobre 2025');
    expect(component.formatDateShort('2025-10-24')).toBe('24 oct. 2025');
    expect(component.getStudentName(student)).toBe('Alice Martin');
    expect(component.getStudentName(null)).toBe('Étudiant');
    expect(component.getMatricule(student)).toContain('MAT');
    expect(component.getMatricule(null)).toBe('—');

    // Mentions: Passable and Insuffisant
    component.enrollments.set([{ ...enrollment, grade: 10.5 }]);
    expect(component.cohortMention()).toBe('Passable');
    component.enrollments.set([{ ...enrollment, grade: 6.0 }]);
    expect(component.cohortMention()).toBe('Insuffisant');

    // Toggle status error when ACTIVE (archive error)
    component.course.set({ ...course, status: 'ACTIVE' as const });
    mocks.courseApi.archive.and.returnValue(throwError(() => new Error('Archive err')));
    component.toggleStatus();
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Toggle status error when ARCHIVED (activate error)
    component.course.set({ ...course, status: 'ARCHIVED' as const });
    mocks.courseApi.activate.and.returnValue(throwError(() => new Error('Activate err')));
    component.toggleStatus();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('covers CourseDetailComponent all cohort mentions, successRate, averageGrade, and departmentName branches', async () => {
    const { component } = await setup(CourseDetailComponent);

    // departmentName when course is null
    component.course.set(null);
    expect(component.departmentName()).toBe('');

    // departmentName when department exists vs fallback
    component.course.set(course);
    component.departments.set([department]);
    expect(component.departmentName()).toBe('Informatique');
    component.departments.set([]);
    expect(component.departmentName()).toBe('Département n°1');

    // Finished count = 0 -> successRate = null, averageGrade = null, cohortMention = 'Non noté'
    component.enrollments.set([]);
    expect(component.successRate()).toBeNull();
    expect(component.averageGrade()).toBeNull();
    expect(component.cohortMention()).toBe('Non noté');

    // Mentions: Très Bien (>=16), Bien (>=14), Assez Bien (>=12)
    component.enrollments.set([{ ...enrollment, status: 'COMPLETED', grade: 16.5 }]);
    expect(component.cohortMention()).toBe('Très Bien');
    expect(component.successRate()).toBe(100);

    component.enrollments.set([{ ...enrollment, status: 'COMPLETED', grade: 14.5 }]);
    expect(component.cohortMention()).toBe('Bien');

    component.enrollments.set([{ ...enrollment, status: 'COMPLETED', grade: 12.5 }]);
    expect(component.cohortMention()).toBe('Assez Bien');

    // enrolledStudents with missing student in map
    component.studentsMap.set(new Map());
    expect(component.enrolledStudents()[0].student).toBeNull();

    // loadCourseData with fallback to course()?.id and when id is null
    await component.loadCourseData();
    component.course.set(null);
    await component.loadCourseData();
  });

  it('CourseDetailComponent: loadCourseData with no id exits early when no arg and no course', async () => {
    const { component, mocks } = await setup(CourseDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.course.set(null);
    await component.loadCourseData();
    expect(mocks.courseApi.getById).not.toHaveBeenCalled();
  });

  it('CourseDetailComponent: loadCourseData uses existing course id when no arg', async () => {
    const { component, mocks } = await setup(CourseDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.course.set(course);
    await component.loadCourseData();
    expect(mocks.courseApi.getById).toHaveBeenCalledWith(1);
  });

  it('CourseDetailComponent: toggleStatus when course is null exits early', async () => {
    const { component, mocks } = await setup(CourseDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.course.set(null);
    component.toggleStatus();
    expect(mocks.courseApi.archive).not.toHaveBeenCalled();
    expect(mocks.courseApi.activate).not.toHaveBeenCalled();
  });

  it('CourseDetailComponent: toggleStatus ACTIVE calls archive', async () => {
    const { component, mocks } = await setup(CourseDetailComponent);
    component.course.set({ ...course, status: 'ACTIVE' });
    mocks.courseApi.archive.and.returnValue(of(void 0));
    component.toggleStatus();
    expect(mocks.courseApi.archive).toHaveBeenCalledWith(1);
  });

  it('CourseDetailComponent: toggleStatus ACTIVE archive error branch', async () => {
    const { component, mocks } = await setup(CourseDetailComponent);
    component.course.set({ ...course, status: 'ACTIVE' });
    mocks.courseApi.archive.and.returnValue(throwError(() => new Error('fail')));
    component.toggleStatus();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('CourseDetailComponent: toggleStatus ARCHIVED activate error branch', async () => {
    const { component, mocks } = await setup(CourseDetailComponent);
    component.course.set({ ...course, status: 'ARCHIVED' });
    mocks.courseApi.activate.and.returnValue(throwError(() => new Error('fail')));
    component.toggleStatus();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('CourseDetailComponent: openEditDrawer when course is null exits early', async () => {
    const { component } = await setup(CourseDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.course.set(null);
    component.openEditDrawer();
    expect(component.isDrawerOpen()).toBeFalse();
  });

  it('CourseDetailComponent: onSubmitForm when course is null exits early', async () => {
    const { component, mocks } = await setup(CourseDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.course.set(null);
    component.courseForm.setValue({ code: 'A', title: 'B', departmentId: 1, credits: 6, description: '' });
    await component.onSubmitForm();
    expect(mocks.courseApi.update).not.toHaveBeenCalled();
  });

  it('CourseDetailComponent: onSubmitForm with no description uses null', async () => {
    const { component, mocks } = await setup(CourseDetailComponent);
    component.course.set(course);
    component.courseForm.setValue({ code: 'INF101', title: 'Algo', departmentId: 1, credits: 6, description: '' });
    await component.onSubmitForm();
    expect(mocks.courseApi.update).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ description: null }),
    );
  });
});

import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { setup, department, course, student, enrollment } from '../feature-test-harness';
import { StudentDetailComponent } from '../../../../app/features/students/student-detail.component';

describe('StudentDetailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers student detail loading, navigation, update, grading and deletion', async () => {
    const { fixture, component, mocks } = await setup(StudentDetailComponent);

    component.ngOnInit();
    await fixture.whenStable();
    component.student.set(student);
    component.navigateToEnrollment();
    component.studentForm.setValue({
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice@example.com',
      phone: '0612345678',
      dateOfBirth: '2004-01-01',
      departmentId: 1,
      address: '1 rue de Paris',
    });
    await component.onSubmitStudentForm();
    component.editingEnrollment.set(enrollment);
    component.gradeForm.setValue({ grade: 12, status: 'COMPLETED' });
    await component.onSubmitGrade();
    await component.onConfirmDelete();

    expect(mocks.studentApi.update).toHaveBeenCalled();
    expect(mocks.enrollmentApi.update).toHaveBeenCalled();
    expect(mocks.studentApi.delete).toHaveBeenCalledWith(1);
    expect(mocks.router.navigate).toHaveBeenCalledWith(['/etudiants']);
  });

  it('covers StudentDetailComponent computed summaries, drawer, and error handling', async () => {
    const { component, mocks } = await setup(StudentDetailComponent);

    component.student.set(student);
    component.departments.set([department]);
    component.coursesMap.set(new Map([[1, course]]));
    component.enrollments.set([enrollment]);

    // Computed properties
    expect(component.fullName()).toBe('Alice Martin');
    expect(component.matricule()).toContain('MAT');
    expect(component.departmentName()).toBe('Informatique');
    expect(component.academicSummary()).toBeDefined();
    expect(component.transcriptItems().length).toBe(1);

    expect(component.formatDateLong('2025-10-24')).toBe('24 octobre 2025');
    expect(component.formatDateShort('2025-10-24')).toBe('24 oct. 2025');

    // Drawer open / close
    component.openEditDrawer();
    expect(component.isDrawerOpen()).toBeTrue();
    component.closeDrawer();
    expect(component.isDrawerOpen()).toBeFalse();

    // Submit student form error branch
    component.openEditDrawer();
    mocks.studentApi.update.and.returnValue(throwError(() => new Error('Update err')));
    await component.onSubmitStudentForm();
    expect(component.formError()).toContain('Impossible de modifier');

    // Grade modal open / close / submit error
    component.openGradeModal(enrollment);
    expect(component.isGradeModalOpen()).toBeTrue();
    component.closeGradeModal();
    expect(component.isGradeModalOpen()).toBeFalse();

    component.openGradeModal(enrollment);
    mocks.enrollmentApi.update.and.returnValue(throwError(() => new Error('Grade err')));
    await component.onSubmitGrade();
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Delete modal prompt and confirm error branch
    component.promptDelete();
    expect(component.isDeleteModalOpen()).toBeTrue();
    mocks.studentApi.delete.and.returnValue(throwError(() => new Error('Delete err')));
    await component.onConfirmDelete();
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Load data failure
    mocks.studentApi.getById.and.returnValue(throwError(() => new Error('Not found')));
    await component.loadData(1);
    expect(component.error()).toContain('Impossible de charger');
  });

  it('covers StudentDetailComponent computed branches and null fallbacks', async () => {
    const { component } = await setup(StudentDetailComponent);

    // When student is null
    component.student.set(null);
    expect(component.fullName()).toBe('');
    expect(component.matricule()).toBe('');
    expect(component.departmentName()).toBe('');

    // When student is set but departments list is empty
    component.student.set(student);
    component.departments.set([]);
    expect(component.departmentName()).toBe('Département #1');

    component.departments.set([department]);
    expect(component.departmentName()).toBe('Informatique');

    // transcriptItems with unmapped course
    component.enrollments.set([enrollment]);
    component.coursesMap.set(new Map());
    expect(component.transcriptItems()[0].course).toBeNull();
  });

  it('StudentDetailComponent: loadData with no id and no student exits early', async () => {
    const { component, mocks } = await setup(StudentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.student.set(null);
    await component.loadData();
    expect(mocks.studentApi.getById).not.toHaveBeenCalled();
  });

  it('StudentDetailComponent: loadData uses existing student id when no arg', async () => {
    const { component, mocks } = await setup(StudentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.student.set(student);
    await component.loadData();
    expect(mocks.studentApi.getById).toHaveBeenCalledWith(1);
  });

  it('StudentDetailComponent: openEditDrawer when student is null exits early', async () => {
    const { component } = await setup(StudentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.student.set(null);
    component.openEditDrawer();
    expect(component.isDrawerOpen()).toBeFalse();
  });

  it('StudentDetailComponent: onSubmitStudentForm when student is null exits early', async () => {
    const { component, mocks } = await setup(StudentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.student.set(null);
    component.studentForm.setValue({
      firstName: 'A', lastName: 'B', email: 'a@b.com',
      phone: '0600000000', dateOfBirth: '2000-01-01',
      departmentId: 1, address: '1 rue',
    });
    await component.onSubmitStudentForm();
    expect(mocks.studentApi.update).not.toHaveBeenCalled();
  });

  it('StudentDetailComponent: onSubmitGrade with null enrollment exits early', async () => {
    const { component, mocks } = await setup(StudentDetailComponent);
    component.editingEnrollment.set(null);
    component.student.set(student);
    await component.onSubmitGrade();
    expect(mocks.enrollmentApi.update).not.toHaveBeenCalled();
  });

  it('StudentDetailComponent: onSubmitGrade with NaN grade uses null', async () => {
    const { component, mocks } = await setup(StudentDetailComponent);
    component.student.set(student);
    component.editingEnrollment.set(enrollment);
    component.gradeForm.reset({ grade: null, status: 'ACTIVE' });
    await component.onSubmitGrade();
    expect(mocks.enrollmentApi.update).toHaveBeenCalledWith(
      jasmine.objectContaining({ grade: null }),
    );
  });

  it('StudentDetailComponent: onConfirmDelete when student is null exits early', async () => {
    const { component, mocks } = await setup(StudentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.student.set(null);
    await component.onConfirmDelete();
    expect(mocks.studentApi.delete).not.toHaveBeenCalled();
  });
});

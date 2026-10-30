import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { setup, department, course, student } from '../feature-test-harness';
import { DepartmentDetailComponent } from '../../../../app/features/departments/department-detail.component';

describe('DepartmentDetailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers department detail update and deletion navigation', async () => {
    const { fixture, component, mocks } = await setup(DepartmentDetailComponent);

    component.ngOnInit();
    await fixture.whenStable();
    component.department.set(department);
    component.deptForm.setValue({
      name: 'Informatique',
      head: 'Dr Martin',
      location: 'Bâtiment A',
      phone: '0102030405',
    });
    await component.onSubmitForm();
    await component.onConfirmDelete();

    expect(mocks.departmentApi.update).toHaveBeenCalled();
    expect(mocks.departmentApi.delete).toHaveBeenCalledWith(1);
    expect(mocks.router.navigate).toHaveBeenCalledWith(['/departements']);
  });

  it('covers department detail tabs, cohort metrics, searching and form error branch', async () => {
    const { component, mocks } = await setup(DepartmentDetailComponent);

    component.department.set(department);
    component.courses.set([
      course,
      { ...course, id: 2, code: 'INF102', title: 'Bases de Données', credits: 4, status: 'ARCHIVED' as const },
    ]);
    component.students.set([student]);

    // Metrics
    expect(component.activeCoursesCount()).toBe(1);
    expect(component.archivedCoursesCount()).toBe(1);
    expect(component.totalEcts()).toBe(10);

    // Queries
    component.courseQuery.set('données');
    expect(component.filteredCourses().length).toBe(1);
    component.courseQuery.set('');

    component.studentQuery.set('Alice');
    expect(component.filteredStudents().length).toBe(1);
    component.studentQuery.set('');

    // Tabs & Helpers
    component.activeTab.set('students');
    expect(component.activeTab()).toBe('students');
    expect(component.getStudentName(student)).toBe('Alice Martin');
    expect(component.getMatricule(student)).toContain('MAT');

    // Drawer edit & submit failure
    component.openEditDrawer();
    expect(component.isDrawerOpen()).toBeTrue();
    component.closeDrawer();
    expect(component.isDrawerOpen()).toBeFalse();

    component.openEditDrawer();
    mocks.departmentApi.update.and.returnValue(throwError(() => new Error('Update failed')));
    await component.onSubmitForm();
    expect(component.formError()).toContain('Impossible de modifier');

    // Delete error branch
    mocks.departmentApi.delete.and.returnValue(throwError(() => new Error('Delete failed')));
    await component.onConfirmDelete();
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Load data failure
    mocks.departmentApi.getById.and.returnValue(throwError(() => new Error('404')));
    await component.loadData(1);
    expect(component.error()).toContain('Impossible de charger');
  });

  it('covers DepartmentDetailComponent search branches', async () => {
    const { component: deptDetail } = await setup(DepartmentDetailComponent);

    deptDetail.courses.set([course]);
    deptDetail.students.set([student]);

    // filteredCourses in DepartmentDetailComponent
    deptDetail.courseQuery.set('INF101');
    expect(deptDetail.filteredCourses().length).toBe(1);
    deptDetail.courseQuery.set('Algorithmique');
    expect(deptDetail.filteredCourses().length).toBe(1);
    deptDetail.courseQuery.set('inexistant');
    expect(deptDetail.filteredCourses().length).toBe(0);
    deptDetail.courseQuery.set('');

    // filteredStudents in DepartmentDetailComponent
    deptDetail.studentQuery.set('Alice');
    expect(deptDetail.filteredStudents().length).toBe(1);
    deptDetail.studentQuery.set('Martin');
    expect(deptDetail.filteredStudents().length).toBe(1);
    deptDetail.studentQuery.set('alice@example.com');
    expect(deptDetail.filteredStudents().length).toBe(1);
    deptDetail.studentQuery.set('inexistant');
    expect(deptDetail.filteredStudents().length).toBe(0);
    deptDetail.studentQuery.set('');
  });

  it('DepartmentDetailComponent: loadData with no id and no department returns early', async () => {
    const { component, mocks } = await setup(DepartmentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.department.set(null);
    await component.loadData();
    expect(mocks.departmentApi.getById).not.toHaveBeenCalled();
  });

  it('DepartmentDetailComponent: loadData uses existing department id when no arg', async () => {
    const { component, mocks } = await setup(DepartmentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.department.set(department);
    await component.loadData();
    expect(mocks.departmentApi.getById).toHaveBeenCalledWith(1);
  });

  it('DepartmentDetailComponent: openEditDrawer when no department exits early', async () => {
    const { component } = await setup(DepartmentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.department.set(null);
    component.openEditDrawer();
    expect(component.isDrawerOpen()).toBeFalse();
  });

  it('DepartmentDetailComponent: onSubmitForm when no department exits early', async () => {
    const { component, mocks } = await setup(DepartmentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.department.set(null);
    component.deptForm.setValue({ name: 'X', head: 'Y', location: 'Z', phone: '12345' });
    await component.onSubmitForm();
    expect(mocks.departmentApi.update).not.toHaveBeenCalled();
  });

  it('DepartmentDetailComponent: onConfirmDelete when no department exits early', async () => {
    const { component, mocks } = await setup(DepartmentDetailComponent, {
      paramMap: of(convertToParamMap({})),
    });
    component.department.set(null);
    await component.onConfirmDelete();
    expect(mocks.departmentApi.delete).not.toHaveBeenCalled();
  });

  it('DepartmentDetailComponent: filteredStudents with no query returns all', async () => {
    const { component } = await setup(DepartmentDetailComponent);
    component.students.set([student]);
    component.studentQuery.set('');
    expect(component.filteredStudents().length).toBe(1);
  });

  it('DepartmentDetailComponent: filteredCourses with no query returns all', async () => {
    const { component } = await setup(DepartmentDetailComponent);
    component.courses.set([course]);
    component.courseQuery.set('');
    expect(component.filteredCourses().length).toBe(1);
  });
});

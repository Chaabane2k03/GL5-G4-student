import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { setup, department, course, student } from '../feature-test-harness';
import { DepartmentsListComponent } from '../../../../app/features/departments/departments-list.component';

describe('DepartmentsListComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers department list creation and deletion', async () => {
    const { fixture, component, mocks } = await setup(DepartmentsListComponent);

    component.ngOnInit();
    await fixture.whenStable();
    component.deptForm.setValue({
      name: 'Informatique',
      head: 'Dr Martin',
      location: 'Bâtiment A',
      phone: '0102030405',
    });
    await component.onSubmitForm();
    component.deletingDept.set({ ...department, courseCount: 0, studentCount: 0 });
    await component.onConfirmDelete();

    expect(mocks.departmentApi.create).toHaveBeenCalled();
    expect(mocks.departmentApi.delete).toHaveBeenCalledWith(1);
  });

  it('covers departments list searching, sorting, pagination, drawer edit and error branches', async () => {
    const { component, mocks } = await setup(DepartmentsListComponent);

    component.departments.set([
      { ...department, id: 1, name: 'Informatique', head: 'Dr Martin', location: 'Bât A', phone: '0102030405', courseCount: 5, studentCount: 20 },
      { ...department, id: 2, name: 'Mathématiques', head: 'Dr Euler', location: 'Bât B', phone: '0607080910', courseCount: 2, studentCount: 15 },
    ]);

    // Search & Sort
    component.onSearchChange('math');
    expect(component.filteredDepartments().length).toBe(1);
    component.onSearchChange('');

    component.toggleSort('name');
    component.toggleSort('name');
    component.toggleSort('head');
    component.toggleSort('courseCount');
    component.toggleSort('studentCount');
    expect(component.paginatedDepartments().length).toBe(2);

    // Pagination
    component.onPageChange(1);
    expect(component.page()).toBe(1);
    component.onPageSizeChange(25);
    expect(component.pageSize()).toBe(25);

    // Edit drawer
    component.openEditDrawer(department);
    expect(component.isDrawerOpen()).toBeTrue();
    expect(component.editingDept()).toEqual(department);
    component.closeDrawer();
    expect(component.isDrawerOpen()).toBeFalse();

    // Invalid form submission
    component.deptForm.patchValue({ name: '' });
    await component.onSubmitForm();
    expect(component.submitting()).toBeFalse();

    // Submit update success
    component.openEditDrawer(department);
    component.deptForm.setValue({
      name: 'Informatique Appliquée',
      head: 'Dr Turing',
      location: 'Bât C',
      phone: '0123456789',
    });
    mocks.departmentApi.update.and.returnValue(of(department));
    await component.onSubmitForm();
    expect(mocks.departmentApi.update).toHaveBeenCalled();
    expect(mocks.snackbar.success).toHaveBeenCalled();

    // Submit error branch
    component.openCreateDrawer();
    component.deptForm.setValue({
      name: 'Physique',
      head: 'Dr Curie',
      location: 'Bât D',
      phone: '0987654321',
    });
    mocks.departmentApi.create.and.returnValue(throwError(() => new Error('Server 500')));
    await component.onSubmitForm();
    expect(component.formError()).toContain('Impossible d’enregistrer');

    // Delete modal cancellation & error branch
    const deptSummary = { ...department, courseCount: 2, studentCount: 5 };
    component.promptDelete(deptSummary);
    expect(component.isDeleteModalOpen()).toBeTrue();
    expect(component.deleteDialogMessage()).toContain('Informatique');
    component.cancelDelete();
    expect(component.isDeleteModalOpen()).toBeFalse();

    mocks.departmentApi.delete.and.returnValue(throwError(() => new Error('Constraint violation')));
    component.deletingDept.set(deptSummary);
    await component.onConfirmDelete();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('covers DepartmentsListComponent search and sort branches', async () => {
    const { component: deptsList } = await setup(DepartmentsListComponent);

    const deptSummary1 = { ...department, id: 1, name: 'Informatique', head: 'Dr Martin', location: 'Bât A', phone: '0102030405', courseCount: 5, studentCount: 20 };
    const deptSummary2 = { ...department, id: 2, name: 'Biologie', head: 'Dr Bernard', location: 'Bât B', phone: '0908070605', courseCount: 2, studentCount: 10 };
    deptsList.departments.set([deptSummary1, deptSummary2]);

    // search query in DepartmentsListComponent
    deptsList.searchQuery.set('Informatique');
    expect(deptsList.filteredDepartments().length).toBe(1);
    deptsList.searchQuery.set('Bernard');
    expect(deptsList.filteredDepartments().length).toBe(1);
    deptsList.searchQuery.set('Bât A');
    expect(deptsList.filteredDepartments().length).toBe(1);
    deptsList.searchQuery.set('0908070605');
    expect(deptsList.filteredDepartments().length).toBe(1);
    deptsList.searchQuery.set('');

    // sort in DepartmentsListComponent
    for (const field of ['name', 'head', 'courseCount', 'studentCount', 'unknown_field']) {
      deptsList.sortField.set(field);
      deptsList.sortDir.set('asc');
      expect(deptsList.filteredDepartments().length).toBe(2);
      deptsList.sortDir.set('desc');
      expect(deptsList.filteredDepartments().length).toBe(2);
    }

    // deleteDialogMessage with null
    deptsList.deletingDept.set(null);
    expect(deptsList.deleteDialogMessage()).toBe('');
  });

  it('DepartmentsListComponent: loadData populates courseCount=0 when no match', async () => {
    const { component, mocks } = await setup(DepartmentsListComponent);
    mocks.courseApi.getAllCatalog.and.returnValue(of([]));
    mocks.studentApi.getAll.and.returnValue(of([]));
    mocks.departmentApi.getAll.and.returnValue(of([department]));
    await component.loadData();
    expect(component.departments()[0].courseCount).toBe(0);
  });

  it('DepartmentsListComponent: loadData populates courseCount from map', async () => {
    const { component, mocks } = await setup(DepartmentsListComponent);
    mocks.courseApi.getAllCatalog.and.returnValue(of([course]));
    mocks.studentApi.getAll.and.returnValue(of([student]));
    mocks.departmentApi.getAll.and.returnValue(of([department]));
    await component.loadData();
    expect(component.departments()[0].courseCount).toBe(1);
    expect(component.departments()[0].studentCount).toBe(1);
  });

  it('DepartmentsListComponent: sort toggles on same field, then switches', async () => {
    const { component } = await setup(DepartmentsListComponent);
    component.departments.set([
      { ...department, courseCount: 5, studentCount: 20 },
      { id: 2, name: 'Math', head: 'Dr Euler', location: 'Bât B', phone: '0607080910', courseCount: 2, studentCount: 15 },
    ]);

    // Toggle same field → switches dir
    component.sortField.set('name');
    component.sortDir.set('asc');
    component.toggleSort('name');
    expect(component.sortDir()).toBe('desc');

    // Different field → resets to asc
    component.toggleSort('head');
    expect(component.sortField()).toBe('head');
    expect(component.sortDir()).toBe('asc');

    // courseCount sort branch
    component.toggleSort('courseCount');
    expect(component.filteredDepartments().length).toBe(2);

    // studentCount sort branch
    component.toggleSort('studentCount');
    expect(component.filteredDepartments().length).toBe(2);

    // unknown field → sort returns 0
    component.sortField.set('unknown');
    expect(component.filteredDepartments().length).toBe(2);
  });
});

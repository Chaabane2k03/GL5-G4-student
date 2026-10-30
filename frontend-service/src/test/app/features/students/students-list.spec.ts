import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { setup, department, student } from '../feature-test-harness';
import { StudentsListComponent } from '../../../../app/features/students/students-list.component';

describe('StudentsListComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers student list creation and deletion', async () => {
    const { fixture, component, mocks } = await setup(StudentsListComponent, {
      queryParams: of({ departmentId: '1' }),
    });

    component.ngOnInit();
    await fixture.whenStable();
    component.studentForm.setValue({
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice@example.com',
      phone: '0612345678',
      dateOfBirth: '2004-01-01',
      departmentId: 1,
      address: '1 rue de Paris',
    });
    await component.onSubmitForm();
    component.deletingStudent.set(student);
    await component.onConfirmDelete();

    expect(mocks.studentApi.create).toHaveBeenCalled();
    expect(mocks.studentApi.delete).toHaveBeenCalledWith(1);
  });

  it('covers students list sorting, filtering, editing and deletion cancellation', async () => {
    const { component, mocks } = await setup(StudentsListComponent);

    component.students.set([
      student,
      { ...student, id: 2, firstName: 'Bob', lastName: 'Dylan', dateOfBirth: '2002-05-24', email: 'bob@example.com', phone: '0711223344', departmentId: 2 },
    ]);
    component.departments.set([department]);

    // Helpers
    expect(component.getFullName(student)).toBe('Alice Martin');
    expect(component.getMatricule(student)).toContain('MAT');
    expect(component.getDepartmentName(1)).toBe('Informatique');
    expect(component.getDepartmentName(999)).toBe('Département #999');
    expect(component.formatDate('2025-01-01')).toBe('01 janv. 2025');

    // Drawer edit
    component.openEditDrawer(student);
    expect(component.editingStudent()).toEqual(student);
    component.closeDrawer();
    expect(component.isDrawerOpen()).toBeFalse();

    // Filters and sorting
    component.onSearchChange('alice');
    expect(component.filteredStudents().length).toBe(1);
    component.resetFilters();
    expect(component.filteredStudents().length).toBe(2);

    component.toggleSort('name');
    component.toggleSort('name');
    component.toggleSort('matricule');
    component.toggleSort('dob');
    expect(component.paginatedStudents().length).toBe(2);

    // Delete modal
    component.promptDelete(student);
    expect(component.isDeleteModalOpen()).toBeTrue();
    expect(component.deleteDialogMessage()).toContain('Alice Martin');
    component.cancelDelete();
    expect(component.isDeleteModalOpen()).toBeFalse();

    // Delete error branch
    mocks.studentApi.delete.and.returnValue(throwError(() => new Error('Delete failed')));
    component.deletingStudent.set(student);
    await component.onConfirmDelete();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('covers StudentsListComponent filters, sorting variants, and drawer submissions', async () => {
    const { component, mocks } = await setup(StudentsListComponent);

    component.students.set([
      student,
      { ...student, id: 2, firstName: 'Zoe', lastName: 'Adam', dateOfBirth: '2001-02-03', departmentId: 2 },
    ]);
    component.departments.set([department]);

    // HasActiveFilters & Department filtering
    component.selectedDepartmentId.set(1);
    expect(component.hasActiveFilters()).toBeTrue();
    expect(component.filteredStudents().length).toBe(1);
    component.selectedDepartmentId.set(null);

    // Sorting by matricule and default sort
    component.sortField.set('matricule');
    expect(component.filteredStudents().length).toBe(2);
    component.sortField.set('unknown_field');
    expect(component.filteredStudents().length).toBe(2);

    // Event handlers
    component.onDepartmentFilterChange({ target: { value: '2' } } as unknown as Event);
    expect(component.selectedDepartmentId()).toBe(2);
    component.onPageChange(1);
    expect(component.page()).toBe(1);
    component.onPageSizeChange(10);
    expect(component.pageSize()).toBe(10);

    // Create drawer with 0 departments vs populated
    component.departments.set([]);
    component.openCreateDrawer();
    expect(component.studentForm.get('departmentId')?.value).toBeNull();
    component.departments.set([department]);

    // Submit form invalid
    component.studentForm.patchValue({ firstName: '' });
    await component.onSubmitForm();
    expect(component.submitting()).toBeFalse();

    // Submit form update success
    component.openEditDrawer(student);
    component.studentForm.setValue({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'asmith@univ.tn',
      phone: '0102030405',
      dateOfBirth: '2004-01-01',
      departmentId: 1,
      address: 'Paris',
    });
    mocks.studentApi.update.and.returnValue(of(student));
    await component.onSubmitForm();
    expect(mocks.snackbar.success).toHaveBeenCalled();

    // Submit form error branch
    component.openCreateDrawer();
    component.studentForm.setValue({
      firstName: 'Test',
      lastName: 'User',
      email: 'tuser@univ.tn',
      phone: '0102030405',
      dateOfBirth: '2004-01-01',
      departmentId: 1,
      address: 'Paris',
    });
    mocks.studentApi.create.and.returnValue(throwError(() => new Error('Creation failed')));
    await component.onSubmitForm();
    expect(component.formError()).toContain('Impossible d');

    // Load data failure
    mocks.studentApi.getAll.and.returnValue(throwError(() => new Error('Fail students')));
    await component.loadData();
    expect(component.error()).toContain('Impossible de charger');
  });

  it('StudentsListComponent: loadData error branch sets error signal', async () => {
    const { component, mocks } = await setup(StudentsListComponent);
    mocks.studentApi.getAll.and.returnValue(throwError(() => new Error('fail')));
    await component.loadData();
    expect(component.error()).toContain('Impossible de charger');
  });

  it('StudentsListComponent: toggleSort switches direction on same field', async () => {
    const { component } = await setup(StudentsListComponent);
    component.sortField.set('name');
    component.sortDir.set('asc');
    component.toggleSort('name');
    expect(component.sortDir()).toBe('desc');
  });

  it('StudentsListComponent: toggleSort unknown field returns 0 (fallback)', async () => {
    const { component } = await setup(StudentsListComponent);
    component.students.set([student, { ...student, id: 2, firstName: 'Bob', lastName: 'Doe' }]);
    component.sortField.set('unknown');
    // Should not throw
    expect(component.filteredStudents().length).toBe(2);
  });

  it('StudentsListComponent: onSubmitForm invalid returns early', async () => {
    const { component, mocks } = await setup(StudentsListComponent);
    component.studentForm.patchValue({ firstName: '' }); // make invalid
    await component.onSubmitForm();
    expect(mocks.studentApi.create).not.toHaveBeenCalled();
  });

  it('StudentsListComponent: onSubmitForm editing student calls update', async () => {
    const { component, mocks } = await setup(StudentsListComponent);
    component.editingStudent.set(student);
    component.studentForm.setValue({
      firstName: 'Alice', lastName: 'Martin',
      email: 'alice@example.com', phone: '0612345678',
      dateOfBirth: '2004-01-01', departmentId: 1, address: '1 rue de Paris',
    });
    await component.onSubmitForm();
    expect(mocks.studentApi.update).toHaveBeenCalled();
  });

  it('StudentsListComponent: onSubmitForm error branch sets formError', async () => {
    const { component, mocks } = await setup(StudentsListComponent);
    mocks.studentApi.create.and.returnValue(throwError(() => new Error('fail')));
    component.editingStudent.set(null);
    component.studentForm.setValue({
      firstName: 'Alice', lastName: 'Martin',
      email: 'alice@example.com', phone: '0612345678',
      dateOfBirth: '2004-01-01', departmentId: 1, address: '1 rue de Paris',
    });
    await component.onSubmitForm();
    expect(component.formError()).toContain('Impossible');
  });

  it('StudentsListComponent: openCreateDrawer without departments sets null deptId', async () => {
    const { component } = await setup(StudentsListComponent);
    component.departments.set([]);
    component.openCreateDrawer();
    expect(component.studentForm.get('departmentId')?.value).toBeNull();
  });

  it('StudentsListComponent: openCreateDrawer with departments sets first dept', async () => {
    const { component } = await setup(StudentsListComponent);
    component.departments.set([department]);
    component.openCreateDrawer();
    expect(component.studentForm.get('departmentId')?.value).toBe(1);
  });

  it('StudentsListComponent: onConfirmDelete with null student exits early', async () => {
    const { component, mocks } = await setup(StudentsListComponent);
    component.deletingStudent.set(null);
    await component.onConfirmDelete();
    expect(mocks.studentApi.delete).not.toHaveBeenCalled();
  });

  it('StudentsListComponent: deleteDialogMessage with null student returns empty', async () => {
    const { component } = await setup(StudentsListComponent);
    component.deletingStudent.set(null);
    expect(component.deleteDialogMessage()).toBe('');
  });

  it('StudentsListComponent: queryParams with NaN departmentId does not set dept filter', async () => {
    const { fixture, component } = await setup(StudentsListComponent, {
      queryParams: of({ departmentId: 'abc' }),
    });
    component.ngOnInit();
    await fixture.whenStable();
    expect(component.selectedDepartmentId()).toBeNull();
  });
});

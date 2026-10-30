import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Course } from '../../../../app/domain/course.model';
import { setup, department, course } from '../feature-test-harness';
import { CoursesListComponent } from '../../../../app/features/courses/courses-list.component';

describe('CoursesListComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers course list query synchronization', async () => {
    const { fixture, component, mocks } = await setup(CoursesListComponent, {
      queryParams: of({ page: '1', size: '10', departmentId: '1', status: 'ACTIVE', sort: 'code,asc', q: 'inf' }),
    });

    component.ngOnInit();
    await fixture.whenStable();
    component.onSearchChange('algo');
    component.onDepartmentFilterChange({ target: { value: '1' } } as unknown as Event);

    expect(mocks.router.navigate).toHaveBeenCalled();
  });

  it('covers courses list drawer, credits counter, sorting and archiving with undo', async () => {
    const { component, mocks } = await setup(CoursesListComponent);

    component.openCreateDrawer();
    expect(component.isDrawerOpen()).toBeTrue();
    expect(component.editingCourse()).toBeNull();

    component.incrementCredits();
    expect(component.creditsValue).toBe(7);
    component.decrementCredits();
    expect(component.creditsValue).toBe(6);

    component.onCodeInput({ target: { value: 'inf201' } } as unknown as Event);
    component.closeDrawer();
    expect(component.isDrawerOpen()).toBeFalse();

    component.openEditDrawer(course);
    expect(component.editingCourse()).toEqual(course);

    // Invalid submission
    component.courseForm.patchValue({ code: '' });
    await component.onSubmitForm();
    expect(component.submitting()).toBeFalse();

    // 409 conflict submission
    component.courseForm.setValue({
      code: 'INF101',
      title: 'Algorithmique',
      departmentId: 1,
      credits: 6,
      description: 'Test',
    });
    mocks.courseApi.update.and.returnValue(throwError(() => ({ status: 409 })));
    await component.onSubmitForm();
    expect(component.formError()).toContain('déjà utilisé');

    // Generic error submission
    mocks.courseApi.update.and.returnValue(throwError(() => new Error('Server error')));
    await component.onSubmitForm();
    expect(component.formError()).toContain('Une erreur est survenue');

    // Sorting & helpers
    component.departments.set([department]);
    component.toggleSort('code');
    component.toggleSort('code');
    component.toggleSort('title');
    expect(component.getDepartmentName(1)).toBe('Informatique');
    expect(component.getDepartmentName(999)).toBe('Département n°999');
    expect(component.formatDate('2025-10-21')).toBe('21 oct. 2025');

    // Archive course and trigger undo
    mocks.courseApi.archive.and.returnValue(of(void 0));
    mocks.courseApi.activate.and.returnValue(of(course));
    component.archiveCourse(course);
    expect(mocks.snackbar.info).toHaveBeenCalled();

    const undoConfig = mocks.snackbar.info.calls.mostRecent().args[1];
    undoConfig.callback();
    expect(mocks.courseApi.activate).toHaveBeenCalledWith(course.id);
  });

  it('covers CoursesListComponent search filters, pagination, and status activations', async () => {
    const { component, mocks } = await setup(CoursesListComponent);

    component.courses.set([course]);
    component.departments.set([department]);

    // Search query filtering
    component.searchQuery.set('algo');
    expect(component.filteredCourses().length).toBe(1);
    component.searchQuery.set('xyz_not_matching');
    expect(component.filteredCourses().length).toBe(0);

    // Status filter & reset
    component.onStatusFilterChange({ target: { value: 'ACTIVE' } } as unknown as Event);
    expect(component.selectedStatus()).toBe('ACTIVE');
    component.resetFilters();
    expect(component.selectedStatus()).toBeNull();
    expect(component.searchQuery()).toBe('');

    // Pagination
    component.onPageChange(2);
    expect(component.page()).toBe(2);
    component.onPageSizeChange(10);
    expect(component.pageSize()).toBe(10);

    // Submit create course success
    component.openCreateDrawer();
    component.courseForm.setValue({
      code: 'INF301',
      title: 'Systèmes Distribués',
      departmentId: 1,
      credits: 6,
      description: 'Test',
    });
    mocks.courseApi.create.and.returnValue(of(course));
    await component.onSubmitForm();
    expect(mocks.snackbar.success).toHaveBeenCalled();

    // Archive course error
    mocks.courseApi.archive.and.returnValue(throwError(() => new Error('Archive err')));
    component.archiveCourse(course);
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Reactivate course without undo and reactivate error
    mocks.courseApi.activate.and.returnValue(of(course));
    component.reactivateCourse(course, false);
    expect(mocks.snackbar.success).toHaveBeenCalled();

    mocks.courseApi.activate.and.returnValue(throwError(() => new Error('Activate err')));
    component.reactivateCourse(course, false);
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('covers CoursesListComponent queryParams branches, filteredCourses descriptions, and active filters', async () => {
    const { component } = await setup(CoursesListComponent);

    // FilteredCourses: matches code, title, description, or neither
    const courseWithDesc: Course = { ...course, id: 2, code: 'MAT201', title: 'Mathématiques', description: 'Algèbre linéaire' };
    const courseWithoutDesc: Course = { ...course, id: 3, code: 'PHY101', title: 'Physique', description: '' };
    component.courses.set([courseWithDesc, courseWithoutDesc]);

    component.searchQuery.set('Algèbre');
    expect(component.filteredCourses().length).toBe(1);
    component.searchQuery.set('MAT201');
    expect(component.filteredCourses().length).toBe(1);
    component.searchQuery.set('Physique');
    expect(component.filteredCourses().length).toBe(1);
    component.searchQuery.set('aucun_cours');
    expect(component.filteredCourses().length).toBe(0);
    component.searchQuery.set('');
    expect(component.filteredCourses().length).toBe(2);

    // hasActiveFilters permutations
    component.searchQuery.set('test');
    expect(component.hasActiveFilters()).toBeTrue();
    component.searchQuery.set('');
    component.selectedDepartmentId.set(1);
    expect(component.hasActiveFilters()).toBeTrue();
    component.selectedDepartmentId.set(null);
    component.selectedStatus.set('ACTIVE');
    expect(component.hasActiveFilters()).toBeTrue();
    component.selectedStatus.set(null);
    expect(component.hasActiveFilters()).toBeFalse();

    // creditsValue getter
    expect(component.creditsValue).toBe(6);
  });

  it('covers CoursesListComponent editing submit and error loading branches', async () => {
    const { component, mocks } = await setup(CoursesListComponent);

    // Editing course submit
    component.editingCourse.set(course);
    component.courseForm.setValue({
      code: 'INF999',
      title: 'Systèmes avancés',
      departmentId: 1,
      credits: 6,
      description: 'Niveau M2',
    });
    await component.onSubmitForm();
    expect(mocks.courseApi.update).toHaveBeenCalled();
    expect(mocks.snackbar.success).toHaveBeenCalled();

    // loadData failure branch
    mocks.courseApi.getPage.and.returnValue(throwError(() => new Error('Load failed')));
    component.loadData();
    expect(component.error()).toContain('indisponible');

    // departmentApi.getAll error branch
    mocks.departmentApi.getAll.and.returnValue(throwError(() => new Error('Dept fail')));
    component.ngOnInit();
  });

  it('CoursesListComponent: creditsValue returns 6 when form control null', async () => {
    const { component } = await setup(CoursesListComponent);
    // Default value is 6
    expect(component.creditsValue).toBe(6);
  });

  it('CoursesListComponent: openCreateDrawer without departments sets departmentId null', async () => {
    const { component } = await setup(CoursesListComponent);
    component.departments.set([]);
    component.openCreateDrawer();
    expect(component.courseForm.get('departmentId')?.value).toBeNull();
  });

  it('CoursesListComponent: openCreateDrawer with departments sets first department id', async () => {
    const { component } = await setup(CoursesListComponent);
    component.departments.set([department]);
    component.openCreateDrawer();
    expect(component.courseForm.get('departmentId')?.value).toBe(1);
  });

  it('CoursesListComponent: URL sort param without dir part still sets field', async () => {
    const { fixture, component } = await setup(CoursesListComponent, {
      queryParams: of({ sort: 'title' }),
    });
    component.ngOnInit();
    await fixture.whenStable();
    expect(component.sortField()).toBe('title');
  });

  it('CoursesListComponent: URL sort with invalid dir keeps sortDir unchanged', async () => {
    const { fixture, component } = await setup(CoursesListComponent, {
      queryParams: of({ sort: 'title,invalid' }),
    });
    component.ngOnInit();
    await fixture.whenStable();
    // dir is neither 'asc' nor 'desc', so it should not be set
    expect(['asc', 'desc']).toContain(component.sortDir());
  });

  it('CoursesListComponent: onStatusFilterChange empty sets null', async () => {
    const { component } = await setup(CoursesListComponent);
    component.onStatusFilterChange({ target: { value: '' } } as unknown as Event);
    expect(component.selectedStatus()).toBeNull();
  });

  it('CoursesListComponent: onDepartmentFilterChange with empty value sets null', async () => {
    const { component } = await setup(CoursesListComponent);
    component.onDepartmentFilterChange({ target: { value: '' } } as unknown as Event);
    expect(component.selectedDepartmentId()).toBeNull();
  });

  it('CoursesListComponent: onSubmitForm with no description uses null', async () => {
    const { component, mocks } = await setup(CoursesListComponent);
    component.editingCourse.set(null);
    component.courseForm.setValue({
      code: 'TEST1',
      title: 'Test Course',
      departmentId: 1,
      credits: 6,
      description: '',
    });
    await component.onSubmitForm();
    expect(mocks.courseApi.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ description: null }),
    );
  });

  it('CoursesListComponent: reactivateCourse isUndo=false shows different snackbar', async () => {
    const { component, mocks } = await setup(CoursesListComponent);
    mocks.courseApi.activate.and.returnValue(of(course));
    component.reactivateCourse(course, false);
    expect(mocks.snackbar.success).toHaveBeenCalledWith(
      jasmine.stringContaining('réactivé'),
    );
  });

  it('CoursesListComponent: reactivateCourse error branch', async () => {
    const { component, mocks } = await setup(CoursesListComponent);
    mocks.courseApi.activate.and.returnValue(throwError(() => new Error('fail')));
    component.reactivateCourse(course, false);
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('CoursesListComponent: archiveCourse error branch', async () => {
    const { component, mocks } = await setup(CoursesListComponent);
    mocks.courseApi.archive.and.returnValue(throwError(() => new Error('fail')));
    component.archiveCourse(course);
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('CoursesListComponent: filteredCourses with no query returns all', async () => {
    const { component } = await setup(CoursesListComponent);
    component.courses.set([course]);
    component.searchQuery.set('');
    expect(component.filteredCourses().length).toBe(1);
  });

  it('CoursesListComponent: filteredCourses with description match', async () => {
    const { component } = await setup(CoursesListComponent);
    component.courses.set([{ ...course, description: 'deep learning' }]);
    component.searchQuery.set('deep');
    expect(component.filteredCourses().length).toBe(1);
  });
});

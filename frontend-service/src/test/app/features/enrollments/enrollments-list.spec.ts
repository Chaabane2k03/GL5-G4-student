import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { Enrollment } from '../../../../app/domain/enrollment.model';
import { setup, course, student, enrollment, enrichedEnrollment } from '../feature-test-harness';
import { EnrollmentsListComponent } from '../../../../app/features/enrollments/enrollments-list.component';

describe('EnrollmentsListComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers enrollment list navigation, drop, grading and deletion', async () => {
    const { fixture, component, mocks } = await setup(EnrollmentsListComponent);

    component.ngOnInit();
    await fixture.whenStable();
    component.navigateToNew();
    await component.onDropCard(
      { item: { data: enrichedEnrollment } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0],
      'DROPPED',
    );
    component.selectedItemForGrade.set(enrichedEnrollment);
    component.gradeForm.setValue({ grade: 12, status: 'COMPLETED' });
    await component.onSubmitGrade();
    component.selectedItemForDelete.set(enrichedEnrollment);
    await component.onConfirmDelete();

    expect(mocks.enrollmentApi.update).toHaveBeenCalledTimes(2);
    expect(mocks.enrollmentApi.delete).toHaveBeenCalledWith(1);
    expect(mocks.router.navigate).toHaveBeenCalledWith(['/inscriptions/nouvelle']);
  });

  it('covers enrollments list kanban view, filters, and grading error handling', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);

    component.rawEnrollments.set([enrollment]);
    component.studentsMap.set(new Map([[1, student]]));
    component.coursesMap.set(new Map([[1, course]]));

    // View mode switch
    component.viewMode.set('kanban');
    expect(component.viewMode()).toBe('kanban');

    // Helpers
    expect(component.getStudentName(student)).toBe('Alice Martin');
    expect(component.getStudentName(null)).toBe('Étudiant');
    expect(component.getMatricule(student)).toContain('MAT');
    expect(component.getMatricule(null)).toBe('—');
    expect(component.formatDate('2025-01-01')).toBe('01 janv. 2025');
    expect(component.getColumnItems('ACTIVE').length).toBe(1);

    // Filters & sorting
    component.onSearchChange('Alice');
    expect(component.filteredItems().length).toBe(1);
    component.resetFilters();
    component.toggleSort('student');
    component.toggleSort('course');
    component.toggleSort('date');
    component.toggleSort('grade');

    // Grade modal open / close
    component.openGradeModal(enrichedEnrollment);
    expect(component.isGradeModalOpen()).toBeTrue();
    component.closeGradeModal();
    expect(component.isGradeModalOpen()).toBeFalse();

    // Drop card with COMPLETED -> opens grade modal
    await component.onDropCard(
      { item: { data: enrichedEnrollment } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0],
      'COMPLETED',
    );
    expect(component.isGradeModalOpen()).toBeTrue();

    // Grade submit error branch
    mocks.enrollmentApi.update.and.returnValue(throwError(() => new Error('Update failed')));
    await component.onSubmitGrade();
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Delete modal
    component.promptDelete(enrichedEnrollment);
    expect(component.isDeleteModalOpen()).toBeTrue();
    expect(component.deleteMessage()).toContain('Alice Martin');
    component.cancelDelete();
    expect(component.isDeleteModalOpen()).toBeFalse();

    // Delete error branch
    mocks.enrollmentApi.delete.and.returnValue(throwError(() => new Error('Delete failed')));
    component.selectedItemForDelete.set(enrichedEnrollment);
    await component.onConfirmDelete();
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('covers EnrollmentsListComponent filters, sorting permutations, and drop errors', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);

    component.rawEnrollments.set([
      enrollment,
      { ...enrollment, id: 2, status: 'COMPLETED' as const, grade: 18, enrollmentDate: '2025-06-01' },
      { ...enrollment, id: 3, status: 'FAILED' as const, grade: 5, enrollmentDate: '2024-01-01' },
    ]);
    component.studentsMap.set(new Map([[1, student]]));
    component.coursesMap.set(new Map([[1, course]]));

    // HasActiveFilters & Filters
    component.selectedStatus.set('COMPLETED');
    expect(component.hasActiveFilters()).toBeTrue();
    expect(component.filteredItems().length).toBe(1);
    component.selectedStatus.set(null);

    component.selectedDepartmentId.set(1);
    expect(component.filteredItems().length).toBe(3);
    component.selectedDepartmentId.set(null);

    // Sorting by student, course, date, grade in both directions
    for (const field of ['student', 'course', 'date', 'grade']) {
      component.sortField.set(field);
      component.sortDir.set('asc');
      expect(component.filteredItems().length).toBe(3);
      component.sortDir.set('desc');
      expect(component.filteredItems().length).toBe(3);
    }
    component.sortField.set('unknown_sort');
    expect(component.filteredItems().length).toBe(3);

    expect(component.paginatedItems().length).toBe(3);

    // Event handlers
    component.onStatusFilterChange({ target: { value: 'ACTIVE' } } as unknown as Event);
    expect(component.selectedStatus()).toBe('ACTIVE');
    component.onDepartmentFilterChange({ target: { value: '1' } } as unknown as Event);
    expect(component.selectedDepartmentId()).toBe(1);
    component.onPageChange(1);
    expect(component.page()).toBe(1);
    component.onPageSizeChange(10);
    expect(component.pageSize()).toBe(10);

    // Drop card error branch
    mocks.enrollmentApi.update.and.returnValue(throwError(() => new Error('Drop error')));
    await component.onDropCard(
      { item: { data: enrichedEnrollment } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0],
      'WITHDRAWN',
    );
    expect(mocks.snackbar.error).toHaveBeenCalled();

    // Load data failure
    mocks.enrollmentApi.getAll.and.returnValue(throwError(() => new Error('Fail enr')));
    await component.loadData();
    expect(component.error()).toContain('Impossible de charger');
  });

  it('covers EnrollmentsListComponent deep branch permutations (null student/course in search & sort, department filtering, fallback deleteMessage)', async () => {
    const { component } = await setup(EnrollmentsListComponent);

    const partialEnrollment1: Enrollment = {
      id: 10,
      studentId: 99,
      courseId: 99,
      enrollmentDate: undefined as unknown as string,
      grade: undefined as unknown as number,
      status: 'ACTIVE',
    };
    const partialEnrollment2: Enrollment = {
      id: 11,
      studentId: 1,
      courseId: 1,
      enrollmentDate: '2025-01-01',
      grade: 15,
      status: 'COMPLETED',
    };

    component.rawEnrollments.set([partialEnrollment1, partialEnrollment2]);
    component.studentsMap.set(new Map([[1, student]]));
    component.coursesMap.set(new Map([[1, course]]));

    // Department filtering: matches student or course departmentId
    component.selectedDepartmentId.set(1);
    expect(component.filteredItems().length).toBe(1);
    component.selectedDepartmentId.set(999);
    expect(component.filteredItems().length).toBe(0);
    component.selectedDepartmentId.set(null);

    // Search query permutations: studentName, matricule, courseCode, courseTitle, no-match
    component.searchQuery.set('Alice');
    expect(component.filteredItems().length).toBe(1);
    component.searchQuery.set('MAT');
    expect(component.filteredItems().length).toBe(1);
    component.searchQuery.set('INF');
    expect(component.filteredItems().length).toBe(1);
    component.searchQuery.set('Algo');
    expect(component.filteredItems().length).toBe(1);
    component.searchQuery.set('nonexistent_xyz');
    expect(component.filteredItems().length).toBe(0);
    component.searchQuery.set('');

    // Sorting with null items
    for (const field of ['student', 'course', 'date', 'grade']) {
      component.sortField.set(field);
      component.sortDir.set('asc');
      expect(component.filteredItems().length).toBe(2);
      component.sortDir.set('desc');
      expect(component.filteredItems().length).toBe(2);
    }

    // Delete message branches: null item, item without student/course
    component.selectedItemForDelete.set(null);
    expect(component.deleteMessage()).toBe('');

    component.selectedItemForDelete.set({
      enrollment: partialEnrollment1,
      student: null,
      course: null,
    });
    expect(component.deleteMessage()).toContain('Étudiant #99');
    expect(component.deleteMessage()).toContain('Cours #99');
  });

  it('EnrollmentsListComponent: sort by student/course/grade with null values', async () => {
    const { component } = await setup(EnrollmentsListComponent);

    // Two enrollments where student2 has no match in map, course2 has no match
    const e1 = { ...enrollment, id: 1, studentId: 1, courseId: 1, grade: 15, enrollmentDate: '2025-01-01', status: 'ACTIVE' as const };
    const e2 = { ...enrollment, id: 2, studentId: 99, courseId: 99, grade: null, enrollmentDate: '2025-06-01', status: 'COMPLETED' as const };
    component.rawEnrollments.set([e1, e2]);
    component.studentsMap.set(new Map([[1, student]]));
    component.coursesMap.set(new Map([[1, course]]));

    // Sort by student (null student gets empty string)
    component.sortField.set('student');
    component.sortDir.set('asc');
    expect(component.filteredItems().length).toBe(2);

    // Sort by course (null course gets empty string)
    component.sortField.set('course');
    expect(component.filteredItems().length).toBe(2);

    // Sort by grade (null grade gets -1)
    component.sortField.set('grade');
    expect(component.filteredItems().length).toBe(2);

    // Sort by date desc
    component.sortField.set('date');
    component.sortDir.set('desc');
    expect(component.filteredItems()[0].enrollment.id).toBe(2);

    // Unknown sort field → falls through to return 0
    component.sortField.set('unknown');
    expect(component.filteredItems().length).toBe(2);
  });

  it('EnrollmentsListComponent: filteredItems with deptId filter – null student passes via course, null course passes via student', async () => {
    const { component } = await setup(EnrollmentsListComponent);

    // e1 has no matching student but course.departmentId=1 → passes deptId=1 filter via course
    const e1 = { ...enrollment, id: 1, studentId: 99, courseId: 1 };
    // e2 has matching student (dept=1) but no course → passes via student
    const e2 = { ...enrollment, id: 2, studentId: 1, courseId: 99 };
    component.rawEnrollments.set([e1, e2]);
    component.studentsMap.set(new Map([[1, student]]));
    component.coursesMap.set(new Map([[1, course]]));

    component.selectedDepartmentId.set(1);
    const filtered = component.filteredItems();
    expect(filtered.length).toBe(2);
  });

  it('EnrollmentsListComponent: onDropCard with same status does not call api', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);
    const item = { enrollment: { ...enrollment, status: 'ACTIVE' }, student, course };
    await component.onDropCard(
      { item: { data: item } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0],
      'ACTIVE',
    );
    expect(mocks.enrollmentApi.update).not.toHaveBeenCalled();
  });

  it('EnrollmentsListComponent: onDropCard with null item exits early', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);
    await component.onDropCard({ item: { data: null } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0], 'DROPPED');
    expect(mocks.enrollmentApi.update).not.toHaveBeenCalled();
  });

  it('EnrollmentsListComponent: onDropCard FAILED opens grade modal with default grade 7', async () => {
    const { component } = await setup(EnrollmentsListComponent);
    const item = { enrollment: { ...enrollment, status: 'ACTIVE', grade: null }, student, course };
    await component.onDropCard({ item: { data: item } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0], 'FAILED');
    expect(component.isGradeModalOpen()).toBeTrue();
  });

  it('EnrollmentsListComponent: onSubmitGrade with null item exits early', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);
    component.selectedItemForGrade.set(null);
    await component.onSubmitGrade();
    expect(mocks.enrollmentApi.update).not.toHaveBeenCalled();
  });

  it('EnrollmentsListComponent: onSubmitGrade with NaN grade maps to null', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);
    component.selectedItemForGrade.set({ enrollment, student, course });
    component.gradeForm.reset({ grade: null, status: 'ACTIVE' });
    await component.onSubmitGrade();
    expect(mocks.enrollmentApi.update).toHaveBeenCalledWith(
      jasmine.objectContaining({ grade: null }),
    );
  });

  it('EnrollmentsListComponent: onConfirmDelete with null item exits early', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);
    component.selectedItemForDelete.set(null);
    await component.onConfirmDelete();
    expect(mocks.enrollmentApi.delete).not.toHaveBeenCalled();
  });

  it('EnrollmentsListComponent: onDropCard DROPPED api error shows error snackbar', async () => {
    const { component, mocks } = await setup(EnrollmentsListComponent);
    mocks.enrollmentApi.update.and.returnValue(throwError(() => new Error('fail')));
    const item = { enrollment: { ...enrollment, status: 'ACTIVE' }, student, course };
    await component.onDropCard({ item: { data: item } } as unknown as Parameters<EnrollmentsListComponent['onDropCard']>[0], 'DROPPED');
    expect(mocks.snackbar.error).toHaveBeenCalled();
  });

  it('EnrollmentsListComponent: status filter empty string sets null', async () => {
    const { component } = await setup(EnrollmentsListComponent);
    component.onStatusFilterChange({ target: { value: '' } } as unknown as Event);
    expect(component.selectedStatus()).toBeNull();
  });

  it('EnrollmentsListComponent: department filter with value parses int', async () => {
    const { component } = await setup(EnrollmentsListComponent);
    component.onDepartmentFilterChange({ target: { value: '2' } } as unknown as Event);
    expect(component.selectedDepartmentId()).toBe(2);
  });

  it('EnrollmentsListComponent: deleteMessage with null student and null course', async () => {
    const { component } = await setup(EnrollmentsListComponent);
    const item = { enrollment, student: null, course: null };
    component.selectedItemForDelete.set(item);
    const msg = component.deleteMessage();
    expect(msg).toContain('Étudiant #');
    expect(msg).toContain('Cours #');
  });
});

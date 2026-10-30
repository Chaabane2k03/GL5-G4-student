import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { setup, department, course, student } from '../feature-test-harness';
import { SearchOverlayComponent } from '../../../../app/features/search/search-overlay.component';

describe('SearchOverlayComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers search overlay navigation', async () => {
    const { component, mocks } = await setup(SearchOverlayComponent);

    component.navigateTo('/etudiants');

    expect(mocks.router.navigateByUrl).toHaveBeenCalledWith('/etudiants');
  });

  it('covers search overlay keyboard, backdrop, and query filtering', async () => {
    const { component, mocks } = await setup(SearchOverlayComponent);

    // Escape and backdrop
    component.onEscape();
    component.onInputKeydown({ key: 'Enter' } as KeyboardEvent);
    component.onInputKeydown({ key: 'Escape' } as KeyboardEvent);

    const backdropTarget = document.createElement('div');
    component.onBackdropClick({ target: backdropTarget, currentTarget: backdropTarget } as unknown as MouseEvent);

    // Empty query
    await component.onQueryChange({ target: { value: '   ' } } as unknown as Event);
    expect(component.matchingCourses()).toEqual([]);

    // Query matching data
    mocks.courseApi.getAllCatalog.and.returnValue(of([course]));
    mocks.studentApi.getAll.and.returnValue(of([student]));
    mocks.departmentApi.getAll.and.returnValue(of([department]));

    await component.onQueryChange({ target: { value: 'info' } } as unknown as Event);
    expect(component.matchingDepartments().length).toBe(1);

    // Query matching nothing
    await component.onQueryChange({ target: { value: 'nonexistentquery123' } } as unknown as Event);
    expect(component.isEmpty()).toBeTrue();
  });

  it('SearchOverlayComponent: onEscape when not open does nothing', async () => {
    const { component } = await setup(SearchOverlayComponent);
    // isOpen() returns false by default, so onEscape should not call onClose
    const closeSpy = spyOn(component, 'onClose');
    component.onEscape();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('SearchOverlayComponent: onEscape when open calls onClose', async () => {
    const { component, fixture } = await setup(SearchOverlayComponent);
    // Set the input to true via TestBed
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const closeSpy = spyOn(component, 'onClose');
    component.onEscape();
    expect(closeSpy).toHaveBeenCalled();
  });
});

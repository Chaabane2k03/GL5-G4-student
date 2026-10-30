import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { DepartmentTagComponent } from '../../../../../app/shared/ui/department-tag/department-tag.component';

describe('DepartmentTagComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('DepartmentTagComponent maps department ids to deterministic tones', async () => {
    const fixture = await setup(DepartmentTagComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('departmentId', 8);
    fixture.componentRef.setInput('name', 'Informatique');
    expect(component.markerColor()).toBe('var(--dept-tone-1)');

    fixture.componentRef.setInput('departmentId', 0);
    expect(component.markerColor()).toBe('var(--dept-tone-0)');

    fixture.componentRef.setInput('departmentId', -1);
    expect(component.markerColor()).toBe('var(--dept-tone-0)');

    fixture.componentRef.setInput('departmentId', Number.NaN);
    expect(component.markerColor()).toBe('var(--dept-tone-0)');
  });
});

import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { PaginatorComponent } from '../../../../../app/shared/ui/paginator/paginator.component';

describe('PaginatorComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('PaginatorComponent handles empty, middle and last pages', async () => {
    const fixture = await setup(PaginatorComponent);
    const component = fixture.componentInstance;
    const pageChanges: number[] = [];
    const sizeChanges: number[] = [];
    component.pageChange.subscribe(page => pageChanges.push(page));
    component.pageSizeChange.subscribe(size => sizeChanges.push(size));

    fixture.componentRef.setInput('page', 0);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.componentRef.setInput('totalElements', 0);
    expect(component.totalPages()).toBe(1);
    expect(component.startItem()).toBe(0);
    expect(component.endItem()).toBe(0);
    expect(component.isFirstPage()).toBeTrue();
    expect(component.isLastPage()).toBeTrue();

    component.onPrevious();
    component.onNext();
    expect(pageChanges).toEqual([]);

    fixture.componentRef.setInput('totalElements', 45);
    expect(component.totalPages()).toBe(3);
    expect(component.startItem()).toBe(1);
    expect(component.endItem()).toBe(20);
    component.onNext();
    expect(pageChanges).toEqual([1]);

    fixture.componentRef.setInput('page', 2);
    expect(component.isLastPage()).toBeTrue();
    component.onPrevious();
    expect(pageChanges).toEqual([1, 1]);

    component.onPageSizeChange({ target: { value: '50' } } as unknown as Event);
    component.onPageSizeChange({ target: { value: 'invalid' } } as unknown as Event);
    expect(sizeChanges).toEqual([50]);
  });

  it('calculates page ranges correctly', async () => {
    const fixture = await setup(PaginatorComponent);
    fixture.componentRef.setInput('page', 0);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.componentRef.setInput('totalElements', 45);
    fixture.detectChanges();

    expect(fixture.componentInstance.startItem()).toBe(1);
    expect(fixture.componentInstance.endItem()).toBe(20);
    expect(fixture.componentInstance.totalPages()).toBe(3);
  });
});

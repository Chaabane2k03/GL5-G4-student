import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { ButtonComponent } from '../../../../../app/shared/ui/button/button.component';

describe('ButtonComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ButtonComponent emits clicks only when enabled and not loading', async () => {
    const fixture = await setup(ButtonComponent);
    const component = fixture.componentInstance;
    const clicks: MouseEvent[] = [];
    component.clicked.subscribe(event => clicks.push(event));
    const event = new MouseEvent('click');

    component.onClick(event);
    expect(clicks).toEqual([event]);

    fixture.componentRef.setInput('disabled', true);
    component.onClick(event);
    expect(clicks.length).toBe(1);

    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('loading', true);
    component.onClick(event);
    expect(clicks.length).toBe(1);

    fixture.componentRef.setInput('loading', false);
    component.onClick(event);
    expect(clicks.length).toBe(2);
  });

  it('creates with the primary variant by default', async () => {
    const fixture = await setup(ButtonComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.variant()).toBe('primary');
  });
});

import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { StatusBadgeComponent } from '../../../../../app/shared/ui/status-badge/status-badge.component';

describe('StatusBadgeComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('StatusBadgeComponent formats every status and context', async () => {
    const fixture = await setup(StatusBadgeComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.componentRef.setInput('context', 'course');
    expect(component.label()).toBe('Actif');
    expect(component.normalizedStatus()).toBe('active');

    fixture.componentRef.setInput('context', 'enrollment');
    expect(component.label()).toBe('En cours');

    fixture.componentRef.setInput('status', 'COMPLETED');
    fixture.componentRef.setInput('context', 'course');
    expect(component.label()).toContain('Valid');
    fixture.componentRef.setInput('context', 'enrollment');
    expect(component.label()).toContain('Valid');

    fixture.componentRef.setInput('status', 'FAILED');
    expect(component.label()).toContain('chou');
    fixture.componentRef.setInput('status', 'DROPPED');
    expect(component.label()).toContain('Abandon');
    fixture.componentRef.setInput('status', 'WITHDRAWN');
    expect(component.label()).toContain('Retrait');
    fixture.componentRef.setInput('status', 'ARCHIVED');
    expect(component.label()).toContain('Archiv');

    fixture.componentRef.setInput('customLabel', 'Custom');
    expect(component.label()).toBe('Custom');

    fixture.componentRef.setInput('customLabel', null);
    fixture.componentRef.setInput('status', undefined);
    expect(component.label()).toBe('Inconnu');
    expect(component.normalizedStatus()).toBe('unknown');
  });

  it('renders ACTIVE and COMPLETED labels in French', async () => {
    const fixture = await setup(StatusBadgeComponent);

    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Actif');

    fixture.componentRef.setInput('status', 'COMPLETED');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Validé');
  });
});

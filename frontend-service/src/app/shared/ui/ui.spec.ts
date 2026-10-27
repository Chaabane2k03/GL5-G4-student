import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button/button.component';
import { StatusBadgeComponent } from './status-badge/status-badge.component';
import { PaginatorComponent } from './paginator/paginator.component';
import { SnackbarService } from './snackbar/snackbar.service';

describe('Shared UI Components', () => {
  describe('ButtonComponent', () => {
    let fixture: ComponentFixture<ButtonComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ButtonComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(ButtonComponent);
      fixture.detectChanges();
    });

    it('should create and have default primary variant', () => {
      expect(fixture.componentInstance).toBeTruthy();
      expect(fixture.componentInstance.variant()).toBe('primary');
    });
  });

  describe('StatusBadgeComponent', () => {
    let fixture: ComponentFixture<StatusBadgeComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [StatusBadgeComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(StatusBadgeComponent);
    });

    it('should format ACTIVE status in French', () => {
      fixture.componentRef.setInput('status', 'ACTIVE');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Actif');
    });

    it('should format COMPLETED status in French', () => {
      fixture.componentRef.setInput('status', 'COMPLETED');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Validé');
    });
  });

  describe('PaginatorComponent', () => {
    let fixture: ComponentFixture<PaginatorComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [PaginatorComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(PaginatorComponent);
    });

    it('should calculate page ranges correctly', () => {
      fixture.componentRef.setInput('page', 0);
      fixture.componentRef.setInput('pageSize', 20);
      fixture.componentRef.setInput('totalElements', 45);
      fixture.detectChanges();

      expect(fixture.componentInstance.startItem()).toBe(1);
      expect(fixture.componentInstance.endItem()).toBe(20);
      expect(fixture.componentInstance.totalPages()).toBe(3);
    });
  });

  describe('SnackbarService', () => {
    let service: SnackbarService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      service = TestBed.inject(SnackbarService);
    });

    it('should add message to signal and allow dismissing', () => {
      const id = service.success('Test message');
      expect(service.messages().length).toBe(1);
      expect(service.messages()[0].message).toBe('Test message');

      service.dismiss(id);
      expect(service.messages().length).toBe(0);
    });
  });
});

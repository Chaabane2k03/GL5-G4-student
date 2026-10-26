import { Injectable, signal } from '@angular/core';

export type SnackbarType = 'success' | 'error' | 'warning' | 'info';

export interface SnackbarAction {
  label: string;
  callback: () => void;
}

export interface SnackbarMessage {
  id: string;
  type: SnackbarType;
  message: string;
  action?: SnackbarAction;
  durationMs?: number;
}

@Injectable({
  providedIn: 'root',
})
export class SnackbarService {
  private static idCounter = 0;
  private readonly messagesSignal = signal<SnackbarMessage[]>([]);

  readonly messages = this.messagesSignal.asReadonly();

  show(
    message: string,
    options?: {
      type?: SnackbarType;
      action?: SnackbarAction;
      durationMs?: number;
    }
  ): string {
    const id = `toast-${++SnackbarService.idCounter}`;
    const type = options?.type ?? 'info';
    const durationMs = options?.durationMs ?? (type === 'error' ? 8000 : 5000);

    const toast: SnackbarMessage = {
      id,
      type,
      message,
      action: options?.action,
      durationMs,
    };

    this.messagesSignal.update((list) => [...list, toast]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }

    return id;
  }

  success(message: string, action?: SnackbarAction): string {
    return this.show(message, { type: 'success', action });
  }

  error(message: string, action?: SnackbarAction): string {
    return this.show(message, { type: 'error', action, durationMs: 8000 });
  }

  warning(message: string, action?: SnackbarAction): string {
    return this.show(message, { type: 'warning', action });
  }

  info(message: string, action?: SnackbarAction): string {
    return this.show(message, { type: 'info', action });
  }

  dismiss(id: string): void {
    this.messagesSignal.update((list) => list.filter((item) => item.id !== id));
  }
}

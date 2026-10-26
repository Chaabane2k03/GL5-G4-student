import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div [class]="'avatar avatar-' + size()">
      <span class="avatar-initials">{{ initials() }}</span>
    </div>
  `,
  styles: [`
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: var(--color-surface-muted);
      color: var(--color-text-main);
      border: 1px solid var(--color-border-hairline);
      font-weight: 700;
      font-family: var(--font-family-body);
      user-select: none;
      flex-shrink: 0;
    }

    .avatar-sm {
      width: 32px;
      height: 32px;
      font-size: var(--font-size-caption);
    }

    .avatar-md {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-body-sm);
    }

    .avatar-lg {
      width: 48px;
      height: 48px;
      font-size: var(--font-size-headline-sm);
    }

    .avatar-initials {
      letter-spacing: 0.05em;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input<string>('');
  readonly size = input<AvatarSize>('md');

  readonly initials = computed(() => {
    const raw = this.name().trim();
    if (!raw) return 'ET';
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return raw.substring(0, 2).toUpperCase();
  });
}

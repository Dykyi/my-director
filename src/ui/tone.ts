import { cva, type VariantProps } from 'class-variance-authority';

export const chipGround = cva('', {
  variants: {
    tone: {
      neutral: 'bg-surface-raised',
      recording: 'bg-recording-soft',
      paused: 'bg-paused-soft',
      accent: 'bg-accent-soft',
      success: 'bg-success-soft',
      danger: 'bg-danger-soft',
    },
  },
});

export type ChipTone = NonNullable<VariantProps<typeof chipGround>['tone']>;

export const chipText = cva('', {
  variants: {
    tone: {
      neutral: 'text-muted',
      recording: 'text-recording',
      paused: 'text-paused',
      accent: 'text-accent',
      success: 'text-success',
      danger: 'text-danger',
    } satisfies Record<ChipTone, string>,
  },
});

export const chipTint = cva('', {
  variants: {
    tone: {
      neutral: 'accent-muted',
      recording: 'accent-recording',
      paused: 'accent-paused',
      accent: 'accent-accent',
      success: 'accent-success',
      danger: 'accent-danger',
    } satisfies Record<ChipTone, string>,
  },
});

export const chipBar = cva('', {
  variants: {
    tone: {
      neutral: 'bg-muted',
      recording: 'bg-recording',
      paused: 'bg-paused',
      accent: 'bg-accent',
      success: 'bg-success',
      danger: 'bg-danger',
    } satisfies Record<ChipTone, string>,
  },
});

export const textTone = cva('', {
  variants: {
    tone: {
      normal: 'text-foreground',
      secondary: 'text-subtle',
      muted: 'text-muted',
      accent: 'text-accent',
      warning: 'text-warning',
      error: 'text-danger',
    },
  },
});

export type TextTone = NonNullable<VariantProps<typeof textTone>['tone']>;

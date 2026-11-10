import { cx } from 'class-variance-authority';
import { extendTailwindMerge } from 'tailwind-merge';

const RADII = ['bar', 'chip', 'tag', 'pill'];

const twMerge = extendTailwindMerge<'border-curve'>({
  extend: {
    theme: { radius: RADII },
    classGroups: { 'border-curve': ['border-continuous', 'border-circular'] },
  },
});

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs));

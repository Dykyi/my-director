import { cx } from 'class-variance-authority';
import { extendTailwindMerge } from 'tailwind-merge';

const RADII = ['tick', 'bar', 'chip', 'segment', 'tag', 'segmented', 'pill'];

const twMerge = extendTailwindMerge<'border-curve'>({
  extend: {
    theme: { radius: RADII },
    // Uniwind's corner curve would otherwise read as a border colour and drop the real one.
    classGroups: { 'border-curve': ['border-continuous', 'border-circular'] },
  },
});

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs));

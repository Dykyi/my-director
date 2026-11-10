import { describe, expect, it } from '@jest/globals';

import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-classes';

const VARIANTS: ButtonVariant[] = [
  'record',
  'primary',
  'resume',
  'upload',
  'raised',
  'ghost',
  'delete',
  'danger',
  'notice',
];
const SIZES: ButtonSize[] = ['large', 'regular', 'compact'];
const FLAGS = [false, true];

const sorted = (classes: string) => classes.split(' ').filter(Boolean).sort().join(' ');

describe('buttonClasses', () => {
  it('keeps the classes of every variant, size and state', () => {
    const looks = VARIANTS.flatMap((variant) =>
      SIZES.flatMap((size) =>
        FLAGS.flatMap((disabled) =>
          FLAGS.map((iconOnly) => {
            const classes = buttonClasses({ variant, size, disabled, iconOnly });
            const key = `${variant} ${size}${disabled ? ' disabled' : ''}${iconOnly ? ' icon-only' : ''}`;
            return [
              key,
              {
                frame: sorted(classes.frame),
                icon: sorted(classes.icon),
                tint: sorted(classes.tint),
                label: sorted(classes.label),
                textStyle: classes.textStyle,
              },
            ] as const;
          }),
        ),
      ),
    );
    expect(looks).toHaveLength(108);
    expect(Object.fromEntries(looks)).toMatchSnapshot();
  });
});

import { describe, expect, it } from '@jest/globals';
import { TOKENS } from '@mydirector/design-system';

import { cn } from './cn';

const RADIUS_PREFIX = 'radius-';

describe('cn', () => {
  it('keeps the border curve next to a border colour', () =>
    expect(cn('border border-border border-continuous')).toBe(
      'border border-border border-continuous',
    ));
  it('lets a later border curve win', () =>
    expect(cn('border-continuous', 'border-circular')).toBe('border-circular'));
  it('lets a later colour win', () => expect(cn('bg-record', 'bg-upload')).toBe('bg-upload'));
  it('lets a later tint win', () =>
    expect(cn('accent-muted', 'accent-accent')).toBe('accent-accent'));
  it('drops falsy parts', () => expect(cn('px-4', false, undefined, 'h-12')).toBe('px-4 h-12'));
  it.each(TOKENS.radius.tokens.map(({ name }) => name.slice(RADIUS_PREFIX.length)))(
    'knows rounded-%s as a radius',
    (name) => expect(cn('rounded-[3px]', `rounded-${name}`)).toBe(`rounded-${name}`),
  );
});

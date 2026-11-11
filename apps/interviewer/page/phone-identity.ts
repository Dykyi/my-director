// The phone joins as `iphone-<install id>`; a token made by hand may still say just `iphone`.
export const isPhoneIdentity = (identity: string, prefix: string): boolean =>
  identity === prefix || identity.startsWith(`${prefix}-`);

export const displayName = (participant: { identity: string; name?: string }): string =>
  participant.name || participant.identity;

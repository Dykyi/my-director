const encoder = new TextEncoder();

export function isAuthorized(request: Request, token: string | undefined): boolean {
  // Fail closed: a Worker deployed without its secret must not accept `Bearer undefined`.
  if (!token) return false;
  const expected = encoder.encode(`Bearer ${token}`);
  const actual = encoder.encode(request.headers.get('Authorization') ?? '');
  let difference = expected.length ^ actual.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= (expected[index] ?? 0) ^ (actual[index] ?? 0);
  }
  return difference === 0;
}

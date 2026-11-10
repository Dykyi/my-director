export type TokenGrant = { room?: string; identity?: string };
export type CallTarget = { serverUrl: string } & TokenGrant;

const base64 = (base64url: string) => base64url.replace(/-/g, '+').replace(/_/g, '/');

export function tokenGrant(token: string): TokenGrant {
  try {
    const payload = JSON.parse(atob(base64(token.split('.')[1] ?? ''))) as {
      sub?: string;
      video?: { room?: string };
    };
    return { room: payload.video?.room, identity: payload.sub };
  } catch {
    return {};
  }
}

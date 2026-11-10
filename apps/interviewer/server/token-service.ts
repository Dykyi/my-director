import { AccessToken } from 'livekit-server-sdk';

import type { TokenRequest } from './requests.ts';

/** Long enough for a demo day; the page asks for a new one on every Join. */
const TOKEN_TTL = '12h';

export interface LiveKitProject {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface RoomAccess {
  url: string;
  token: string;
}

export class TokenService {
  readonly #project: LiveKitProject;

  constructor(project: LiveKitProject) {
    this.#project = project;
  }

  async mint({ room, identity }: TokenRequest): Promise<RoomAccess> {
    const { url, apiKey, apiSecret } = this.#project;
    const token = new AccessToken(apiKey, apiSecret, { identity, ttl: TOKEN_TTL });
    token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    return { url, token: await token.toJwt() };
  }
}

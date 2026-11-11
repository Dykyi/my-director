import { isAuthorized } from './auth.ts';
import { B2Storage, DOWNLOAD_LINK_MAX_SEC } from './b2-storage.ts';
import { completeUpload, createUpload, type Dependencies } from './handlers.ts';
import { issueLiveKitToken, parseTokenRequest, type LiveKitConfig } from './livekit-token.ts';
import { isNoSuchUpload } from './storage.ts';
import { InputError, parseComplete, parseCreate, parseKey } from './validation.ts';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const noContent = () => new Response(null, { status: 204 });
const notFound = (error = 'not found') => json({ error }, 404);

function errorResponse(error: unknown): Response {
  if (error instanceof InputError || error instanceof SyntaxError)
    return json({ error: error.message }, 400);
  console.error(error);
  return json({ error: 'internal error' }, 500);
}

function decodeUploadId(raw: string | undefined): string {
  try {
    return decodeURIComponent(raw ?? '');
  } catch {
    throw new InputError('upload id is not valid');
  }
}

function dependenciesFor(env: Env): Dependencies {
  return {
    storage: new B2Storage({
      endpoint: env.B2_S3_ENDPOINT,
      bucket: env.B2_BUCKET,
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
    }),
    now: () => new Date(),
  };
}

const liveKitConfig = (env: Env): LiveKitConfig => ({
  url: env.LIVEKIT_URL,
  room: env.LIVEKIT_ROOM,
  apiKey: env.LIVEKIT_API_KEY,
  apiSecret: env.LIVEKIT_API_SECRET,
});

export default {
  async fetch(request, env): Promise<Response> {
    if (!isAuthorized(request, env.UPLOAD_API_TOKEN)) return json({ error: 'unauthorized' }, 401);
    const url = new URL(request.url);
    const [resource, rawUploadId, action] = url.pathname.split('/').filter(Boolean);
    try {
      const dependencies = dependenciesFor(env);
      const { storage } = dependencies;
      if (resource === 'objects' && request.method === 'DELETE' && rawUploadId === undefined) {
        await storage.deleteObject(parseKey(url.searchParams.get('key')));
        return noContent();
      }
      if (resource === 'download-link' && request.method === 'GET' && rawUploadId === undefined) {
        const key = parseKey(url.searchParams.get('key'));
        return json({ url: await storage.presignGet(key, DOWNLOAD_LINK_MAX_SEC) });
      }
      if (resource === 'livekit-token' && request.method === 'POST' && rawUploadId === undefined) {
        return json(
          await issueLiveKitToken(parseTokenRequest(await request.json()), liveKitConfig(env)),
        );
      }
      if (resource !== 'uploads') return notFound();
      if (request.method === 'POST' && rawUploadId === undefined) {
        return json(await createUpload(parseCreate(await request.json()), dependencies));
      }
      const uploadId = decodeUploadId(rawUploadId);
      if (request.method === 'POST' && action === 'complete') {
        const result = await completeUpload(
          uploadId,
          parseComplete(await request.json()),
          dependencies,
        );
        return json(result.body, result.status);
      }
      if (request.method === 'GET' && action === 'parts') {
        const parts = await storage
          .listParts(parseKey(url.searchParams.get('key')), uploadId)
          .catch((error: unknown) => {
            if (isNoSuchUpload(error)) return null;
            throw error;
          });
        return parts ? json({ parts }) : notFound('upload not found');
      }
      if (request.method === 'DELETE' && action === undefined) {
        await storage.abortMultipartUpload(parseKey(url.searchParams.get('key')), uploadId);
        return noContent();
      }
      return notFound();
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;

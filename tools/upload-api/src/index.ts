import { isAuthorized } from './auth';
import { completeUpload, createUpload, type Deps } from './handlers';
import { S3Api } from './s3';
import { InputError, parseComplete, parseCreate } from './validation';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function requireKey(url: URL): string {
  const key = url.searchParams.get('key');
  if (!key) throw new InputError('key query parameter is required');
  return key;
}

function depsFor(env: Env): Deps {
  return {
    storage: new S3Api({
      endpoint: env.B2_S3_ENDPOINT,
      bucket: env.B2_BUCKET,
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
    }),
    now: () => new Date(),
  };
}

export default {
  async fetch(request, env): Promise<Response> {
    if (!isAuthorized(request, env.UPLOAD_API_TOKEN)) return json({ error: 'unauthorized' }, 401);
    const url = new URL(request.url);
    const [resource, rawUploadId, action] = url.pathname.split('/').filter(Boolean);
    try {
      if (resource !== 'uploads') return json({ error: 'not found' }, 404);
      const deps = depsFor(env);
      if (request.method === 'POST' && rawUploadId === undefined) {
        return json(await createUpload(parseCreate(await request.json()), deps));
      }
      const uploadId = decodeURIComponent(rawUploadId ?? '');
      if (request.method === 'POST' && action === 'complete') {
        const result = await completeUpload(uploadId, parseComplete(await request.json()), deps);
        return json(result.body, result.status);
      }
      if (request.method === 'GET' && action === 'parts') {
        return json({ parts: await deps.storage.listParts(requireKey(url), uploadId) });
      }
      if (request.method === 'DELETE' && action === undefined) {
        await deps.storage.abortMultipartUpload(requireKey(url), uploadId);
        return new Response(null, { status: 204 });
      }
      return json({ error: 'not found' }, 404);
    } catch (error) {
      if (error instanceof InputError || error instanceof SyntaxError) return json({ error: error.message }, 400);
      console.error(error);
      return json({ error: 'internal error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

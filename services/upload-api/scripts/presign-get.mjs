// Prints a presigned GET URL for a bucket object, signed by the Worker's own B2 client.
import { B2Storage } from '../src/b2-storage.ts';

const SECONDS_PER_DAY = 86_400;
/** SigV4 presigned URLs live at most 7 days. */
const MAX_DAYS = 7;

const [key, daysArgument = '1'] = process.argv.slice(2);
const days = Math.min(Number(daysArgument), MAX_DAYS);
const {
  B2_S3_ENDPOINT: endpoint,
  B2_BUCKET: bucket,
  B2_KEY_ID: accessKeyId,
  B2_APPLICATION_KEY: secretAccessKey,
} = process.env;
if (!key || !(days > 0) || !endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Usage: yarn upload-api presign <key> [days, at most 7]');
  process.exit(1);
}

const storage = new B2Storage({ endpoint, bucket, accessKeyId, secretAccessKey });
console.log(await storage.presignGet(key, days * SECONDS_PER_DAY));

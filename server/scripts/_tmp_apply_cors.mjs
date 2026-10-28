// Applies the CORS rule Backblaze B2 needs for direct browser uploads.
//
// The app's own B2 key is scoped to readFiles/writeFiles, so it cannot read or
// write bucket config. Run this yourself with the MASTER key: it is read with
// echo off, kept in memory, and never written anywhere.
//
//   cd server && node scripts/_tmp_apply_cors.mjs
//   cd server && node scripts/_tmp_apply_cors.mjs --check   # verify only
//
// Add extra browser origins after `--`:
//   node scripts/_tmp_apply_cors.mjs -- https://preview.example.com
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(ENV_PATH)) {
  console.error(`Missing ${ENV_PATH}. Run this from server/ after setup-b2.py has written the key.`);
  process.exit(1);
}

const values = {};
for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}

const BUCKET = values.AWS_S3_BUCKET;
const REGION = values.AWS_REGION || 'us-east-005';
const ENDPOINT = values.AWS_PUBLIC_ENDPOINT_URL || values.AWS_ENDPOINT_URL;
const PROBE_KEY = 'recordings/_probe/cors-check.webm';
const PROBE_TYPE = 'audio/webm;codecs=opus';

if (!BUCKET || !ENDPOINT) {
  console.error('AWS_S3_BUCKET and AWS_ENDPOINT_URL must be set in server/.env.local.');
  process.exit(1);
}

/** B2 uses the FIRST matching rule, so one clear rule beats merging into rules that may shadow it. */
const DEFAULT_ORIGINS = [
  'https://roviameet.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const separator = args.indexOf('--');
const extraOrigins = separator === -1 ? [] : args.slice(separator + 1);

/** Origins only: scheme + host + optional port, no path. */
const normaliseOrigin = (origin) => {
  try {
    const url = new URL(origin.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

const origins = [
  ...new Set(
    [...DEFAULT_ORIGINS, ...(values.B2_CORS_ORIGINS ?? '').split(','), ...extraOrigins]
      .map(normaliseOrigin)
      .filter(Boolean)
  )
];

/**
 * Headers a presigned S3 PUT actually sends from the browser (`content-type`),
 * plus the native-API headers B2 documents for uploads and the `range` header a
 * media element sends when it seeks. `*` is accepted by B2 but is not used here:
 * an explicit list is easier to review and matches Backblaze's own sample.
 */
const CORS_RULE = {
  corsRuleName: 'intellmeet-web',
  allowedOrigins: origins,
  allowedHeaders: ['authorization', 'content-type', 'range', 'x-bz-file-name', 'x-bz-content-sha1'],
  allowedOperations: [
    'b2_download_file_by_id',
    'b2_download_file_by_name',
    'b2_upload_file',
    'b2_upload_part',
    's3_get',
    's3_put'
  ],
  maxAgeSeconds: 3600
};

const ask = (question, hidden) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = () => {};
      process.stdout.write(question);
      rl.question('', (answer) => {
        rl.close();
        process.stdout.write('\n');
        resolve(answer.trim());
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });

const authoriseMaster = async () => {
  const keyId = await ask('Master key ID: ', false);
  const appKey = await ask('Master application key (hidden): ', true);
  if (!keyId || !appKey) {
    console.error('Key ID and application key are both required.');
    process.exit(1);
  }

  const auth = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}` }
  });
  if (!auth.ok) {
    console.error(`Authorization failed (${auth.status}):`, (await auth.text()).slice(0, 300));
    process.exit(1);
  }
  return auth.json();
};

const applyRules = async () => {
  const auth = await authoriseMaster();
  const apiUrl = auth.apiUrl;
  const accountId = auth.accountId;

  const call = async (operation, body) => {
    const res = await fetch(`${apiUrl}/b2api/v2/${operation}`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${operation} -> ${res.status} ${text.slice(0, 400)}`);
    return JSON.parse(text);
  };

  const listed = await call('b2_list_buckets', { accountId, bucketName: BUCKET });
  const bucket = listed.buckets.find((candidate) => candidate.bucketName === BUCKET);
  if (!bucket) {
    console.error(`Bucket ${BUCKET} not found on this account.`);
    process.exit(1);
  }

  console.log(`\nBucket: ${bucket.bucketName} (${bucket.bucketId})`);
  console.log(`Existing CORS rules: ${(bucket.corsRules ?? []).length}`);
  console.log('Applying rule:');
  console.log(JSON.stringify(CORS_RULE, null, 2));

  await call('b2_update_bucket', { accountId, bucketId: bucket.bucketId, corsRules: [CORS_RULE] });
  console.log('\nApplied. B2 can take about a minute to propagate; verifying next.');
};

const makeClient = () =>
  new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: values.AWS_ACCESS_KEY_ID,
      secretAccessKey: values.AWS_SECRET_ACCESS_KEY
    }
  });

const verify = async () => {
  if (!values.AWS_ACCESS_KEY_ID || !values.AWS_SECRET_ACCESS_KEY) {
    console.error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are missing from server/.env.local.');
    process.exit(1);
  }

  const s3 = makeClient();
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: PROBE_KEY, ContentType: PROBE_TYPE }),
    { expiresIn: 300 }
  );

  const say = (label, response) => {
    console.log(
      `  ${label} -> ${response.status} ` +
        `ACAO=${response.headers.get('access-control-allow-origin') ?? '-'} ` +
        `ACAM=${response.headers.get('access-control-allow-methods') ?? '-'} ` +
        `ACAH=${response.headers.get('access-control-allow-headers') ?? '-'}`
    );
  };

  const preflight = async (origin) =>
    fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type'
      }
    });

  const upload = async (origin) =>
    fetch(uploadUrl, {
      method: 'PUT',
      headers: { Origin: origin, 'Content-Type': PROBE_TYPE },
      body: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])
    });

  const headerAllows = (response, name) =>
    (response.headers.get('access-control-allow-headers') ?? '')
      .toLowerCase()
      .split(',')
      .map((header) => header.trim())
      .includes(name);

  let passed = false;
  for (let attempt = 1; attempt <= 12 && !passed; attempt += 1) {
    console.log(`\nVerification attempt ${attempt}/12`);
    passed = true;

    for (const origin of origins) {
      const pre = await preflight(origin);
      say(`OPTIONS ${origin}`, pre);
      const allowOrigin = pre.headers.get('access-control-allow-origin');
      const allowMethods = (pre.headers.get('access-control-allow-methods') ?? '').toUpperCase();
      if (![200, 204].includes(pre.status) || (allowOrigin !== origin && allowOrigin !== '*')) passed = false;
      if (!allowMethods.split(',').map((method) => method.trim()).includes('PUT')) passed = false;
      if (!headerAllows(pre, 'content-type')) passed = false;
    }

    if (passed) {
      const put = await upload(origins[0]);
      say(`PUT ${origins[0]}`, put);
      const allowOrigin = put.headers.get('access-control-allow-origin');
      if (put.status !== 200 || (allowOrigin !== origins[0] && allowOrigin !== '*')) passed = false;
    }

    if (!passed) await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  await makeClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: PROBE_KEY })).catch(() => undefined);

  if (passed) {
    console.log('\nCORS is working for every configured origin. Browser uploads will succeed.');
    return;
  }

  console.error('\nCORS still failing after about a minute.');
  console.error('Check that the bucket is S3-enabled and that the origins above match the browser exactly');
  console.error('(scheme, host, and port). A Vercel preview uses a different host from production.');
  process.exit(1);
};

try {
  if (!checkOnly) {
    await applyRules();
  } else {
    console.log(`Checking ${BUCKET} at ${ENDPOINT} (no changes).`);
  }

  await verify();
} catch (error) {
  console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

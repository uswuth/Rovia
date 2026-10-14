"""
Mint a Backblaze B2 app key from the master key and write it into .env.local.

Run from the repository root:  python server/scripts/setup-b2.py

Why this exists: the S3-compatible API refuses a master application key, so the
app needs its own app key scoped to the bucket. This script does the minting
over the native B2 API so the key never has to be copied out of a web UI and
there is no SDK version to keep in step.

Key shapes differ between B2 key types, and older accounts use different shapes
again, so lengths are reported rather than asserted. The real check is whether
b2_authorize_account succeeds.
"""
import base64
import getpass
import io
import json
import os
import sys
import urllib.error
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ENV_PATH = os.path.join('server', '.env.local')
API_ROOT = 'https://api.backblazeb2.com/b2api/v2'
KEY_NAME = 'intellmeet-files'


def read_env():
    values = {}
    if os.path.exists(ENV_PATH):
        for line in open(ENV_PATH, encoding='utf-8', errors='ignore'):
            t = line.strip()
            if t and not t.startswith('#') and '=' in t:
                k, v = t.split('=', 1)
                values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def write_env(values):
    with open(ENV_PATH, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join('%s=%s' % (k, v) for k, v in values.items()) + '\n')
    try:
        os.chmod(ENV_PATH, 0o600)
    except OSError:
        pass


def post(url, payload, headers):
    request = urllib.request.Request(
        url,
        headers=headers,
        data=json.dumps(payload).encode(),
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main():
    values = read_env()
    bucket_name = values.get('AWS_S3_BUCKET', 'intellmeet-bucket')

    print('Backblaze B2 setup for IntellMeet')
    print()
    print('Paste the MASTER key from App Keys in the B2 dashboard.')
    print('On this account its keyID is the account id and its')
    print('applicationKey is a long hexadecimal string.')
    print()

    key_id = input('master keyID           : ').strip()
    app_key = getpass.getpass('master applicationKey: ').strip()

    if not key_id or not app_key:
        sys.exit('Nothing entered. No changes made.')

    print()
    print('master keyID  : %d characters, prefix %s' % (len(key_id), key_id[:3]))
    print('master appKey : %d characters, prefix %s' % (len(app_key), app_key[:3]))

    basic = base64.b64encode(('%s:%s' % (key_id, app_key)).encode()).decode()
    try:
        auth = post(
            API_ROOT + '/b2_authorize_account',
            {},
            {'Authorization': 'Basic ' + basic},
        )
    except urllib.error.HTTPError as error:
        print()
        print('b2_authorize_account failed:', error.code, error.read().decode()[:200])
        print('Check that both halves belong to the same master key.')
        print('Nothing was changed.')
        return 1

    token = auth['authorizationToken']
    api_url = auth['apiUrl']
    account_id = auth['accountId']
    print('Authenticated. Account:', account_id)

    headers = {'Authorization': token, 'Content-Type': 'application/json'}

    # A master key is account-wide, so it carries no bucketId. Look the bucket up.
    try:
        listing = post(api_url + '/b2_list_buckets',
                       {'accountId': account_id, 'bucketName': bucket_name}, headers)
    except urllib.error.HTTPError as error:
        print('b2_list_buckets failed:', error.code, error.read().decode()[:200])
        return 1

    matches = [b for b in listing.get('buckets', []) if b['bucketName'] == bucket_name]
    if not matches:
        print('No bucket named', bucket_name, 'on this account.')
        print('Create it in the B2 dashboard, then re-run. Nothing was changed.')
        return 1

    bucket_id = matches[0]['bucketId']
    print('Bucket', bucket_name, 'id', bucket_id)

    try:
        created = post(api_url + '/b2_create_key', {
            'accountId': account_id,
            'capabilities': ['readFiles', 'writeFiles'],
            'keyName': KEY_NAME,
            'bucketId': bucket_id,
        }, headers)
    except urllib.error.HTTPError as error:
        print('b2_create_key failed:', error.code, error.read().decode()[:200])
        print('Nothing was changed.')
        return 1

    new_id = created.get('keyId') or created.get('applicationKeyId')
    new_secret = created['applicationKey']

    print()
    print('App key created.')
    print('  keyID  : %s (%d chars)' % (new_id, len(new_id)))
    print('  appKey : %d chars (not printed)' % len(new_secret))

    values['AWS_ACCESS_KEY_ID'] = new_id
    values['AWS_SECRET_ACCESS_KEY'] = new_secret
    values['AWS_S3_BUCKET'] = bucket_name
    values['AWS_REGION'] = values.get('AWS_REGION') or 'us-east-005'
    values['AWS_ENDPOINT_URL'] = 'https://s3.us-east-005.backblazeb2.com'
    # Presigned browser PUTs must target the S3 host. The f005 download host
    # speaks the native API and answers them with 405.
    values['AWS_PUBLIC_ENDPOINT_URL'] = 'https://s3.us-east-005.backblazeb2.com'

    write_env(values)
    print()
    print('Written to', ENV_PATH)
    print('Verify with:  npx tsx -e "import(\'./src/services/storage.service.ts\')"')


if __name__ == '__main__':
    sys.exit(main())

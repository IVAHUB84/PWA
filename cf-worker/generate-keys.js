// Run once: node generate-keys.js
// Outputs VAPID key pair — set these as Cloudflare Worker secrets
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);

const pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const privJwk = await subtle.exportKey('jwk', kp.privateKey);

const b64url = buf => Buffer.from(buf).toString('base64url');

console.log('Run these commands to set Worker secrets:\n');
console.log(`echo "${b64url(pubRaw)}" | wrangler secret put VAPID_PUBLIC_KEY`);
console.log(`echo '${JSON.stringify(privJwk)}' | wrangler secret put VAPID_PRIVATE_KEY_JWK`);
console.log('\nVAPID_PUBLIC_KEY (also needed in docs/modules/push.js if hardcoded):');
console.log(b64url(pubRaw));

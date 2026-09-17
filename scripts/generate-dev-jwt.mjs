import { createHmac, randomUUID } from 'node:crypto';

const secret = process.env.JWT_SECRET ?? 'change-me-in-development';
const subject = process.argv[2] ?? randomUUID();
const email = process.argv[3] ?? 'dev@example.com';
const now = Math.floor(Date.now() / 1000);

const encode = (value) =>
  Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

const header = encode({ alg: 'HS256', typ: 'JWT' });
const payload = encode({ sub: subject, email, iat: now });
const content = header + '.' + payload;
const signature = createHmac('sha256', secret)
  .update(content)
  .digest('base64')
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replace(/=+$/u, '');

console.log(content + '.' + signature);

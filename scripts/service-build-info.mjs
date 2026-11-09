// Grava dist/build-info.json de um serviço NestJS: node scripts/service-build-info.mjs <servico>
import { readFileSync, writeFileSync } from 'node:fs';

const service = process.argv[2];
if (!/^[a-z][a-z0-9-]*$/u.test(service ?? '')) {
  throw new Error('Informe o diretório do serviço em services/');
}
const root = `services/${service}`;
const base = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')).version;
const version = process.env.BUILD_VERSION || base;
const commit = process.env.BUILD_COMMIT || 'local';
if (
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-dev\.[1-9]\d*)?$/u.test(version) ||
  !/^(local|[a-f0-9]{40})$/u.test(commit)
) {
  throw new Error('Metadados de build inválidos');
}
writeFileSync(`${root}/dist/build-info.json`, `${JSON.stringify({ version, commit })}\n`);
console.log(`build-info de ${service}: ${version} (${commit})`);

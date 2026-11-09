import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BuildInfo {
  version: string;
  commit: string;
}

export const BUILD_INFO_FILE = join(__dirname, '../build-info.json');

function readLocalVersion(): string {
  const manifest = process.cwd().endsWith('/orders')
    ? 'package.json'
    : 'services/orders/package.json';
  return JSON.parse(readFileSync(join(process.cwd(), manifest), 'utf8'))
    .version;
}

export function loadBuildInfo(
  file: string,
  appEnv: string | undefined,
): BuildInfo {
  if (existsSync(file)) {
    const { version, commit } = JSON.parse(readFileSync(file, 'utf8'));
    return { version, commit };
  }
  if (appEnv && appEnv !== 'local') {
    throw new Error('Metadados de build obrigatórios na cloud');
  }
  return { version: readLocalVersion(), commit: 'local' };
}

@Injectable()
export class BuildInfoService {
  private readonly info = loadBuildInfo(BUILD_INFO_FILE, process.env.APP_ENV);

  get(): BuildInfo {
    return { ...this.info };
  }
}

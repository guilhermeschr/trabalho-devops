import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuildInfoService, loadBuildInfo } from './build-info.service';

describe('metadados de build de Pedidos', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'orders-build-info-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('lê versão e commit gravados no build', () => {
    const file = join(dir, 'build-info.json');
    writeFileSync(
      file,
      JSON.stringify({ version: '0.2.0', commit: 'b'.repeat(40), extra: 1 }),
    );
    expect(loadBuildInfo(file, 'homol')).toEqual({
      version: '0.2.0',
      commit: 'b'.repeat(40),
    });
  });

  it('usa a versão do manifesto e commit local fora da cloud', () => {
    const info = loadBuildInfo(join(dir, 'ausente.json'), undefined);
    expect(info.commit).toBe('local');
    expect(info.version).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(loadBuildInfo(join(dir, 'ausente.json'), 'local').commit).toBe(
      'local',
    );
  });

  it('exige o arquivo de build na cloud', () => {
    expect(() => loadBuildInfo(join(dir, 'ausente.json'), 'dev')).toThrow(
      'Metadados de build obrigatórios na cloud',
    );
  });

  it('expõe uma cópia dos metadados', () => {
    const service = new BuildInfoService();
    const info = service.get();
    info.version = 'alterado';
    expect(service.get().version).not.toBe('alterado');
  });
});

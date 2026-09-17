import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  async check(): Promise<Record<string, string>> {
    return {
      status: 'ok',
      service: 'products-service',
      timestamp: new Date().toISOString(),
    };
  }
}

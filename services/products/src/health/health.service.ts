import { Injectable } from '@nestjs/common';
import { HealthResponseDto } from './health-response.dto';

@Injectable()
export class HealthService {
  async check(): Promise<HealthResponseDto> {
    return {
      status: 'ok',
      service: 'products-service',
      timestamp: new Date().toISOString(),
    };
  }
}

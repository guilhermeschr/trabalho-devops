import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';
import { setupSwagger } from './common/swagger/swagger.setup';
import { resolvePort, validateCloudConfig } from './operations/runtime-config';

async function bootstrap(): Promise<void> {
  validateCloudConfig(process.env);
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  setupSwagger(app, app.get(ConfigService));

  const port = resolvePort(process.env);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

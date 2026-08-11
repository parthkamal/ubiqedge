import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // -> /ingest/v1/:orgCode/:deviceType/:serialNo, see ubiqedge_tech_api_design §2
  app.setGlobalPrefix('ingest');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // no Swagger — single endpoint, not worth it (implementation spec §1 design principle #11)

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`ingestion-service listening on port ${port}`, 'Bootstrap');
}
bootstrap();

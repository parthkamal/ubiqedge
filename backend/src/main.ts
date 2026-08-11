import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // frontend (Vite dev server / static build) is a separate origin — no
  // cookies/credentials involved (JWT goes in the Authorization header),
  // so a simple allow-all is fine for this single-org deployment
  app.enableCors();

  // /payments/v1/webhook/* is excluded — it's signature-verified, not JWT
  // auth, and must not sit under /api. See ubiqedge_tech_api_design §1.2.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'payments/*path', method: RequestMethod.ALL }],
  });

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ubiqedge backend API')
    .setDescription('Water billing IoT platform — backend (auth, CRUD, invoicing, payments)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`backend listening on port ${port}`, 'Bootstrap');
}
bootstrap();

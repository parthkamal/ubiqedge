import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import paymentConfig from './config/payment.config';
import { buildTypeOrmConfig } from './database/typeorm.config';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { AccountModule } from './account/account.module';
import { DeviceModule } from './device/device.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { PricingModule } from './pricing/pricing.module';
import { InvoiceModule } from './invoice/invoice.module';
import { PaymentModule } from './payment/payment.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, jwtConfig, paymentConfig] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmConfig,
    }),
    OrganizationModule,
    UserModule,
    AccountModule,
    DeviceModule,
    TelemetryModule,
    PricingModule,
    InvoiceModule,
    PaymentModule,
    AuthModule,
  ],
  providers: [
    // order matters: JwtAuthGuard populates request.user before RolesGuard
    // reads it — global via APP_GUARD, opt out per-route with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

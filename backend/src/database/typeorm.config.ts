import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.get<string>('database.host'),
    port: config.get<number>('database.port'),
    username: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.name'),
    // MySQL DATETIME columns carry no timezone of their own — without this,
    // mysql2 converts them using the Node process's *local* timezone on
    // every read/write, so the same stored value means something different
    // depending on the host machine's TZ. Pin to UTC explicitly so
    // deviceTimestamp/generatedAt/etc. mean the same instant everywhere
    // (backend and ingestion-service alike), regardless of deployment TZ.
    timezone: 'Z',
    autoLoadEntities: true,
    synchronize: false, // migrations are the source of truth, see implementation spec §2
  };
}

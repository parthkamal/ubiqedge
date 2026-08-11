import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import { MYSQL_POOL } from './database.constants';

// no ORM here, deliberately — see IngestModule for why. This is the one
// place a mysql2 pool gets constructed; everything else injects MYSQL_POOL.
@Global()
@Module({
  providers: [
    {
      provide: MYSQL_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        mysql.createPool({
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          user: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          // must match backend's typeorm `timezone: 'Z'` — same DB, same
          // datetime columns read/written by both services
          timezone: 'Z',
          connectionLimit: 10,
        }),
    },
  ],
  exports: [MYSQL_POOL],
})
export class DatabaseModule {}

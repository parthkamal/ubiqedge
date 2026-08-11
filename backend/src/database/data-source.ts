import 'dotenv/config';
import { DataSource } from 'typeorm';

// standalone DataSource for the typeorm CLI (migration:generate/run/revert/show).
// Runs against compiled output, not through Nest's DI/ConfigModule — see
// package.json migration:* scripts, which build first. Entity discovery is a
// glob here (CLI has no access to Nest's autoLoadEntities), so migrations
// pick up every *.entity.ts under src regardless of which module owns it.
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z', // see typeorm.config.ts — must match the runtime connection
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerConnection } from './entities/customer-connection.entity';
import { UserModule } from '../user/user.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerConnection]), UserModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [TypeOrmModule],
})
export class AccountModule {}

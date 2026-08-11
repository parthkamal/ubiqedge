import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

// single module for the whole service — see implementation spec §0
// ("the /ingest/v1 write path only"), one endpoint doesn't warrant
// splitting into per-resource modules the way backend does.
@Module({
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}

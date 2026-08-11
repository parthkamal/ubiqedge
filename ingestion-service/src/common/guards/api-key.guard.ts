import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { MYSQL_POOL } from '../../database/database.constants';

interface OrganizationRow extends RowDataPacket {
  apiKeySecretHash: string | null;
}

// org-level key (not per-device) — see ubiqedge_tech_data_model. One shared
// secret per :orgCode, checked against organization.apiKeySecretHash.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    const orgCode = request.params.orgCode;

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('X-Api-Key header is required');
    }

    const [rows] = await this.pool.query<OrganizationRow[]>(
      'SELECT apiKeySecretHash FROM organization WHERE id = ?',
      [orgCode],
    );
    const org = rows[0];
    if (!org?.apiKeySecretHash) {
      throw new UnauthorizedException('Invalid organization or API key');
    }

    const providedHash = createHash('sha256').update(apiKey).digest();
    const storedHash = Buffer.from(org.apiKeySecretHash, 'hex');
    if (
      providedHash.length !== storedHash.length ||
      !timingSafeEqual(providedHash, storedHash)
    ) {
      throw new UnauthorizedException('Invalid organization or API key');
    }

    return true;
  }
}

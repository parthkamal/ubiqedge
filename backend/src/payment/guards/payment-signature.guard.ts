import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

// verifies X-Signature: HMAC-SHA256(JSON.stringify(body), secret) — a real
// gateway integration would HMAC the literal raw request bytes per that
// provider's exact spec (needs Nest's rawBody plumbing); hashing the parsed
// body is a deliberate simplification since we control both sides of this
// mock provider's contract
@Injectable()
export class PaymentSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-signature'];
    if (typeof signature !== 'string') {
      throw new UnauthorizedException('Missing X-Signature header');
    }

    const secret = this.config.get<string>('payment.webhookSecret')!;
    const expected = createHmac('sha256', secret).update(JSON.stringify(request.body)).digest('hex');

    const provided = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
      throw new UnauthorizedException('Invalid signature');
    }
    return true;
  }
}

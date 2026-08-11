import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
}));

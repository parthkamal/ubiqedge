import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  // seconds, not a duration string ('8h') — @nestjs/jwt's expiresIn type is
  // number | StringValue (a template-literal type from the `ms` package),
  // a plain number sidesteps that typing entirely
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '28800', 10),
}));

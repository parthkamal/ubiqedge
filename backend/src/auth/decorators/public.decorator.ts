import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// bypasses the global JwtAuthGuard — login, ingestion (its own service), and
// the payment webhook are the only routes that should ever use this
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

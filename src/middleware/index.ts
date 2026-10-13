import { Request, Response, NextFunction } from 'express';
import { config } from '@/config';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!config.apiKey) {
    return next();
  }

  const apiKey = YOUR_SECRET'x-api-key'] as string;

  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
    });
  }

  next();
}

export function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction) {
  if (config.ipWhitelist.length === 0) {
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || '';
  
  const isAllowed = config.ipWhitelist.some(allowed => {
    if (allowed.includes('/')) {
      return ipInCidr(clientIp, allowed);
    }
    return clientIp === allowed;
  });

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'IP address not in whitelist' },
    });
  }

  next();
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
  
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  
  return (ipNum & mask) === (rangeNum & mask);
}

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}

export function notFoundMiddleware(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
}

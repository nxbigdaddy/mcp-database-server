import pino from 'pino';
import { config } from '@/config';

const transportOptions: any = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
};

if (config.logFile) {
  transportOptions.targets = [
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
      level: config.logLevel,
    },
    {
      target: 'pino/file',
      options: {
        destination: config.logFile,
      },
      level: config.logLevel,
    },
  ];
}

export const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development' ? transportOptions : undefined,
});

export function createChildLogger(module: string) {
  return logger.child({ module });
}

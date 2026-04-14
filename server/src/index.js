import pino from 'pino';
import app from './app.js';
import { startOverdueCheckJob } from './jobs/overdueCheck.js';

// CR-01: Validate required environment variables at startup
const requiredEnvVars = ['JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: ${envVar} environment variable is required`);
    process.exit(1);
  }
}

const logger = pino({
  name: 'repayment-tracker',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  startOverdueCheckJob();
});

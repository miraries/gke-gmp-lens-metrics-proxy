import 'dotenv/config';

export default {
  appPort: parseInt(process.env.APP_PORT || '') || 8443,
  logLevel: process.env.LOG_LEVEL || 'warn',
  googleAccessToken: process.env.GOOGLE_ACCESS_TOKEN as string | undefined,
  googleProjectId: process.env.GOOGLE_PROJECT_ID as string | undefined,
}
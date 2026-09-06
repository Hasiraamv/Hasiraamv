export type Bindings = {
  DB: D1Database;
  AI: Ai;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  ENVIRONMENT: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  FRONTEND_URL: string;
};

export type Variables = {
  userId: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

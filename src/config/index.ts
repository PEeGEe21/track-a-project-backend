import * as dotenv from 'dotenv';
import * as joi from 'joi';

function parseOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

process.env.ENV_PATH
  ? dotenv.config({ path: process.env.ENV_PATH })
  : dotenv.config();

// validating environment variables
const envVarsSchema = joi
  .object({
    PORT: joi.number().default('5000'),
    // PORT: joi.number().default('5000'),
    NODE_ENV: joi
      .string()
      .allow(...['development', 'staging', 'production'])
      .required(),
    DEVELOPMENT_START_COMMAND: joi.string().default('npm run start:dev'),
    LOG_LEVEL: joi
      .string()
      .allow(...['error', 'warning', 'info', 'debug', 'silly', ''])
      .default('silly'),
    JWT_ACCESS_TOKEN_SECRET: joi.string().required(),
    JWT_ACCESS_EXPIRES_IN: joi.string().required(),
    JWT_REFRESH_TOKEN_SECRET: joi.string().required(),
    JWT_REFRESH_EXPIRES_IN: joi.string().required(),
    FRONTEND_URL: joi.string().uri().required(),
    ADMIN_FRONTEND_URL: joi.string().uri().optional(),
    CORS_ALLOWED_ORIGINS: joi.string().optional(),
    PEER_LINK_MAIN: joi.string().uri().optional(),
    APP_URL: joi.string().uri().optional(),
    LIVEKIT_URL: joi.string().uri().optional(),
    LIVEKIT_API_KEY: joi.string().optional(),
    LIVEKIT_API_SECRET: joi.string().optional(),
    REDIS_ENABLED: joi
      .boolean()
      .truthy('TRUE')
      .truthy('true')
      .falsy('FALSE')
      .falsy('false')
      .default(false),
    REDIS_URL: joi
      .string()
      .pattern(/^rediss?:\/\//)
      .optional(),
    REDIS_PREFIX: joi.string().default('trackr'),
    RATE_LIMIT_DRIVER: joi
      .string()
      .allow(...['memory', 'redis'])
      .default('memory'),
    QUEUE_DRIVER: joi
      .string()
      .allow(...['inline', 'redis'])
      .default('inline'),
    RATE_LIMIT_DEFAULT_MAX: joi.number().integer().min(1).default(120),
    RATE_LIMIT_DEFAULT_WINDOW_MS: joi
      .number()
      .integer()
      .min(1000)
      .default(60000),
    RATE_LIMIT_AUTH_MAX: joi.number().integer().min(1).default(10),
    RATE_LIMIT_AUTH_WINDOW_MS: joi.number().integer().min(1000).default(900000),
    RATE_LIMIT_INVITE_MAX: joi.number().integer().min(1).default(10),
    RATE_LIMIT_INVITE_WINDOW_MS: joi
      .number()
      .integer()
      .min(1000)
      .default(600000),
    RATE_LIMIT_INGESTION_MAX: joi.number().integer().min(1).default(100),
    RATE_LIMIT_INGESTION_WINDOW_MS: joi
      .number()
      .integer()
      .min(1000)
      .default(60000),
    WS_RATE_LIMIT_MAX: joi.number().integer().min(1).default(60),
    WS_RATE_LIMIT_WINDOW_MS: joi.number().integer().min(1000).default(60000),
    WS_RATE_LIMIT_BURST_MAX: joi.number().integer().min(1).default(180),
    WS_RATE_LIMIT_BURST_WINDOW_MS: joi
      .number()
      .integer()
      .min(1000)
      .default(10000),

    // database config
    // MONGODB_URI: joi.string().required(),
    DATABASE_HOST: joi.string().required(),
    DATABASE_PORT: joi.number().port().required(),
    DATABASE_USERNAME: joi.string().required(),
    DATABASE_PASSWORD: joi.string().required(),
    DATABASE_NAME: joi.string().required(),
    RUN_MIGRATIONS_ON_STARTUP: joi
      .boolean()
      .truthy('TRUE')
      .truthy('true')
      .falsy('FALSE')
      .falsy('false')
      .default(false),
    DATABASE_LOGGING: joi
      .boolean()
      .truthy('TRUE')
      .truthy('true')
      .falsy('FALSE')
      .falsy('false')
      .default(false),

    // // emails
    // SENDGRID_API_KEY: joi.string().required(),
    // RECIPIENT_INVITE_EMAIL_TEMPLATE: joi.string().required(),
    // RECIPIENT_INVITE_NEW_USER_EMAIL_TEMPLATE: joi.string().required(),
    // SENDGRID_FROM_EMAIL: joi.string().required(),
    // EARLIEST_EVENT_DATE_GAP: joi.number().required(),

    // AT_KEY: joi.string().required(),
    // AT_USERNAME: joi.string().required(),
    OTP_TTL: joi.number().required().default(600),
    PASSWORD_RECOVERY_TTL: joi.number().required().default(72),
    PASSWORD_RECOVERY_EMAIL: joi.string().email().required(),
    PASSWORD_RECOVERY_URL: joi.string().uri().required(),
    STORAGE_DRIVER: joi
      .string()
      .allow(...['supabase', 'minio'])
      .default('supabase'),
    WEB_PUSH_PUBLIC_KEY: joi.string().optional(),
    WEB_PUSH_PRIVATE_KEY: joi.string().optional(),
    WEB_PUSH_SUBJECT: joi.string().optional(),
    SUPABASE_URL: joi.string().uri().optional(),
    SUPABASE_BUCKET_NAME: joi.string().optional(),
    SUPABASE_KEY: joi.string().optional(),
    SUPABASE_ANON_KEY: joi.string().optional(),
    S3_BUCKET_NAME: joi.string().optional(),
    S3_ACCESS_KEY_ID: joi.string().optional(),
    S3_SECRET_ACCESS_KEY: joi.string().optional(),
    S3_ENDPOINT: joi.string().uri().optional(),
    S3_PUBLIC_BASE_URL: joi.string().uri().optional(),
    S3_REGION: joi.string().optional(),
    S3_FORCE_PATH_STYLE: joi.string().optional(),
    S3_BUCKET_PUBLIC_READ: joi.string().optional(),
    S3_SIGNED_URL_TTL_SECONDS: joi.number().integer().min(60).default(3600),
    INGESTION_MAX_BODY_KB: joi.number().integer().min(1).default(50),
    PROJECTTRAKR_INGESTION_KEY: joi.string().optional(),
    PROJECTTRAKR_INGESTION_ENDPOINT: joi.string().uri().optional(),
    PROJECTTRAKR_INGESTION_SOURCE: joi.string().optional(),
    PROJECTTRAKR_CAPTURE_BACKEND_ERRORS: joi
      .boolean()
      .truthy('TRUE')
      .truthy('true')
      .falsy('FALSE')
      .falsy('false')
      .default(false),
    // TWILIO_ACCOUNT_SID: joi.string().required(),
    // TWILIO_AUTH_TOKEN: joi.string().required(),
    // CLOUDINARY_API_KEY: joi.string().required(),
    // CLOUDINARY_API_SECRET: joi.string().required(),
    // CLOUDINARY_URL: joi.string().required(),
    // CLOUDINARY_CLOUD_NAME: joi.string().required(),
    // PUSHER_SECRET_KEY: joi.string().required(),
    // PUSHER_INSTANCE_ID: joi.string().required(),
    // ACCOUNT_VERIFICATION_TTL: joi.number().required().default(7),
    // ACCOUNT_VERIFICATION_EMAIL_TEMPLATE: joi.string().required(),
    // ACCOUNT_VERIFICATION_URL: joi.string().required(),
    // EXISTING_USER_CREATE_EVENT_EMAIL_TEMPLATE: joi.string().required(),
    // GOOGLE_CLIENT_ID: joi.string().required(),
    // GOOGLE_CLIENT_SECRET: joi.string().required(),
  })
  .unknown()
  .required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
  throw new Error(`Config validation error: ${error}`);
}

if (envVars.REDIS_ENABLED && !envVars.REDIS_URL) {
  throw new Error(
    'Config validation error: REDIS_URL is required when REDIS_ENABLED=true',
  );
}

if (envVars.RATE_LIMIT_DRIVER === 'redis' && !envVars.REDIS_ENABLED) {
  throw new Error(
    'Config validation error: RATE_LIMIT_DRIVER=redis requires REDIS_ENABLED=true',
  );
}

if (envVars.QUEUE_DRIVER === 'redis' && !envVars.REDIS_ENABLED) {
  throw new Error(
    'Config validation error: QUEUE_DRIVER=redis requires REDIS_ENABLED=true',
  );
}

if (envVars.STORAGE_DRIVER === 'supabase') {
  if (
    !envVars.SUPABASE_URL ||
    !envVars.SUPABASE_BUCKET_NAME ||
    !envVars.SUPABASE_KEY ||
    !envVars.SUPABASE_ANON_KEY
  ) {
    throw new Error(
      'Config validation error: Supabase storage requires SUPABASE_URL, SUPABASE_BUCKET_NAME, SUPABASE_KEY, and SUPABASE_ANON_KEY',
    );
  }
}

if (envVars.STORAGE_DRIVER === 'minio') {
  if (
    !envVars.S3_BUCKET_NAME ||
    !envVars.S3_ACCESS_KEY_ID ||
    !envVars.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      'Config validation error: MinIO storage requires S3_BUCKET_NAME, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY',
    );
  }
}

const hasAnyLivekitConfig = Boolean(
  envVars.LIVEKIT_URL || envVars.LIVEKIT_API_KEY || envVars.LIVEKIT_API_SECRET,
);

const hasAnyWebPushConfig = Boolean(
  envVars.WEB_PUSH_PUBLIC_KEY ||
    envVars.WEB_PUSH_PRIVATE_KEY ||
    envVars.WEB_PUSH_SUBJECT,
);

if (
  hasAnyLivekitConfig &&
  (!envVars.LIVEKIT_URL ||
    !envVars.LIVEKIT_API_KEY ||
    !envVars.LIVEKIT_API_SECRET)
) {
  throw new Error(
    'Config validation error: LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must all be set together',
  );
}

if (
  hasAnyWebPushConfig &&
  (!envVars.WEB_PUSH_PUBLIC_KEY ||
    !envVars.WEB_PUSH_PRIVATE_KEY ||
    !envVars.WEB_PUSH_SUBJECT)
) {
  throw new Error(
    'Config validation error: WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, and WEB_PUSH_SUBJECT must all be set together',
  );
}

export const config = {
  env: envVars.NODE_ENV,
  url: envVars.APP_URL,
  port: envVars.PORT,
  logLevel: envVars.LOG_LEVEL,
  secret: envVars.JWT_ACCESS_TOKEN_SECRET,
  expiresIn: envVars.JWT_ACCESS_EXPIRES_IN,
  refreshSecret: envVars.JWT_REFRESH_TOKEN_SECRET,
  refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  feBaseUrl: envVars.FRONTEND_URL,
  adminFrontendUrl: envVars.ADMIN_FRONTEND_URL,
  corsAllowedOrigins: Array.from(
    new Set(
      [
        envVars.FRONTEND_URL,
        envVars.ADMIN_FRONTEND_URL,
        ...parseOrigins(envVars.CORS_ALLOWED_ORIGINS),
      ].filter(Boolean),
    ),
  ),
  accountVerificationTtl: envVars.ACCOUNT_VERIFICATION_TTL,
  accountVerificationUrl: envVars.ACCOUNT_VERIFICATION_URL,
  verifyHash: envVars.VERIFY_HASH_HOOK,
  webPush: {
    publicKey: envVars.WEB_PUSH_PUBLIC_KEY ?? null,
    privateKey: envVars.WEB_PUSH_PRIVATE_KEY ?? null,
    subject: envVars.WEB_PUSH_SUBJECT ?? null,
  },
  db: {
    // uri: envVars.MONGODB_URI,
    host: envVars.DATABASE_HOST,
    port: envVars.DATABASE_PORT,
    username: envVars.DATABASE_USERNAME,
    password: envVars.DATABASE_PASSWORD,
    name: envVars.DATABASE_NAME,
    runMigrationsOnStartup: envVars.RUN_MIGRATIONS_ON_STARTUP,
    // name: `${envVars.PGDATABASE}${envVars.NODE_ENV === 'test' ? '-test' : ''}`,
    // logging: envVars.DATABASE_LOGGING,
  },
  // sendGrid: {
  //   apiKey: envVars.SENDGRID_API_KEY,
  //   welcomeEmailTemplate: envVars.SENDGRID_WELCOME_EMAIL_TEMPLATE,
  //   resetPasswordTemplate: envVars.SENDGRID_RESET_PASSWORD_TEMPLATE,
  //   inviteEmailTemplate: envVars.SENDGRID_INVITE_EMAIL_TEMPLATE,
  //   outfitBuyerFirstEventEmail: envVars.OUTFIT_BUYER_AFTER_FIRST_EVENT_EMAIL,
  //   recipientInviteEmail: envVars.RECIPIENT_INVITE_EMAIL_TEMPLATE,
  //   newUserRecipientInviteEmail:
  //     envVars.RECIPIENT_INVITE_NEW_USER_EMAIL_TEMPLATE,
  //   fromEmail: envVars.SENDGRID_FROM_EMAIL,
  //   passwordRecoveryEmail: envVars.PASSWORD_RECOVERY_EMAIL,
  //   memberSignUpEmail: envVars.MEMBER_SIGNUP,
  //   accountVerificationEmail: envVars.ACCOUNT_VERIFICATION_EMAIL_TEMPLATE,
  //   existingUserCreateEventEmail:
  //     envVars.EXISTING_USER_CREATE_EVENT_EMAIL_TEMPLATE,
  //   VETTED_APPROVED: envVars.VETTED_APPROVED,
  //   VETTED_DECLINED: envVars.VETTED_DECLINED,
  //   EVENT_PLANNER_WITH_EVENT: envVars.EVENT_PLANNER_WITH_EVENT,
  //   EVENT_PLANNER_WITHOUT_EVENT: envVars.EVENT_PLANNER_WITHOUT_EVENT,
  // },
  // twilio: {
  //   accountSid: envVars.TWILIO_ACCOUNT_SID,
  //   authToken: envVars.TWILIO_AUTH_TOKEN,
  // },

  otpTtl: envVars.OTP_TTL,
  passwordRecoveryTtl: envVars.PASSWORD_RECOVERY_TTL,
  passwordRecoveryUrl: envVars.PASSWORD_RECOVERY_URL,
  frontendUrl: envVars.FRONTEND_URL,
  groupInviteUrl: envVars.GROUP_INVITE_URL,
  peerLinkMain: envVars.PEER_LINK_MAIN,
  livekit: {
    url: envVars.LIVEKIT_URL ?? null,
    apiKey: envVars.LIVEKIT_API_KEY ?? null,
    apiSecret: envVars.LIVEKIT_API_SECRET ?? null,
    enabled: Boolean(
      envVars.LIVEKIT_URL &&
        envVars.LIVEKIT_API_KEY &&
        envVars.LIVEKIT_API_SECRET,
    ),
  },
  storage: {
    driver: envVars.STORAGE_DRIVER,
    supabaseUrl: envVars.SUPABASE_URL,
    supabaseBucketName: envVars.SUPABASE_BUCKET_NAME,
    s3BucketName: envVars.S3_BUCKET_NAME,
    s3Endpoint: envVars.S3_ENDPOINT,
    s3PublicBaseUrl: envVars.S3_PUBLIC_BASE_URL,
    s3Region: envVars.S3_REGION || 'us-east-1',
    s3ForcePathStyle: envVars.S3_FORCE_PATH_STYLE === 'true',
    s3BucketPublicRead: envVars.S3_BUCKET_PUBLIC_READ !== 'false',
    signedUrlTtlSeconds: envVars.S3_SIGNED_URL_TTL_SECONDS,
  },
  redis: {
    enabled: envVars.REDIS_ENABLED,
    url: envVars.REDIS_URL,
    prefix: envVars.REDIS_PREFIX,
  },
  rateLimit: {
    driver: envVars.RATE_LIMIT_DRIVER,
    defaultMax: envVars.RATE_LIMIT_DEFAULT_MAX,
    defaultWindowMs: envVars.RATE_LIMIT_DEFAULT_WINDOW_MS,
    authMax: envVars.RATE_LIMIT_AUTH_MAX,
    authWindowMs: envVars.RATE_LIMIT_AUTH_WINDOW_MS,
    inviteMax: envVars.RATE_LIMIT_INVITE_MAX,
    inviteWindowMs: envVars.RATE_LIMIT_INVITE_WINDOW_MS,
    ingestionMax: envVars.RATE_LIMIT_INGESTION_MAX,
    ingestionWindowMs: envVars.RATE_LIMIT_INGESTION_WINDOW_MS,
    websocketMax: envVars.WS_RATE_LIMIT_MAX,
    websocketWindowMs: envVars.WS_RATE_LIMIT_WINDOW_MS,
    websocketBurstMax: envVars.WS_RATE_LIMIT_BURST_MAX,
    websocketBurstWindowMs: envVars.WS_RATE_LIMIT_BURST_WINDOW_MS,
  },
  queue: {
    driver: envVars.QUEUE_DRIVER,
  },
  ingestion: {
    maxBodyKb: envVars.INGESTION_MAX_BODY_KB,
    maxBodyBytes: envVars.INGESTION_MAX_BODY_KB * 1024,
    sdk: {
      apiKey: envVars.PROJECTTRAKR_INGESTION_KEY ?? null,
      endpoint: envVars.PROJECTTRAKR_INGESTION_ENDPOINT ?? null,
      source: envVars.PROJECTTRAKR_INGESTION_SOURCE ?? 'api',
      enabled: Boolean(
        envVars.PROJECTTRAKR_CAPTURE_BACKEND_ERRORS &&
          envVars.PROJECTTRAKR_INGESTION_KEY &&
          envVars.PROJECTTRAKR_INGESTION_ENDPOINT,
      ),
      captureBackendErrors: envVars.PROJECTTRAKR_CAPTURE_BACKEND_ERRORS,
    },
  },
  boldMetrics: {
    clientId: envVars.BOLD_METRICS_CLIENT_ID,
    userKey: envVars.BOLD_METRICS_USER_KEY,
  },
  isDevelopment:
    envVars.NODE_ENV === 'test' || envVars.NODE_ENV === 'development',
  // minEventStartDate: envVars.EARLIEST_EVENT_DATE_GAP,

  // cloudinary: {
  //   cloudName: envVars.CLOUDINARY_CLOUD_NAME,
  //   apiKey: envVars.CLOUDINARY_API_KEY,
  //   apiSecret: envVars.CLOUDINARY_API_SECRET,
  //   url: envVars.CLOUDINARY_URL,
  // },
  // pusher: {
  //   secretKey: envVars.PUSHER_SECRET_KEY,
  //   instanceId: envVars.PUSHER_INSTANCE_ID,
  // },
  // klaviyo: {
  //   fabricId: envVars.KLAVIYO_FABRIC_SELLER,
  //   generalId: envVars.KLAVIYO_GENERAL,
  //   GroupsId: envVars.KLAVIYO_GROUPS,
  //   apiKey: envVars.KLAVIYO_API,
  // },
  // monnify: {
  //   apiKey: envVars.MONNIFY_API_KEY,
  //   secretKey: envVars.MONNIFY_SECRET,
  //   contract: envVars.MONNIFY_CONTRACT_CODE,
  //   baseUrl: envVars.MONNIFY_BASE_API_URL,
  // },
  // measurement_payment: {
  //   payment_success_icp: envVars.MEASUREMENT_PAYMENT_SUCCESSS_ICP,
  //   payment_failed_icp: envVars.MEASUREMT_PAYMENT_FAILED_ICP,
  //   payment_success_group: envVars.MEASUREMENT_PAYMENT_SUCCESSS_GROUP,
  // },
  // fund_transfer: {
  //   fund_group_from_personl: envVars.FUND_TRANSFER_PERSONAL_GROUP,
  // },
  // tentMeasurementMail: envVars.TENTH_MEASUREMENT,
  // uncompleted_measurement: envVars.UNCOMPLETED_MEASUREMENT,
  // orderProcessing: envVars.ORDER_PROCESSING,
  // groupOrder: envVars.GROUP_ORDER,
  // paymentDone: envVars.PAYMENT_DONE,
  // deliveryInProgress: envVars.DELIVERY_PROGRESS,
  // auto_size_price: envVars.AUTOSIZE_PRICE,
  // TERMI_SECRET_KEY: envVars.TERMI_SECRET_KEY,
  // TERMI_API_KEY: envVars.TERMI_API_KEY,
  // jira: {
  //   user: envVars.JIRA_USER,
  //   pass: envVars.JIRA_PASS,
  // },
  // paystack: {
  //   key: envVars.PAYSTACK_KEY,
  // },
  // trialPeriod: {
  //   start: envVars.TRIAL_START_DATE,
  //   end: envVars.TRIAL_END_DATE,
  // },
  // adminLink: envVars.ADMIN_LINK,
  // wordpress: {
  //   consumer_key: envVars.WORDPRESS_CONSUMER_KEY,
  //   consumer_secret: envVars.WORDPRESS_CONSUMER_SECRET,
  // },
  // socialAuth: {
  //   google: {
  //     id: envVars.GOOGLE_CLIENT_ID,
  //     secret: envVars.GOOGLE_CLIENT_SECRET,
  //   },
  // },
};

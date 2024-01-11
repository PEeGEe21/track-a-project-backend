import * as dotenv from 'dotenv';
import * as joi from 'joi';

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
    JWT_SECRET: joi.string().required(),
    FRONTEND_URL: joi.string().required(),

    // database config
    MONGODB_URI: joi.string().required(),
    DATABASE_LOGGING: joi
      .boolean()
      .truthy('TRUE')
      .truthy('true')
      .falsy('FALSE')
      .falsy('false')
      .default(false),

    // // emails
    // SENDGRID_API_KEY: joi.string().required(),
    // OUTFIT_BUYER_AFTER_FIRST_EVENT_EMAIL: joi.string().required(),
    // RECIPIENT_INVITE_EMAIL_TEMPLATE: joi.string().required(),
    // EXISTING_TAILOR_INVITE_EMAIL_TEMPLATE: joi.string().required(),
    // UNREGISTERED_TAILOR_INVITE_EMAIL_TEMPLATE: joi.string().required(),
    // RECIPIENT_INVITE_NEW_USER_EMAIL_TEMPLATE: joi.string().required(),
    // SENDGRID_FROM_EMAIL: joi.string().required(),
    // EARLIEST_EVENT_DATE_GAP: joi.number().required(),

    // AT_KEY: joi.string().required(),
    // AT_USERNAME: joi.string().required(),
    OTP_TTL: joi.number().required().default(600),
    PASSWORD_RECOVERY_TTL: joi.number().required().default(72),
    PASSWORD_RECOVERY_EMAIL: joi.string().required(),
    PASSWORD_RECOVERY_URL: joi.string().required(),
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

export const config = {
  env: envVars.NODE_ENV,
  url: envVars.APP_URL,
  port: envVars.PORT,
  logLevel: envVars.LOG_LEVEL,
  secret: envVars.JWT_SECRET,
  feBaseUrl: envVars.FE_BASE_URL,
  accountVerificationTtl: envVars.ACCOUNT_VERIFICATION_TTL,
  accountVerificationUrl: envVars.ACCOUNT_VERIFICATION_URL,
  verifyHash: envVars.VERIFY_HASH_HOOK,
  db: {
    // uri: envVars.MONGODB_URI,
    host: envVars.DATABASE_HOST,
    username: envVars.DATABASE_USERNAME,
    password: envVars.DATABASE_PASSWORD,
    name: envVars.DATABASE_NAME,
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
  //   existingTailorInviteEmail: envVars.EXISTING_TAILOR_INVITE_EMAIL_TEMPLATE,
  //   newUserRecipientInviteEmail:
  //     envVars.RECIPIENT_INVITE_NEW_USER_EMAIL_TEMPLATE,
  //   unregisteredTailorInviteEmail:
  //     envVars.UNREGISTERED_TAILOR_INVITE_EMAIL_TEMPLATE,
  //   fromEmail: envVars.SENDGRID_FROM_EMAIL,
  //   noReply: 'no-reply@fitted.ng',
  //   passwordRecoveryEmail: envVars.PASSWORD_RECOVERY_EMAIL,
  //   memberSignUpEmail: envVars.MEMBER_SIGNUP,
  //   accountVerificationEmail: envVars.ACCOUNT_VERIFICATION_EMAIL_TEMPLATE,
  //   existingUserCreateEventEmail:
  //     envVars.EXISTING_USER_CREATE_EVENT_EMAIL_TEMPLATE,
  //   TAILOR_SIGNUP_EMAIL_PASSWORD_ID: envVars.TAILOR_SIGNUP_EMAIL_PASSWORD_ID,
  //   TAILOR_SIGNUP_EMAIL_NO_PASSWORD_ID:
  //     envVars.TAILOR_SIGNUP_EMAIL_NO_PASSWORD_ID,
  //   TAILOR_RESET_PASSWORD: envVars.TAILOR_RESET_PASSWORD,
  //   TAILOR_SIGN_UP: envVars.TAILOR_SIGN_UP,
  //   TAILOR_INVITE: envVars.TAILOR_INVITE,
  //   TAILOR_INVITE_EXISTING: envVars.TAILOR_INVITE_EXISTING,
  //   TAILOR_LINK: envVars.TAILOR_LINK,
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
  //   tailorId: envVars.KLAVIYO_TAILOR,
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
  // tailor_send_measurement: {
  //   fitted_otp_email: envVars.FITTED_OTP_EMAIL,
  //   tailor_measurement_new: envVars.TAILOR_MEASUREMENT_NEW,
  //   tailor_measurement_existing: envVars.TAILOR_MEASUREMENT_EXISTING,
  //   tailor_input_measurement_for_user:
  //     envVars.TAILOR_INPUT_MEASUREMENT_FOR_USER,
  //   measurement_input_request: envVars.FITTED_MEASUREMENT_INPUT_REQUEST,
  // },
  // tentMeasurementMail: envVars.TENTH_MEASUREMENT,
  // uncompleted_measurement: envVars.UNCOMPLETED_MEASUREMENT,
  // orderProcessing: envVars.ORDER_PROCESSING,
  // groupOrder: envVars.GROUP_ORDER,
  // paymentDone: envVars.PAYMENT_DONE,
  // sewingInProgress: envVars.SEWING_IN_PROGRESS,
  // sewingCompleted: envVars.SEWING_COMPLETED,
  // deliveryInProgress: envVars.DELIVERY_PROGRESS,
  // fulfiltWithFitted: envVars.FULFIL_WITH_FITTED,
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

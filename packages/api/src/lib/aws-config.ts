/**
 * AWS Configuration Helper
 * Supports both standard AWS_* env vars and MY_AWS_* fallbacks for Amplify
 */

export const awsConfig = {
  region: process.env.AWS_REGION || process.env.MY_AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.MY_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  },
};

export const s3Config = {
  bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'redacnews-media',
  region: process.env.AWS_S3_BUCKET_REGION || process.env.S3_BUCKET_REGION || 'eu-west-3',
};

export const cloudfrontConfig = {
  domain: process.env.AWS_CLOUDFRONT_DOMAIN || process.env.CLOUDFRONT_DOMAIN || '',
};

export const sesConfig = {
  fromEmail: process.env.AWS_SES_FROM_EMAIL || process.env.SES_FROM_EMAIL || 'noreply@redacnews.link',
};

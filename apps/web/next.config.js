/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@redacnews/db', '@redacnews/api', '@redacnews/types', '@redacnews/audio-editor'],
  images: {
    domains: [
      process.env.AWS_CLOUDFRONT_DOMAIN || process.env.CLOUDFRONT_DOMAIN,
      'cognito-idp.eu-west-3.amazonaws.com',
    ].filter(Boolean),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;

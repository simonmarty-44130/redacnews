/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@redacnews/db', '@redacnews/api', '@redacnews/types'],
  images: {
    domains: [
      process.env.AWS_CLOUDFRONT_DOMAIN,
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

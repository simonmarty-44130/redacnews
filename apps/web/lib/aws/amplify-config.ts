import { Amplify } from 'aws-amplify';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

// Extraire la région du userPoolId (format: eu-west-3_xxxxxxxx)
const region = userPoolId.split('_')[0] || 'eu-west-3';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
      },
    },
  },
};

Amplify.configure(amplifyConfig, {
  ssr: true,
});

// Log pour debug (à retirer en prod)
if (typeof window !== 'undefined') {
  console.log('Amplify configured with:', {
    userPoolId,
    userPoolClientId,
    region,
  });
}

export default Amplify;

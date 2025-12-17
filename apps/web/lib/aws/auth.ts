import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  confirmSignIn,
  getCurrentUser,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

export async function login(email: string, password: string) {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username: email,
      password,
    });
    return { isSignedIn, nextStep };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function completeNewPassword(newPassword: string) {
  try {
    const { isSignedIn, nextStep } = await confirmSignIn({
      challengeResponse: newPassword,
    });
    return { isSignedIn, nextStep };
  } catch (error) {
    console.error('Complete new password error:', error);
    throw error;
  }
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  try {
    const { isSignUpComplete, userId, nextStep } = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          given_name: firstName,
          family_name: lastName,
        },
      },
    });
    return { isSignUpComplete, userId, nextStep };
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
}

export async function confirmRegistration(email: string, code: string) {
  try {
    const { isSignUpComplete } = await confirmSignUp({
      username: email,
      confirmationCode: code,
    });
    return { isSignUpComplete };
  } catch (error) {
    console.error('Confirm error:', error);
    throw error;
  }
}

export async function resendConfirmationCode(email: string) {
  try {
    await resendSignUpCode({ username: email });
    return { success: true };
  } catch (error) {
    console.error('Resend code error:', error);
    throw error;
  }
}

export async function logout() {
  try {
    await signOut();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

export async function getSession() {
  try {
    const session = await fetchAuthSession();
    return session;
  } catch (error) {
    return null;
  }
}

export async function getUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    return null;
  }
}

export async function forgotPassword(email: string) {
  try {
    const output = await resetPassword({ username: email });
    return output;
  } catch (error) {
    console.error('Forgot password error:', error);
    throw error;
  }
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
) {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
    return { success: true };
  } catch (error) {
    console.error('Confirm forgot password error:', error);
    throw error;
  }
}

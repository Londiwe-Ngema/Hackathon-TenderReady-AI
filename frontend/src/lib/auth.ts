import { Amplify } from "aws-amplify";
import {
  confirmSignUp as amplifyConfirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  resendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from "aws-amplify/auth";
import { config, demoMode } from "./config";

export interface SessionUser {
  email: string;
  name?: string;
}

const DEMO_USER_KEY = "tenderready.demoUser";

export function configureAuth(): void {
  if (demoMode || !config) return;
  Amplify.configure({
    Auth: { Cognito: { userPoolId: config.userPoolId, userPoolClientId: config.userPoolClientId } },
  });
}

export async function currentUser(): Promise<SessionUser | null> {
  if (demoMode) {
    try {
      const raw = sessionStorage.getItem(DEMO_USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
  try {
    const session = await fetchAuthSession();
    if (!session.tokens?.idToken) return null;
    const attrs = await fetchUserAttributes();
    return { email: attrs.email ?? "", name: attrs.name };
  } catch {
    return null;
  }
}

export async function idToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

export type SignInResult = "done" | "confirm";

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (demoMode) {
    sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify({ email, name: "Demo Advisor" }));
    return "done";
  }
  const res = await amplifySignIn({ username: email, password });
  if (res.nextStep.signInStep === "CONFIRM_SIGN_UP") return "confirm";
  if (!res.isSignedIn) throw new Error(`Additional sign-in step required: ${res.nextStep.signInStep}`);
  return "done";
}

export async function signUp(email: string, password: string, name: string): Promise<SignInResult> {
  if (demoMode) {
    sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify({ email, name }));
    return "done";
  }
  const res = await amplifySignUp({
    username: email,
    password,
    options: { userAttributes: { email, name } },
  });
  return res.isSignUpComplete ? "done" : "confirm";
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  if (demoMode) return;
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

export async function resendCode(email: string): Promise<void> {
  if (demoMode) return;
  await resendSignUpCode({ username: email });
}

export async function signOut(): Promise<void> {
  if (demoMode) {
    sessionStorage.removeItem(DEMO_USER_KEY);
    return;
  }
  await amplifySignOut();
}

import { PublicClientApplication, type AccountInfo, type Configuration } from '@azure/msal-browser';

type AuthConfig = {
  authority: string;
  client_id: string;
  redirect_uri: string;
  test_mode: boolean;
};

export type OwnerSession = { token: string; label: string };

const scopes = ['openid', 'profile', 'email'];
let authConfig: AuthConfig | null = null;
let client: PublicClientApplication | null = null;
let initialized = false;

async function config() {
  if (authConfig) return authConfig;
  const response = await fetch('/api/auth/config', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('Microsoft sign-in is unavailable. Try again.');
  authConfig = await response.json() as AuthConfig;
  return authConfig;
}

async function application() {
  if (client) return client;
  const values = await config();
  const options: Configuration = {
    auth: {
      clientId: values.client_id,
      authority: values.authority,
      knownAuthorities: [new URL(values.authority).hostname],
      redirectUri: `${location.origin}${values.redirect_uri}`,
      postLogoutRedirectUri: `${location.origin}/`,
      navigateToLoginRequestUrl: false
    },
    cache: { cacheLocation: 'sessionStorage' }
  };
  client = new PublicClientApplication(options);
  return client;
}

async function ready() {
  const app = await application();
  if (!initialized) {
    await app.initialize();
    const result = await app.handleRedirectPromise();
    if (result?.account) app.setActiveAccount(result.account);
    initialized = true;
    if (location.pathname === '/auth/callback') history.replaceState({}, '', '/owner');
  }
  return app;
}

function accountLabel(account: AccountInfo) {
  return account.name || account.username || 'Microsoft account';
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const values = await config();
  const testToken = sessionStorage.getItem('crc-test-auth-token');
  if (values.test_mode && testToken) return { token: testToken, label: 'E2E Microsoft owner' };
  const app = await ready();
  const account = app.getActiveAccount() || app.getAllAccounts()[0];
  if (!account) return null;
  app.setActiveAccount(account);
  try {
    const result = await app.acquireTokenSilent({ account, scopes });
    const token = result.idToken || result.accessToken;
    return token ? { token, label: accountLabel(account) } : null;
  } catch {
    return null;
  }
}

export async function signIn() {
  const app = await ready();
  await app.loginRedirect({ scopes, prompt: 'select_account' });
}

export async function signOut() {
  const app = await ready();
  const account = app.getActiveAccount() || app.getAllAccounts()[0];
  if (account) await app.logoutRedirect({ account });
}

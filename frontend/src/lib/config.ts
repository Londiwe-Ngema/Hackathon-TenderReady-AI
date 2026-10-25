export interface RuntimeConfig {
  region: string;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

const DEMO_KEY = "tenderready.demo";

/**
 * Demo mode serves realistic fixture data entirely in the browser. It is the backup demo for the
 * hackathon and is used automatically when no deployed backend config is available (e.g. `pnpm dev`).
 * Toggle with ?demo=1 / ?demo=0.
 */
function resolveDemoFlag(): boolean | null {
  const param = new URLSearchParams(window.location.search).get("demo");
  try {
    if (param === "1") sessionStorage.setItem(DEMO_KEY, "1");
    if (param === "0") sessionStorage.removeItem(DEMO_KEY);
    return sessionStorage.getItem(DEMO_KEY) === "1" ? true : param === "0" ? false : null;
  } catch {
    return param === "1" ? true : null;
  }
}

export let config: RuntimeConfig | null = null;
export let demoMode = false;

export async function loadConfig(): Promise<void> {
  const flag = resolveDemoFlag();
  if (flag === true) {
    demoMode = true;
    return;
  }
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    if (res.ok && res.headers.get("content-type")?.includes("json")) {
      config = (await res.json()) as RuntimeConfig;
      return;
    }
  } catch {
    /* fall through to demo */
  }
  const envConfig = import.meta.env.VITE_API_URL
    ? {
        region: import.meta.env.VITE_REGION,
        apiUrl: import.meta.env.VITE_API_URL,
        userPoolId: import.meta.env.VITE_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      }
    : null;
  if (envConfig) config = envConfig;
  else demoMode = true;
}

export function exitDemo(): void {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
  window.location.href = "/?demo=0";
}

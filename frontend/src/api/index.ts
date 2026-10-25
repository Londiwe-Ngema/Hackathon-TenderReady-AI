import { config, demoMode } from "../lib/config";
import { createDemoApi } from "./demo";
import { createHttpApi } from "./http";
import type { Api } from "./types";

let instance: Api | null = null;

export function api(): Api {
  if (!instance) instance = demoMode || !config ? createDemoApi() : createHttpApi(config);
  return instance;
}

export { ApiError } from "./types";
export type { ChatTurn } from "./types";

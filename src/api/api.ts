import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import SocketManager from "@/socket";
import { RemoteRunbook } from "@/state/models";
import Logger from "@/lib/logger";

type PasswordStore = {
  get: (service: string, user: string) => Promise<string | null>;
  set: (service: string, user: string, password: string) => Promise<void>;
  remove: (service: string, user: string) => Promise<void>;
};

const keychainStore: PasswordStore = {
  get: (service: string, user: string) => invoke("load_password", { service, user }),
  set: (service: string, user: string, password: string) =>
    invoke("save_password", { service, user, value: password }),
  remove: (service: string, user: string) => invoke("delete_password", { service, user }),
};

const localStorageStore: PasswordStore = {
  get: (service: string, user: string) =>
    Promise.resolve(localStorage.getItem(`${service}:${user}`)),
  set: (service: string, user: string, password: string) =>
    Promise.resolve(localStorage.setItem(`${service}:${user}`, password)),
  remove: (service: string, user: string) =>
    Promise.resolve(localStorage.removeItem(`${service}:${user}`)),
};

function getStorage() {
  if (import.meta.env.MODE === "development") {
    return localStorageStore;
  } else {
    return keychainStore;
  }
}

const _loadPassword = (service: string, user: string) => getStorage().get(service, user);

const _savePassword = (service: string, user: string, password: string) =>
  getStorage().set(service, user, password);

const _deletePassword = (service: string, user: string) => getStorage().remove(service, user);

// Convenience function for setting the hub credentials in development
if (import.meta.env.MODE === "development") {
  (window as any).setHubCredentials = async (username: string, key: string) => {
    await _savePassword("sh.atuin.runbooks.api", username, key);
    localStorage.setItem("username", username);
    SocketManager.setApiToken(key);
  };
}

let cachedHubApiToken: string | null = null;
export async function setHubApiToken(username: string, token: string) {
  await _savePassword("sh.atuin.runbooks.api", username, token);
  localStorage.setItem("username", username);
  cachedHubApiToken = token;
}

let requests = new Set<Promise<any>>();
export async function getHubApiToken() {
  if (cachedHubApiToken) return cachedHubApiToken;

  if (requests.size > 0) {
    await Promise.all(requests);
    return getHubApiToken();
  }

  let req = new Promise<string | null>(async (resolve, reject) => {
    let username = localStorage.getItem("username");
    if (!username) return reject(new Error("No username found in local storage"));

    const password = await _loadPassword("sh.atuin.runbooks.api", username);
    cachedHubApiToken = password;
    resolve(password);
  });
  requests.add(req);
  req
    .catch(() => {
      /* don't log a warning */
    })
    .finally(() => requests.delete(req));
  return req;
}

export async function clearHubApiToken() {
  let username = localStorage.getItem("username");
  if (!username) throw new Error("No username found in local storage");

  await _deletePassword("sh.atuin.runbooks.api", username);
  localStorage.removeItem("username");
  cachedHubApiToken = null;
}

export function domain() {
  if (import.meta.env.MODE === "development") return "localhost:4000";
  return "hub.atuin.sh";
}

export function endpoint() {
  if (import.meta.env.MODE === "development") return `http://${domain()}`;

  return `https://${domain()}`;
}

export class HttpResponseError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "HttpResponseError";
  }
}

type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";

type RequestOpts = {
  token?: string;
};

async function makeRequest<T>(
  method: RequestMethod,
  path: string,
  body?: object | string,
  options: RequestOpts = {},
): Promise<T> {
  let apiToken: string | undefined | null = options.token;
  if (!apiToken) {
    try {
      apiToken = await getHubApiToken();
    } catch (_) {
      // ignore
    }
  }

  if (path[0] != "/") path = `/${path}`;

  let loggerInfo = `API - ${method} ${path}`;
  if (apiToken) {
    loggerInfo += ` (token: ${apiToken.slice(0, 14)}...)`;
  } else {
    loggerInfo += " (no token)";
  }
  const logger = new Logger(loggerInfo, "darkblue", "cornflowerblue");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiToken) {
    headers["Authorization"] = `Bearer ${apiToken}`;
  }

  const opts: RequestInit = {
    method,
    headers,
  };

  if (body && typeof body == "string") {
    opts.body = body;
  } else if (body) {
    opts.body = JSON.stringify(body);
  }

  const start = performance.now();
  logger.debug("Starting request");
  const resp = await fetch(`${endpoint()}/api${path}`, opts);
  const end = performance.now();
  const delta = Math.floor(end - start); // dammit javascript
  logger.debug(`${resp.status} (${delta}ms)`);

  if (resp.ok) {
    return resp.json();
  } else {
    let data = await resp.text();
    try {
      data = JSON.parse(data);
    } catch (_) {
      // ignore
    }
    throw new HttpResponseError(resp.status, data);
  }
}

export function get<T>(path: string, options?: RequestOpts): Promise<T> {
  return makeRequest<T>("GET", path, undefined, options);
}

export function post<T>(path: string, body: string | object, options?: RequestOpts): Promise<T> {
  return makeRequest<T>("POST", path, body, options);
}

export function put<T>(path: string, body: string | object, options?: RequestOpts): Promise<T> {
  return makeRequest<T>("PUT", path, body, options);
}

export function del<T>(path: string, options?: RequestOpts): Promise<T> {
  return makeRequest<T>("DELETE", path, undefined, options);
}

interface MeResponse {
  user: {
    id: string;
    username: string;
    email: string;
    display_name: string;
    avatar_url: string;
  };
}

export function me(token?: string): Promise<MeResponse> {
  return get("/me", { token });
}

export async function getRunbookID(id: string): Promise<RemoteRunbook> {
  const { runbook } = await get<{ runbook: RemoteRunbook }>(
    `/runbooks/${id}?include=user,snapshots`,
  );
  return runbook;
}

interface RemoteSnapshot {
  id: string;
  tag: string;
  runbook_id: string;
  content: any[];
  created: string;
}

export async function getSnapshotById(id: string): Promise<RemoteSnapshot> {
  const { snapshot } = await get<{ snapshot: RemoteSnapshot }>(`/snapshots/${id}`);
  return snapshot;
}

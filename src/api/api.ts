import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import SocketManager from "@/socket";
import { RemoteRunbook, RemoteUser } from "@/state/models";
import Logger from "@/lib/logger";
import Runbook from "@/state/runbooks/runbook";
import Snapshot from "@/state/runbooks/snapshot";
import Mutex from "@/lib/mutex";
import { KVStore } from "@/state/kv";
import AtuinEnv from "@/atuin_env";

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
  if (AtuinEnv.isDev) {
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
if (AtuinEnv.isDev) {
  (window as any).setHubCredentials = async (username: string, key: string) => {
    await _savePassword("sh.atuin.runbooks.api", username, key);
    const kv = await KVStore.open_default();
    await kv.set("username", username);
    SocketManager.setApiToken(key);
  };
}

let cachedHubApiToken: string | null = null;
export async function setHubApiToken(username: string, token: string) {
  await _savePassword("sh.atuin.runbooks.api", username, token);
  const kv = await KVStore.open_default();
  await kv.set("username", username);
  cachedHubApiToken = token;
}

const mutex = new Mutex();
// Calling `getHubApiToken` more than once in short succession will trigger multiple calls to
// `_loadPassword`, but each call to `_loadPassword` blocks the successive ones, making the cache
// ineffective. As such, each call to `getHubApiToken` is wrapped in a mutex to ensure only one call
// is processed at a time.
export function getHubApiToken() {
  return mutex.runExclusive(async () => {
    if (cachedHubApiToken) return cachedHubApiToken;

    const kv = await KVStore.open_default();
    let username = await kv.get<string>("username");
    if (!username) {
      // Try migrating local storage
      const localStorageUsername = localStorage.getItem("username");
      if (localStorageUsername) {
        await kv.set("username", localStorageUsername);
        localStorage.removeItem("username");
        username = localStorageUsername;
      }
    }
    if (!username) throw new Error("No username found in KVStore");

    const password = await _loadPassword("sh.atuin.runbooks.api", username);
    cachedHubApiToken = password;
    return password;
  });
}

export async function clearHubApiToken() {
  const kv = await KVStore.open_default();
  let username = await kv.get<string>("username");
  if (!username) throw new Error("No username found in KVStore");

  await _deletePassword("sh.atuin.runbooks.api", username);
  await kv.delete("username");
  cachedHubApiToken = null;
}

export function endpoint() {
  return `${AtuinEnv.httpProtocol}://${AtuinEnv.hubDomain}`;
}

export class HttpResponseError extends Error {
  code: number;
  data: object | string;
  constructor(code: number, data: object | string) {
    super(`HTTP ${code}`);
    this.code = code;
    this.data = data;
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

  if (resp.ok && resp.status != 204) {
    return resp.json();
  } else if (resp.status == 204) {
    return {} as T;
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

export async function allRunbookIds(): Promise<string[]> {
  const { runbooks } = await get<{ runbooks: string[] }>("/runbooks?id_only=true");
  return runbooks;
}

export async function getRunbookID(id: string): Promise<RemoteRunbook> {
  const { runbook } = await get<{ runbook: RemoteRunbook }>(
    `/runbooks/${id}?include=user,snapshots,collaborations`,
  );
  return runbook;
}

export function createRunbook(runbook: Runbook, slug: string, visibility: string) {
  const body = {
    runbook: {
      id: runbook.id,
      name: runbook.name,
      slug: slug,
      version: 0,
      created: runbook.created,
      visibility: visibility,
    },
  };

  return post("/runbooks", body);
}

export function updateRunbook(runbook: Runbook, slug: string, visibility: string) {
  const body = {
    runbook: {
      id: runbook.id,
      name: runbook.name,
      slug: slug,
      version: 0,
      created: runbook.created,
      visibility: visibility,
    },
  };

  return put(`/runbooks/${runbook.id}`, body);
}

export function deleteRunbook(id: string) {
  return del(`/runbooks/${id}`);
}

export interface RemoteSnapshot {
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

export function createSnapshot(snapshot: Snapshot) {
  const args = {
    snapshot: {
      id: snapshot.id,
      tag: snapshot.tag,
      client_created: snapshot.created,
      content: snapshot.content,
    },
  };
  return post(`/runbooks/${snapshot.runbook_id}/snapshots`, args);
}

export interface RemoteCollaboration {
  id: string;
  accepted: boolean;
  runbook: {
    id: string;
    owner: string;
    slug: string;
    name: string;
  };
}

interface CollaborationsIndexResponse {
  accepted: RemoteCollaboration[];
  pending: RemoteCollaboration[];
}

interface CollaborationResponse {
  collaboration: RemoteCollaboration;
}

export function getCollaborations(): Promise<CollaborationsIndexResponse> {
  return get("/collaborations");
}

export async function getCollaborationForRunbook(
  runbookId: string,
): Promise<RemoteCollaboration | null> {
  const collabResponse = await getCollaborations();
  const collabs = [...collabResponse.accepted, ...collabResponse.pending];
  const collab = collabs.find((c) => c.runbook.id === runbookId);
  return collab || null;
}

export async function getCollaborationById(id: string): Promise<RemoteCollaboration> {
  const { collaboration } = await get<CollaborationResponse>(`/collaborations/${id}`);
  return collaboration;
}

export async function createCollaborationInvitation(runbookId: string, userId: string) {
  return post(`/collaborations`, { runbook_id: runbookId, user_id: userId });
}

export function acceptCollaboration(id: string) {
  return put(`/collaborations/${id}`, { accepted: true });
}

export function declineCollaboration(id: string) {
  return put(`/collaborations/${id}`, { accepted: false });
}

export function deleteCollaboration(id: string) {
  return del<null>(`/collaborations/${id}`);
}

export async function searchUsers(query: string) {
  if (!query || query.length <= 2) return [];

  const { users } = await get<{ users: RemoteUser[] }>(`/users?query=${query}`);
  console.log(users);
  return users;
}

import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import SocketManager from "@/socket";

type PasswordStore = {
  get: (service: string, user: string) => Promise<string | null>;
  set: (service: string, user: string, password: string) => Promise<void>;
  remove: (service: string, user: string) => Promise<void>;
};

const keychainStore: PasswordStore = {
  get: (service: string, user: string) =>
    invoke("load_password", { service, user }),
  set: (service: string, user: string, password: string) =>
    invoke("save_password", { service, user, value: password }),
  remove: (service: string, user: string) =>
    invoke("delete_password", { service, user }),
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

const _loadPassword = (service: string, user: string) =>
  getStorage().get(service, user);

const _savePassword = (service: string, user: string, password: string) =>
  getStorage().set(service, user, password);

const _deletePassword = (service: string, user: string) =>
  getStorage().remove(service, user);

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

export async function getHubApiToken() {
  if (cachedHubApiToken) return cachedHubApiToken;

  let username = localStorage.getItem("username");
  if (!username) throw new Error("No username found in local storage");

  const password = await _loadPassword("sh.atuin.runbooks.api", username);
  cachedHubApiToken = password;
  return password;
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

interface MeResponse {
  user: {
    id: string;
    username: string;
    email: string;
    display_name: string;
    avatar_url: string;
  };
}

export async function me(token?: string): Promise<MeResponse> {
  let apiToken;

  if (!token) {
    apiToken = await getHubApiToken();
  } else {
    apiToken = token;
  }

  let resp = await fetch(`${endpoint()}/api/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (resp.status != 200) throw new Error("Invalid token");

  return await resp.json();
}

export async function getRunbookID(id: string): Promise<any> {
  let token = await getHubApiToken();
  let resp = await fetch(`${endpoint()}/api/runbooks/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (resp.status === 404) {
    throw new Error("Runbook not found");
  }

  let runbook = await resp.json();
  return runbook;
}

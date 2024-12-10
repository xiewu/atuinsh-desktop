import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import SocketManager from "@/socket";

export async function loadPassword(service: string, user: string) {
  // Use localStorage in dev, and keychain in prod

  if (import.meta.env.MODE === "development") {
    return localStorage.getItem(`${service}:${user}`);
  }

  return await invoke<string>("load_password", { service, user });
}

export async function savePassword(
  service: string,
  user: string,
  password: string,
) {
  if (import.meta.env.MODE === "development") {
    return localStorage.setItem(`${service}:${user}`, password);
  }

  await invoke("save_password", {
    service,
    user,
    value: password,
  });
}

// Convenience function for setting the hub credentials in development
if (import.meta.env.MODE === "development") {
  (window as any).setHubCredentials = (username: string, key: string) => {
    localStorage.setItem("username", username);
    savePassword("sh.atuin.runbooks.api", username, key);
    SocketManager.setApiToken(key);
  };
}

export async function getHubApiToken() {
  let username = localStorage.getItem("username");
  if (!username) throw new Error("No username found in local storage");

  return loadPassword("sh.atuin.runbooks.api", username);
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

export async function getApiToken() {
  let username = localStorage.getItem("username");
  if (!username) throw new Error("No username found in local storage");

  return await loadPassword("sh.atuin.runbooks.api", username);
}

export async function getRunbookID(id: string): Promise<any> {
  let token = await getApiToken();
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

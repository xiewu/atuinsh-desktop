import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";

export async function loadPassword(service: string, user: string) {
  // Use localStorage in dev, and keychain in prod

  if (import.meta.env.MODE === "development") {
    return localStorage.getItem(`${service}:${user}`);
  }

  return await invoke("load_password", { service, user });
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

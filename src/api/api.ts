import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";

const loadPassword = async (service: string, user: string) => {
  // Use localStorage in dev, and keychain in prod

  if (import.meta.env.MODE === "development") {
    return localStorage.getItem(`${service}:${user}`);
  }

  return await invoke("load_password", { service, user });
};

export function endpoint() {
  if (import.meta.env.MODE === "development") return "http://localhost:4000";

  return "https://hub.atuin.sh";
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
    let username = localStorage.getItem("username");
    if (!username) throw new Error("No username found in local storage");

    apiToken = await loadPassword("sh.atuin.runbooks.api", username);
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

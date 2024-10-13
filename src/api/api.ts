import { invoke } from "@tauri-apps/api/core";

const loadPassword = async (service: string, user: string) => {
  // Use localStorage in dev, and keychain in prod

  if (import.meta.env.MODE === "development") {
    return localStorage.getItem(`${service}:${user}`);
  }

  return await invoke("load_password", { service, user });
}

export function endpoint() {
  if (import.meta.env.MODE === "development") return "http://localhost:4000";

  return "https://api.runbooks.atuin.sh";
}

export async function register(username: string, email: string, password: string) {
  return await fetch(`${endpoint()}/api/v0/user/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login(username: string, password: string) {
  return await fetch(`${endpoint()}/api/v0/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
}

export async function me() {
  let username = localStorage.getItem("username");
  if (!username) return null;

  let token = await loadPassword("sh.atuin.runbooks.api", username);

  let resp = await fetch(`${endpoint()}/api/v0/user/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  return await resp.json();
}

export async function logout() {
  let username = localStorage.getItem("username");
  if (!username) return null;

  let token = await loadPassword("sh.atuin.runbooks.api", username);

  let resp = await fetch(`${endpoint()}/api/v0/user/logout`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  return await resp.json();
}

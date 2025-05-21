import AtuinEnv from "@/atuin_env";
import DevConsole from "@/lib/dev/dev_console";
import Mutex from "@/lib/std/mutex";
import SocketManager from "@/socket";
import { KVStore } from "@/state/kv";
import { invoke } from "@tauri-apps/api/core";

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
DevConsole.addAppObject("setHubCredentials", async (username: string, key: string) => {
  await _savePassword("sh.atuin.runbooks.api", username, key);
  const kv = await KVStore.open_default();
  await kv.set("username", username);
  SocketManager.setApiToken(key);
});

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

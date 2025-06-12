import { RunbookSource } from "./state/runbooks/runbook";
import { getGlobalOptions } from "./lib/global_options";

const globalOptions = getGlobalOptions();

function makeUrl(root: string, path: string) {
  if (path.startsWith("/")) {
    return `${root}${path}`;
  }

  return `${root}/${path}`;
}

interface AtuinEnv {
  hubDomain: string;
  httpProtocol: "http" | "https";
  websocketProtocol: "ws" | "wss";
  isDev: boolean;
  isProd: boolean;
  hubRunbookSource: RunbookSource;
  sqliteFilePrefix: string;
  stateStorageName: string;

  url: (path: string) => string;
}

const dev: AtuinEnv = {
  hubDomain: "localhost:4000",
  httpProtocol: "http",
  websocketProtocol: "ws",
  isDev: true,
  isProd: false,
  hubRunbookSource: `hub-${globalOptions.devPrefix}` as RunbookSource,
  sqliteFilePrefix: `${globalOptions.devPrefix}_`,
  stateStorageName: `atuin-storage-${globalOptions.devPrefix}`,

  url: makeUrl.bind(null, "http://localhost:4000"),
};

const prod: AtuinEnv = {
  hubDomain: "hub.atuin.sh",
  httpProtocol: "https",
  websocketProtocol: "wss",
  isDev: false,
  isProd: true,
  hubRunbookSource: "hub",
  sqliteFilePrefix: "",
  stateStorageName: "atuin-storage",

  url: makeUrl.bind(null, "https://hub.atuin.sh"),
};

// Setting a const rather than exporting directly
// helps editors autocomplete `AtuinEnv`
const AtuinEnv: AtuinEnv = import.meta.env.MODE === "production" ? prod : dev;
export default AtuinEnv;

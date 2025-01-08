import { RunbookSource } from "./state/runbooks/runbook";

interface AtuinEnv {
  hubDomain: string;
  httpProtocol: "http" | "https";
  websocketProtocol: "ws" | "wss";
  isDev: boolean;
  isProd: boolean;
  hubRunbookSource: RunbookSource;
  sqliteDirPrefix: string;
  stateStorageName: string;
}

const dev: AtuinEnv = {
  hubDomain: "localhost:4000",
  httpProtocol: "http",
  websocketProtocol: "ws",
  isDev: true,
  isProd: false,
  hubRunbookSource: "hub-dev",
  sqliteDirPrefix: "dev_",
  stateStorageName: "atuin-storage-dev",
};

const prod: AtuinEnv = {
  hubDomain: "hub.atuin.sh",
  httpProtocol: "https",
  websocketProtocol: "wss",
  isDev: false,
  isProd: true,
  hubRunbookSource: "hub",
  sqliteDirPrefix: "",
  stateStorageName: "atuin-storage",
};

// Setting a const rather than exporting directly
// helps editors autocomplete `AtuinEnv`
const AtuinEnv: AtuinEnv = import.meta.env.MODE === "production" ? prod : dev;
export default AtuinEnv;

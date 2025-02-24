import { check } from "@tauri-apps/plugin-updater";
import Logger from "@/lib/logger";
import AtuinEnv from "./atuin_env";
import { useStore } from "./state/store";
const logger = new Logger("Updater");

export async function checkForAppUpdates(): Promise<boolean> {
  logger.debug("Checking for updates...");
  const update = await check();

  if (update?.available && AtuinEnv.isProd) {
    logger.info("Update available!");

    useStore.getState().setShowedUpdatePrompt(false);
    useStore.getState().setAvailableUpdate(update);
  } else if (update?.available) {
    logger.info("Update available; suppressing prompt in development mode");
  }

  if (AtuinEnv.isProd) {
    return update?.available ?? false;
  } else {
    return false;
  }
}

import { check } from "@tauri-apps/plugin-updater";
import Logger from "@/lib/logger";
import { useStore } from "./state/store";
import AtuinEnv from "./atuin_env";
import { getGlobalOptions } from "@/lib/global_options";
const logger = new Logger("Updater");

export async function checkForAppUpdates(manualActivation: boolean = false): Promise<boolean> {
  if (getGlobalOptions().os !== "macos") {
    return false;
  }

  logger.debug("Checking for updates...");
  const update = await check();

  if (update?.available) {
    logger.info("Update available!");

    if (!manualActivation && AtuinEnv.isDev) {
      logger.info("Skipping update prompt in dev for automatic checks");
      return false;
    }

    const state = useStore.getState();
    if (manualActivation && state.showedUpdatePrompt) {
      state.setShowedUpdatePrompt(false);
    }
    state.setAvailableUpdate(update);
  }

  return update?.available ?? false;
}

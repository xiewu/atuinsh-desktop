import { check } from "@tauri-apps/plugin-updater";
import Logger from "@/lib/logger";
import { useStore } from "./state/store";
import AtuinEnv from "./atuin_env";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
const logger = new Logger("Updater");

export async function checkForAppUpdates(manualActivation: boolean = false): Promise<boolean> {
  logger.debug("Checking for updates...");
  let update = await check();

  if (update?.available) {
    logger.info("Update available!");

    if (update.body) {
      // Fetch everything after the first instance of "Changelog" (with any heading level)
      let changelog = /\#{1,6}\s*Changelog\n(.*)$/gms.exec(update.body)?.[1] || update.body;
      update.body = micromark(changelog, {
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      });
    } else {
      update.body = "*No changelog available*";
    }

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

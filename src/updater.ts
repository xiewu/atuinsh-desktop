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

    let body = update.body;
    if (body) {
      const index = body.indexOf("## Changelog");
      const changelog = body.slice(index + 12).trim();
      body = micromark(changelog, {
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      });
    } else {
      body = "*No changelog available*";
    }

    update.body = body;

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

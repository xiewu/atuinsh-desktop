import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import Logger from "@/lib/logger";
const logger = new Logger("Updater");

export async function checkForAppUpdates(): Promise<boolean> {
  logger.debug("Checking for updates...");
  const update = await check();

  if (update?.available) {
    logger.info("Update available!");

    const yes = await ask(
      `
${update.version} is available!
        `,
      {
        title: "Update Now!",
        kind: "info",
        okLabel: "Update",
        cancelLabel: "Cancel",
      },
    );

    if (yes) {
      await update.downloadAndInstall();
      await relaunch();
    }
  }

  return update?.available ?? false;
}

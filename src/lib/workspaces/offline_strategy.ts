import Workspace from "@/state/runbooks/workspace";
import WorkspaceStrategy from "./strategy";
import { exists, stat, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, resolve } from "@tauri-apps/api/path";
import { Option, Some, None, Result, Ok, Err } from "@binarymuse/ts-stdlib";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import { uuidv7 } from "uuidv7";
import Runbook from "@/state/runbooks/runbook";
import { createWorkspace, renameWorkspace } from "./commands";

interface WorkspaceFolderError {
  fatal: boolean;
  type: "not_empty" | "not_directory" | "not_exist" | "not_writable" | "is_subdir_of_workspace";
  extra?: string;
}

async function parentDir(folder: string): Promise<Option<string>> {
  const parent = await resolve(folder, "..");
  if (parent === folder) {
    return None;
  }
  return Some(parent);
}

async function findParentWorkspace(folder: string): Promise<Option<string>> {
  try {
    const contents = await readDir(folder);
    if (
      // TODO[mkt]: Check for [workspace] section in the toml file???
      contents.some((file) => file.isFile && file.name.toLowerCase() === "atuin.toml")
    ) {
      return Some(folder);
    }
  } catch (err) {
    // Couldn't read the directory
  }

  const parent = await parentDir(folder);
  if (parent.isSome()) {
    return findParentWorkspace(parent.unwrap());
  }
  return None;
}

async function checkWorkspaceFolder(folder: string): Promise<Option<WorkspaceFolderError>> {
  const doesExist = await exists(folder);
  if (!doesExist) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_exist" });
  }

  const stats = await stat(folder);
  if (!stats.isDirectory) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_directory" });
  }

  try {
    const testfile = "." + uuidv7();
    const testFilePath = await join(folder, testfile);
    await writeTextFile(testFilePath, testfile);
    const contents = await readTextFile(testFilePath);
    await remove(testFilePath);
    if (contents !== testfile) {
      return Some<WorkspaceFolderError>({ fatal: true, type: "not_writable" });
    }
  } catch (err) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_writable" });
  }

  const dirContents = await readDir(folder);
  if (dirContents.length > 0) {
    return Some<WorkspaceFolderError>({
      fatal: false,
      type: "not_empty",
    });
  }

  const parentWorkspace = await findParentWorkspace(folder);
  if (parentWorkspace.isSome()) {
    return Some<WorkspaceFolderError>({
      fatal: false,
      type: "is_subdir_of_workspace",
      extra: parentWorkspace.unwrap(),
    });
  }

  return None;
}

export default class OfflineStrategy implements WorkspaceStrategy {
  async createWorkspace(unsavedWorkspace: Workspace): Promise<Result<Workspace, string>> {
    if (!unsavedWorkspace.get("folder")) {
      throw new Error("You must select a folder to store your workspace locally.");
    }

    const error = await checkWorkspaceFolder(unsavedWorkspace.get("folder")!);
    if (error.isSome()) {
      const type = error.unwrap().type;
      switch (type) {
        case "not_empty":
          const notEmptyAnswer = await new DialogBuilder()
            .title("Selected directory is not empty")
            .icon("warning")
            .message(
              "The selected directory is not empty. Are you sure you want to use it? Any conflicting files will be overwritten.",
            )
            .action({ label: "Cancel", value: "cancel", variant: "flat" })
            .action({ label: "OK", value: "ok", variant: "flat", color: "primary" })
            .build();
          if (notEmptyAnswer === "cancel") {
            return Err("Workspace creation cancelled.");
          }
          break;
        case "is_subdir_of_workspace":
          const dir = error.unwrap().extra!;
          const parentAnswer = await new DialogBuilder()
            .title("Selected path is a subdirectory of a workspace")
            .icon("warning")
            .message(
              `The folder you selected is a subdirectory of an existing workspace (${dir}). Are you sure you want to use your selected folder? Use of the parent workspace may result in files from the new workspace being overwritten.`,
            )
            .action({ label: "Cancel", value: "cancel", variant: "flat" })
            .action({ label: "OK", value: "ok", variant: "flat", color: "primary" })
            .build();
          if (parentAnswer === "cancel") {
            return Err("Workspace creation cancelled.");
          }
          break;
        case "not_directory":
          return Err("Selected path is not a directory.");
        case "not_exist":
          return Err("Selected path does not exist.");
        case "not_writable":
          return Err("Selected path is not writable.");
        default:
          exhaustiveCheck(type);
      }
    }

    try {
      await unsavedWorkspace.save();
    } catch (err) {
      if (err instanceof Error) {
        return Err(err.message);
      } else {
        return Err("An unknown error occurred while saving the workspace.");
      }
    }

    createWorkspace(
      unsavedWorkspace.get("folder")!,
      unsavedWorkspace.get("id")!,
      unsavedWorkspace.get("name")!,
    );
    return Ok(unsavedWorkspace);
  }

  async renameWorkspace(workspace: Workspace, newName: string): Promise<Result<undefined, string>> {
    // Set the workspace name immediately as an "optimistic update."
    // TODO[mkt]: If a FS event comes through before we can flush to disk, the old name may briefly reappear.
    workspace.set("name", newName);
    await workspace.save();

    renameWorkspace(workspace.get("id")!, newName);

    return Ok(undefined);
  }

  async deleteWorkspace(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async createRunbook(
    workspaceId: string,
    parentFolderId: string | null,
  ): Promise<Result<Runbook, string>> {
    return Err("");
  }
}

function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}

import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  useDisclosure,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";

import { useTauriEvent } from "@/lib/tauri";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderInputIcon } from "lucide-react";
import { AtuinState, useStore } from "@/state/store";
import { invoke } from "@tauri-apps/api/core";

type ExportFormat = "atmd" | "atrb";

const DirectoryExportModal = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [directory, setDirectory] = useState<string>("");
  const [matchingFiles, setMatchingFiles] = useState<any[]>([]);
  const [overwriteKeys, setOverwriteKeys] = React.useState(new Set());
  const runbooks = useStore((state: AtuinState) => state.runbooks);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("atrb");

  useTauriEvent("export-workspace-runbook", async () => {
    setExportFormat("atrb");
    onOpen();
  });

  useTauriEvent("export-workspace-markdown", async () => {
    setMatchingFiles([]);
    setExportFormat("atmd");
    onOpen();
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    (async () => {
      const entries = await invoke<any[]>("find_files", {
        path: directory,
        extension: exportFormat,
      });

      // only show files that are in the workspace
      let filteredFiles = entries.filter(
        (entry) => runbooks.find((rb) => `${rb.name}.${exportFormat}` == entry.name) != undefined,
      );

      setMatchingFiles(filteredFiles);
    })();
  }, [directory, isOpen]);

  const handleSync = useCallback(
    async (onClose: () => void): Promise<void> => {
      // Iterate over ALL the runbooks we have in the workspace
      // 1. If there are no conflicts, just export them to the specified path
      // 2. If there are conflicts, follow the strategy selected by the user
      // 3. profit
      for (let rb of runbooks) {
        // If the runbook is already in the directory, and it's not supposed to be overriden, skip
        let exists = matchingFiles.some((item) => item.name == rb.name + ".atmd");

        // Forgive me, for I have sinned (and I cba chasing this type error sorry)
        // There are some parts of the internals of some of these libraries which
        // are a huge pain in the ass to type.
        /// @ts-ignore
        if (
          exists &&
          // @ts-ignore
          overwriteKeys != "all" &&
          !overwriteKeys?.has(rb.name + ".atmd")
        )
          continue;

        let filePath = directory + "/" + rb.name + "." + exportFormat;

        if (exportFormat === "atmd") {
          await rb.exportMarkdown(filePath);
        } else if (exportFormat === "atrb") {
          await rb.export(filePath);
        }
      }

      onClose();
    },
    [exportFormat],
  );

  const selectFolder = async () => {
    const path = await open({
      multiple: false,
      directory: true,
    });

    setDirectory(path || "");
  };

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Export Workspace</ModalHeader>
              <ModalBody>
                <h1 className="text-lg">Export runbooks from the current workspace</h1>
                <div className="flex flex-row">
                  <div className="mr-2">
                    <Button
                      isIconOnly
                      variant="flat"
                      aria-label="Select folder"
                      onPress={selectFolder}
                    >
                      <FolderInputIcon />
                    </Button>
                  </div>

                  <div className="w-full">
                    <Input
                      placeholder="~"
                      value={directory}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck="false"
                      onValueChange={(val) => {
                        setDirectory(val);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Table
                    aria-label="Conflict list"
                    topContent={
                      <h1 className="text-lg font-semibold">Existing files - overwrite?</h1>
                    }
                    selectionMode="multiple"
                    selectedKeys={overwriteKeys as any}
                    onSelectionChange={setOverwriteKeys as any}
                  >
                    <TableHeader>
                      <TableColumn>Name</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {matchingFiles.map((item) => {
                        return (
                          <TableRow key={item.name}>
                            <TableCell>{item.name}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="success" variant="flat" onPress={() => handleSync(onClose)}>
                  Export
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default DirectoryExportModal;

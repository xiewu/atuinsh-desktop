import React, { useState, useEffect } from "react";
import { Select, SelectItem } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";

// Supported shells with their possible paths
export const supportedShells = [
  { id: "bash", name: "bash", paths: ["/bin/bash"], defaultArgs: "-lc", sshArgs: "-l" },
  { id: "zsh", name: "zsh", paths: ["/bin/zsh"], defaultArgs: "-lc", sshArgs: "-l" },
  { id: "fish", name: "fish", paths: ["/usr/bin/fish", "/usr/local/bin/fish", "/opt/homebrew/bin/fish"], defaultArgs: "-c", sshArgs: "" },
  { id: "python3", name: "python3", paths: ["/usr/bin/python3", "/usr/local/bin/python3"], defaultArgs: "-c", sshArgs: "" },
  { id: "node", name: "node", paths: ["/usr/bin/node", "/usr/local/bin/node"], defaultArgs: "-e", sshArgs: "" },
  { id: "sh", name: "sh", paths: ["/bin/sh"], defaultArgs: "-ic", sshArgs: "-i" },
];

// Helper to build interpreter command string
export const buildInterpreterCommand = (interpreterName: string, isSSH = false) => {
  // Find the shell configuration
  const shellConfig = supportedShells.find(s => s.id === interpreterName);

  if (shellConfig) {
    if (isSSH) {
      // For SSH execution
      if (shellConfig.paths[0].startsWith('/bin/')) {
        // Use absolute path for system shells
        return `${shellConfig.paths[0]} ${shellConfig.sshArgs}`.trim();
      } else {
        // Use env for other shells
        return `/usr/bin/env ${shellConfig.id}${shellConfig.sshArgs ? ' ' + shellConfig.sshArgs : ''}`;
      }
    } else {
      // For local execution
      if (shellConfig.paths[0].startsWith('/bin/')) {
        // Use absolute path for system shells
        return `${shellConfig.paths[0]} ${shellConfig.defaultArgs}`.trim();
      } else {
        // Use env for other shells
        return `/usr/bin/env ${shellConfig.id}${shellConfig.defaultArgs ? ' ' + shellConfig.defaultArgs : ''}`;
      }
    }
  }

  // Fallback for unknown shells
  return `/usr/bin/env ${interpreterName}`;
};

interface InterpreterSelectorProps {
  interpreter: string;
  onInterpreterChange: (interpreter: string) => void;
  size?: "sm" | "md" | "lg";
  variant?: "flat" | "bordered" | "underlined" | "faded";
  isSSH?: boolean;
}

const InterpreterSelector: React.FC<InterpreterSelectorProps> = ({ 
  interpreter, 
  onInterpreterChange,
  size = "sm",
  variant = "flat",
}) => {
  // Track available shells
  const [availableShells, setAvailableShells] = useState<Record<string, boolean>>({});
  const [isShellMissing, setIsShellMissing] = useState(false);

  // Check which shells are installed
  useEffect(() => {
    const checkShellsAvailable = async () => {
      try {
        const shellStatus: Record<string, boolean> = {};

        // Check each supported shell
        for (const shell of supportedShells) {
          // Skip bash and sh as they're always available
          if (shell.id === "bash" || shell.id === "sh") {
            shellStatus[shell.id] = true;
            continue;
          }

          // Check each possible path for this shell
          let found = false;
          for (const path of shell.paths) {
            try {
              const exists = await invoke<boolean>("check_binary_exists", { path });
              if (exists) {
                found = true;
                break;
              }
            } catch (e) {
              console.error(`Error checking ${path}:`, e);
            }
          }

          shellStatus[shell.id] = found;
        }

        setAvailableShells(shellStatus);

        // Check if currently selected shell is available
        if (interpreter !== "bash" && interpreter !== "sh") {
          setIsShellMissing(interpreter in shellStatus && !shellStatus[interpreter]);
        } else {
          setIsShellMissing(false);
        }
      } catch (error) {
        console.error("Failed to check available shells:", error);
      }
    };

    checkShellsAvailable();
  }, [interpreter]);

  return (
    <Select
      size={size}
      variant={variant}
      selectionMode="single"
      className="max-w-[250px]"
      selectedKeys={[interpreter]}
      onSelectionChange={(e) => {
        if (!e.currentKey) return;
        onInterpreterChange(e.currentKey as string);
      }}
      aria-label="Select interpreter"
    >
      {supportedShells.map(shell => {
        // Always show bash and sh, or any shell that's available, or the current selected shell
        const shouldShow = shell.id === "bash" ||
          shell.id === "sh" ||
          availableShells[shell.id] ||
          interpreter === shell.id;

        return shouldShow ? (
          <SelectItem 
            key={shell.id} 
            aria-label={shell.name}
            className={interpreter === shell.id && isShellMissing ? "text-red-500" : ""}
          >
            {shell.name}
          </SelectItem>
        ) : null;
      })}
    </Select>
  );
};

export default InterpreterSelector;
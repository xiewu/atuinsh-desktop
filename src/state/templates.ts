// This technically does nothing with state right now, but given the future runbook state I'm working on
// it makes sense for it to go in here

import { normalizeInput } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

import { addToast } from "@heroui/react";

/// Expects the string to template, and the current Blocknote document
export async function templateString(id: string, input: string, doc: any[], runbook: string | null): Promise<string> {
  let normalized = normalizeInput(input);

  try {
    let templated: string = await invoke("template_str", {
      source: normalized,
      blockId: id,
      doc,
      runbook,
    });

    return templated;
  } catch (error) {
    // Show error toast for template parsing errors
    addToast({
      title: "Template Error",
      description: `${error}`,
      color: "danger",
    });
    
    return normalized; // Return original input when template fails
  }
}

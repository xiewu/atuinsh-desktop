// This technically does nothing with state right now, but given the future runbook state I'm working on
// it makes sense for it to go in here

import { normalizeInput } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

/// Expects the string to template, and the current Blocknote document
export async function templateString(id: string, input: string, doc: any[]): Promise<string> {
  let normalized = normalizeInput(input);

  let templated: string = await invoke("template_str", {
    source: normalized,
    blockId: id,
    doc,
  });

  return templated;
}

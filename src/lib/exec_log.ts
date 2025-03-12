import { invoke } from "@tauri-apps/api/core";

export async function logExecution(
  block: any,
  block_type: string,
  startTime: number,
  endTime: number,
  output: string,
) {
  await invoke("log_execution", {
    block: {type: block_type, ...block.object()},
    startTime,
    endTime,
    output,
  });
}

use crate::runtime::blocks::Block;

#[tauri::command]
pub async fn log_execution(
    state: tauri::State<'_, crate::state::AtuinState>,
    block: Block,
    start_time: u64,
    end_time: u64,
    output: String,
) -> Result<(), String> {
    log::debug!("Logging execution for block: {:?}", block);
    state
        .exec_log()
        .log_execution(block, start_time, end_time, output)
        .await
        .map_err(|e| e.to_string())
}

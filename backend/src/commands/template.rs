use std::collections::HashMap;

/// Set a template variable for a runbook
///
/// This stores the variable in the state so it can be accessed by the template engine
#[tauri::command]
pub async fn set_template_var(
    state: tauri::State<'_, crate::state::AtuinState>,
    runbook: String,
    name: String,
    value: String,
) -> Result<(), String> {
    // Store the variable in the state
    state
        .runbook_output_variables
        .write()
        .await
        .entry(runbook)
        .or_insert(HashMap::new())
        .insert(name, value);

    Ok(())
}

/// Get a template variable for a runbook
///
/// This retrieves the variable from the state so it can be accessed by the frontend
#[tauri::command]
pub async fn get_template_var(
    state: tauri::State<'_, crate::state::AtuinState>,
    runbook: String,
    name: String,
) -> Result<Option<String>, String> {
    // Get the variable from the state
    let value = state
        .runbook_output_variables
        .read()
        .await
        .get(&runbook)
        .and_then(|vars| vars.get(&name))
        .cloned();

    Ok(value)
}

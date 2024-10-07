// Handle secrets securely. We use the system keychain for storing
// things like passwords
use crate::state::AtuinState;

use keyring::Entry;

#[tauri::command]
pub async fn save_password(
    state: tauri::State<'_, AtuinState>,
    service: &str,
    user: &str,
    value: &str,
) -> Result<(), String> {
    let entry = Entry::new(service, user).map_err(|e| e.to_string())?;

    entry
        .set_password(value)
        .map_err(|e| e.to_string())
        .map_err(|e| e.to_string())?;

    let mut writer = state.runbooks_api_token.write().await;
    writer.insert(user.to_string(), value.to_string());

    Ok(())
}

#[tauri::command]
pub async fn load_password(
    state: tauri::State<'_, AtuinState>,
    service: &str,
    user: &str,
) -> Result<String, String> {
    {
        let map = state.runbooks_api_token.read().await;

        if map.contains_key(user) {
            println!("using cached secret");
            return Ok(map[user].clone());
        }
    }

    let entry = Entry::new(service, user).map_err(|e| e.to_string())?;
    let pass = entry.get_password().map_err(|e| e.to_string())?;

    let mut writer = state.runbooks_api_token.write().await;
    writer.insert(user.to_string(), pass.clone());

    Ok(pass)
}

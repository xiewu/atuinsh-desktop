use font_kit::{error::SelectionError, source::SystemSource};

#[tauri::command]
pub async fn list_fonts() -> Vec<std::string::String> {
    //Create a system font source
    let source = SystemSource::new();

    // Get all fonts in the system
    let fonts: Result<Vec<String>, SelectionError> = source.all_families();

    fonts.unwrap_or_default()
}

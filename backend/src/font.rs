use font_kit::{error::SelectionError, source::SystemSource};
use std::vec;

#[tauri::command]
pub async fn list_fonts() -> Vec<std::string::String> {
    //Create a system font source
    let source = SystemSource::new();

    // Get all fonts in the system
    let fonts: Result<Vec<String>, SelectionError> = source.all_families();

    //return font
    if let Ok(font) = fonts {
        font
    } else {
        vec![]
    }

    font.unwrap_or_default()
}

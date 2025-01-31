use crate::kv;
use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl};

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub(crate) struct WindowState {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl WindowState {
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width: 1200.0,
            height: 1000.0,
        }
    }
}

fn get_os() -> String {
    if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "linux") {
        "linux".to_string()
    } else {
        "unknown".to_string()
    }
}

pub(crate) async fn create_main_window(app: &AppHandle) -> Result<(), String> {
    let query_string = format!("os={}", get_os());
    let app_url = WebviewUrl::App(format!("index.html?{}", query_string).into());

    let mut builder = WebviewWindowBuilder::new(app, "main", app_url)
        .title("Atuin")
        .resizable(true)
        .fullscreen(false)
        .min_inner_size(500.0, 500.0)
        .visible(false);

    builder = {
        #[cfg(target_os = "macos")]
        {
            builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
        }
        #[cfg(not(target_os = "macos"))]
        {
            builder
        }
    };

    let window = builder.build().unwrap();

    let window_state = load_window_state(app).await.unwrap().unwrap_or_default();

    // For some reason, setting the window positions directly results in different
    // results than passing the values into the builder options.
    window
        .set_size(PhysicalSize::new(window_state.width, window_state.height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(window_state.x, window_state.y))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub(crate) async fn set_window_info(
    app: AppHandle,
    width: f64,
    height: f64,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let window_state = WindowState::new(x, y, width, height);
    save_window_state(&app, window_state).await?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn show_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").unwrap();
    window.show().unwrap();
    window.set_focus().unwrap();
    Ok(())
}

async fn save_window_state(app: &AppHandle, state: WindowState) -> Result<(), String> {
    kv::set(app, "window_state", &state).await
}

async fn load_window_state(app: &AppHandle) -> Result<Option<WindowState>, String> {
    kv::get(app, "window_state").await
}

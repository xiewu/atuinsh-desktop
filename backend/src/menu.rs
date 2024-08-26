use eyre::Result;
use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Runtime,
};

fn update_check<R: Runtime>(handle: &AppHandle<R>) -> Result<MenuItem<R>> {
    let update_check = MenuItemBuilder::new("Check for updates")
        .id("update-check")
        .build(handle)?;

    handle.on_menu_event(move |window, event| {
        if event.id().0 == "update-check" {
            window
                .emit("update-check", 0)
                .expect("Failed to emit menu event");
        }
    });

    Ok(update_check)
}

fn link_menu_item<R: Runtime>(
    id: &str,
    name: &str,
    href: &str,
    handle: &AppHandle<R>,
) -> Result<MenuItem<R>> {
    let link = MenuItemBuilder::new(name).id(id).build(handle)?;

    let href = href.to_string();
    let id = id.to_string();

    handle.on_menu_event(move |_, event| {
        if event.id().0 == id {
            // Failing to open a link sucks but let's not error
            let _ = open::that(&href);
        }
    });

    Ok(link)
}

pub fn menu<R: Runtime>(app_handle: &AppHandle<R>) -> Result<Menu<R>> {
    // Totally just ripped the default menu from the Tauri source, and edited
    // Easier than screwing around with the API 🤫
    let pkg_info = app_handle.package_info();
    let config = app_handle.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|p| vec![p]),
        ..Default::default()
    };

    let window_menu = Submenu::with_id_and_items(
        app_handle,
        "window_menu",
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app_handle, None)?,
            &PredefinedMenuItem::maximize(app_handle, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::close_window(app_handle, None)?,
        ],
    )?;

    let help_menu = Submenu::with_id_and_items(
        app_handle,
        "help_menu",
        "Help",
        true,
        &[
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
            &link_menu_item(
                "twitter",
                "Atuin Twitter",
                "https://x.com/atuinsh",
                app_handle,
            )?,
            &link_menu_item(
                "mastodon",
                "Atuin Mastodon",
                "https://hachyderm.io/@atuin",
                app_handle,
            )?,
        ],
    )?;

    let menu = Menu::with_items(
        app_handle,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app_handle,
                pkg_info.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
                    &update_check(app_handle)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::services(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::hide(app_handle, None)?,
                    &PredefinedMenuItem::hide_others(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::quit(app_handle, None)?,
                ],
            )?,
            #[cfg(not(any(
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            )))]
            &Submenu::with_items(
                app_handle,
                "File",
                true,
                &[
                    &PredefinedMenuItem::close_window(app_handle, None)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app_handle, None)?,
                ],
            )?,
            &Submenu::with_items(
                app_handle,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app_handle, None)?,
                    &PredefinedMenuItem::redo(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::cut(app_handle, None)?,
                    &PredefinedMenuItem::copy(app_handle, None)?,
                    &PredefinedMenuItem::paste(app_handle, None)?,
                    &PredefinedMenuItem::select_all(app_handle, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app_handle,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app_handle, None)?],
            )?,
            &window_menu,
            &help_menu,
        ],
    )?;

    Ok(menu)
}

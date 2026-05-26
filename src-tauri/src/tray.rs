use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let rest_now = MenuItem::with_id(app, "rest_now", "立即休息", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&rest_now, &settings, &quit])?;

    let icon = tauri::image::Image::from_path(
        app.path().resource_dir().unwrap().join("tray-icon.png")
    ).unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "settings" => {
                open_settings_window(app);
            }
            "rest_now" => {
                let _ = app.emit("force-rest", serde_json::json!({}));
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
            // Left click: toggle show/hide pet window
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("pet") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn open_settings_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let _ = tauri::WebviewWindowBuilder::new(
        app,
        "settings",
        tauri::WebviewUrl::App("/#/settings".into()),
    )
    .title("设置 - Desktop Cat")
    .inner_size(480.0, 560.0)
    .resizable(false)
    .center()
    .build();
}

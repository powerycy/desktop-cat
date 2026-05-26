use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use crate::timer::TimerState;

#[tauri::command]
pub fn create_rest_window(app: AppHandle, mode: String, duration: u64) -> Result<(), String> {
    let url = format!("/#/rest?mode={}&duration={}", mode, duration);

    // Close existing rest window if any, then rebuild with correct URL
    if let Some(existing) = app.get_webview_window("rest") {
        let _ = existing.close();
    }

    let window = tauri::WebviewWindowBuilder::new(
        &app,
        "rest",
        tauri::WebviewUrl::App(url.into()),
    )
    .fullscreen(true)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    // Safety net: if the rest window is destroyed for ANY reason, reset timer state.
    let app_clone = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            let timer_state = app_clone.state::<Arc<Mutex<TimerState>>>();
            let was_resting = {
                let s = timer_state.lock().unwrap();
                s.is_resting
            };
            if was_resting {
                {
                    let mut s = timer_state.lock().unwrap();
                    s.is_resting = false;
                    s.elapsed_seconds = 0;
                }
                let _ = app_clone.emit("rest-end", serde_json::json!({}));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn close_rest_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("rest") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_pet_position(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pet") {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: x as i32,
                y: y as i32,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_cursor_passthrough(app: AppHandle, ignore: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pet") {
        window
            .set_ignore_cursor_events(ignore)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

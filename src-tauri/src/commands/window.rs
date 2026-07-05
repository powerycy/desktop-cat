use crate::timer::TimerState;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

fn current_desktop_bounds(app: &AppHandle) -> Result<(f64, f64, f64, f64), String> {
    let monitor = app
        .get_webview_window("pet")
        .and_then(|window| window.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor available".to_string())?;

    let scale = monitor.scale_factor();
    let size = monitor.size();
    let position = monitor.position();

    Ok((
        position.x as f64 / scale,
        position.y as f64 / scale,
        size.width as f64 / scale,
        size.height as f64 / scale,
    ))
}

#[tauri::command]
pub fn create_rest_window(
    app: AppHandle,
    mode: String,
    duration: u64,
    forced: bool,
) -> Result<(), String> {
    let url = format!(
        "/#/rest?mode={}&duration={}&forced={}",
        mode, duration, forced
    );

    // Close existing rest window if any, then rebuild with correct URL
    if let Some(existing) = app.get_webview_window("rest") {
        let _ = existing.close();
    }

    let (x, y, width, height) = current_desktop_bounds(&app)?;
    let window = tauri::WebviewWindowBuilder::new(&app, "rest", tauri::WebviewUrl::App(url.into()))
        .position(x, y)
        .inner_size(width, height)
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
                    s.awaiting_break_decision = false;
                    s.elapsed_seconds = 0;
                }
                let _ = app_clone.emit(
                    "rest-end",
                    serde_json::json!({
                        "reason": "interrupted",
                    }),
                );
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

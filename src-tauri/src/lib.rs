mod commands;
mod config;
mod timer;
mod tray;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Listener, Manager};
use tauri_plugin_store::StoreExt;
use timer::TimerState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("pet") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            tray::setup_tray(app.handle())?;

            // Load config to get timer settings
            let handle = app.handle().clone();
            let store = handle
                .store("config.json")
                .unwrap_or_else(|_| handle.store("config.json").unwrap());
            let work_minutes = store
                .get("work_interval_minutes")
                .and_then(|v| v.as_u64())
                .unwrap_or(45);
            let rest_minutes = store
                .get("rest_duration_minutes")
                .and_then(|v| v.as_u64())
                .unwrap_or(5);
            let rest_mode = store
                .get("rest_mode")
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| "A".to_string());

            let timer_state = Arc::new(Mutex::new(TimerState::new(work_minutes, rest_minutes)));
            app.manage(timer_state.clone());
            let timer_state_clone = timer_state.clone();

            // Listen for rest-start to open rest window
            let handle_for_rest = app.handle().clone();
            app.listen("rest-start", move |event| {
                if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                    let mode = payload["mode"].as_str().unwrap_or("A").to_string();
                    let duration = payload["duration"].as_u64().unwrap_or(300);
                    let forced = payload["forced"].as_bool().unwrap_or(false);
                    let _ = commands::window::create_rest_window(
                        handle_for_rest.clone(),
                        mode,
                        duration,
                        forced,
                    );
                }
            });

            // Listen for rest-end to close rest window and reset timer
            let handle_for_end = app.handle().clone();
            let timer_state_end = timer_state.clone();
            app.listen("rest-end", move |_event| {
                {
                    let mut s = timer_state_end.lock().unwrap();
                    s.is_resting = false;
                    s.awaiting_break_decision = false;
                    s.elapsed_seconds = 0;
                }
                let _ = commands::window::close_rest_window(handle_for_end.clone());
            });

            // Listen for force-rest from tray menu
            let handle_for_force = app.handle().clone();
            let rest_mode_clone = rest_mode.clone();
            let timer_state_force = timer_state.clone();
            app.listen("force-rest", move |event| {
                let forced = serde_json::from_str::<serde_json::Value>(event.payload())
                    .ok()
                    .and_then(|payload| payload["forced"].as_bool())
                    .unwrap_or(false);
                let rest_duration = {
                    let mut s = timer_state_force.lock().unwrap();
                    // Mark as resting so the background timer doesn't double-trigger rest-start
                    s.is_resting = true;
                    s.awaiting_break_decision = false;
                    s.elapsed_seconds = 0;
                    s.rest_duration_seconds
                };
                let _ = handle_for_force.emit(
                    "rest-start",
                    serde_json::json!({
                        "mode": rest_mode_clone,
                        "duration": rest_duration,
                        "forced": forced,
                    }),
                );
            });

            // Start background timer
            timer::start_timer(app.handle().clone(), timer_state_clone, rest_mode);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::save_config,
            commands::window::create_rest_window,
            commands::window::close_rest_window,
            commands::window::set_pet_position,
            commands::window::set_cursor_passthrough,
            commands::pet::get_sprite_sets,
            commands::pet::get_sprite_dir,
            commands::pet::import_sprite_set,
            commands::pet::generate_ai_sprite_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

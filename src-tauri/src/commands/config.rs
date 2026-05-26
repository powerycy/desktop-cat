use crate::config::AppConfig;
use crate::timer::TimerState;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "config.json";

#[tauri::command]
pub fn get_config(app: AppHandle) -> Result<AppConfig, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;

    let config = AppConfig {
        work_interval_minutes: store.get("work_interval_minutes")
            .and_then(|v| v.as_u64())
            .unwrap_or(45),
        rest_duration_minutes: store.get("rest_duration_minutes")
            .and_then(|v| v.as_u64())
            .unwrap_or(5),
        rest_mode: store.get("rest_mode")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "A".to_string()),
        active_sprite_set: store.get("active_sprite_set")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "default-cat".to_string()),
        autostart: store.get("autostart")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        pet_scale: store.get("pet_scale")
            .and_then(|v| v.as_f64())
            .unwrap_or(1.0),
    };

    Ok(config)
}

#[tauri::command]
pub fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    // Ensure app_data_dir exists before the store plugin tries to write into it.
    // On a fresh install %APPDATA%/<identifier>/ may not exist yet, which
    // causes store.save() to fail with "系统找不到指定的文件 (os error 2)".
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&dir);
    }

    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;

    store.set("work_interval_minutes", config.work_interval_minutes);
    store.set("rest_duration_minutes", config.rest_duration_minutes);
    store.set("rest_mode", &*config.rest_mode);
    store.set("active_sprite_set", &*config.active_sprite_set);
    store.set("autostart", config.autostart);
    store.set("pet_scale", config.pet_scale);
    store.save().map_err(|e| format!("保存配置失败: {}", e))?;

    // Sync autostart with the OS registry. Don't fail the whole save if this
    // step errors (e.g. the user lacks permission) — the config has already
    // been persisted and that's the user-visible action.
    let autostart_manager = app.autolaunch();
    let _ = if config.autostart {
        autostart_manager.enable()
    } else {
        autostart_manager.disable()
    };

    // Hot-update the running timer so changes take effect without restart
    if let Ok(timer_state) = app.try_state::<Arc<Mutex<TimerState>>>().ok_or("no state") {
        let mut s = timer_state.lock().unwrap();
        s.work_interval_seconds = config.work_interval_minutes * 60;
        s.rest_duration_seconds = config.rest_duration_minutes * 60;
        // Reset elapsed so the new interval starts fresh
        if !s.is_resting {
            s.elapsed_seconds = 0;
        }
    }

    Ok(())
}

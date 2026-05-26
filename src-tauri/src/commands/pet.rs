use base64::{engine::general_purpose, Engine as _};
use std::fs;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn get_sprite_sets(app: AppHandle) -> Result<Vec<String>, String> {
    let mut sets: Vec<String> = vec![];

    // Scan all possible sprite directories
    let dirs_to_scan = vec![
        // Production user-imported: app_data_dir/sprites/
        app.path().app_data_dir().ok().map(|p| p.join("sprites")),
        // Production bundled: resource_dir/sprites/
        app.path().resource_dir().ok().map(|p| p.join("sprites")),
        // Dev: CARGO_MANIFEST_DIR/resources/sprites/
        Some(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources").join("sprites")),
    ];

    let mut seen = std::collections::HashSet::new();
    for dir in dirs_to_scan.into_iter().flatten() {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            if seen.insert(name.to_string()) {
                                sets.push(name.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(sets)
}

#[tauri::command]
pub fn get_sprite_dir(app: AppHandle, set_name: String) -> Result<String, String> {
    // Custom sprites: check user data dir → bundled resources → dev path
    if let Ok(app_data) = app.path().app_data_dir() {
        let p = app_data.join("sprites").join(&set_name);
        if p.exists() {
            return Ok(p.to_string_lossy().replace('\\', "/"));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("sprites").join(&set_name);
        if p.exists() {
            return Ok(p.to_string_lossy().replace('\\', "/"));
        }
    }

    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources").join("sprites").join(&set_name);
    if dev_path.exists() {
        return Ok(dev_path.to_string_lossy().replace('\\', "/"));
    }

    Err(format!("Sprite set not found: {}", set_name))
}

#[derive(serde::Deserialize)]
pub struct SpriteFile {
    pub name: String, // e.g. "idle_01.png"
    pub data: String, // base64-encoded PNG content
}

/// Import a custom sprite set. In production it is saved under
/// `app_data_dir/sprites/<set_name>/` (writable per-user location).
/// In dev mode it falls back to `CARGO_MANIFEST_DIR/resources/sprites/`.
/// Generates manifest.json based on uploaded file names.
/// Only individual frame files are supported: <action>_01.png, <action>_02.png, etc.
#[tauri::command]
pub fn import_sprite_set(
    app: AppHandle,
    set_name: String,
    files: Vec<SpriteFile>,
) -> Result<(), String> {
    if set_name.is_empty() || set_name == "default-cat" {
        return Err("Invalid set name".to_string());
    }
    if !set_name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c > '\x7f') {
        return Err("Set name must only contain letters, numbers, - or _".to_string());
    }

    // Choose a writable base directory. Prefer app_data_dir (works in production
    // and is per-user). Fall back to dev resources/sprites/ when running tauri dev.
    let sprites_base = match app.path().app_data_dir() {
        Ok(p) => p.join("sprites"),
        Err(_) => std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("sprites"),
    };
    fs::create_dir_all(&sprites_base)
        .map_err(|e| format!("Failed to create sprites dir {}: {}", sprites_base.display(), e))?;

    let set_dir = sprites_base.join(&set_name);
    fs::create_dir_all(&set_dir)
        .map_err(|e| format!("Failed to create set dir {}: {}", set_dir.display(), e))?;

    // action → list of individual frame file names (sorted)
    let mut frame_files: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();

    for file in &files {
        let safe_name = std::path::Path::new(&file.name)
            .file_name()
            .ok_or("Bad file name")?
            .to_string_lossy()
            .to_string();

        let bytes = general_purpose::STANDARD
            .decode(&file.data)
            .map_err(|e| format!("Base64 error for {}: {}", safe_name, e))?;

        fs::write(set_dir.join(&safe_name), &bytes)
            .map_err(|e| format!("Failed to write {}: {}", safe_name, e))?;

        let lower = safe_name.to_lowercase();
        if lower.ends_with(".png") {
            // Individual frame: <action>_NN.png  e.g. walk_01.png, sneak_03.png
            if let Some(pos) = lower.rfind('_') {
                let action = lower[..pos].to_string();
                frame_files.entry(action).or_default().push(safe_name);
            }
        }
    }

    // Sort individual frame lists
    for v in frame_files.values_mut() {
        v.sort();
    }

    // Build manifest JSON — frame count is simply the length of each action's file list
    let mut manifest = serde_json::Map::new();

    let known_actions = [
        "idle", "walk", "sit", "sit_idle", "sleep",
        "sneak", "liedown", "rest", "interact",
    ];

    for action in &known_actions {
        let key = action.to_string();
        if let Some(frames) = frame_files.get(&key) {
            manifest.insert(key, serde_json::json!(frames));
        }
    }

    fs::write(
        set_dir.join("manifest.json"),
        serde_json::to_string_pretty(&serde_json::Value::Object(manifest)).unwrap(),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

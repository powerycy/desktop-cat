use base64::{engine::general_purpose, Engine as _};
use image::{GenericImageView, ImageFormat, Rgba, RgbaImage};
use reqwest::StatusCode;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const GEMINI_IMAGE_MODEL: &str = "gemini-3.1-flash-image";
const GENERATED_FRAME_CANVAS: u32 = 372;
const GENERATED_SPRITE_GRID_COLUMNS: u32 = 3;
const GENERATED_SPRITE_GRID_ROWS: u32 = 3;

fn is_removed_sprite_set(name: &str) -> bool {
    name == "default-cat"
}

#[tauri::command]
pub fn get_sprite_sets(app: AppHandle) -> Result<Vec<String>, String> {
    let mut sets: Vec<String> = vec![];

    // Scan all possible sprite directories
    let dirs_to_scan = vec![
        // Production user-imported: app_data_dir/sprites/
        app.path().app_data_dir().ok().map(|p| p.join("sprites")),
        // Production bundled: resource_dir/sprites/
        app.path().resource_dir().ok().map(|p| p.join("sprites")),
        // Production bundled presets: resource_dir/presets/
        app.path().resource_dir().ok().map(|p| p.join("presets")),
        // Dev: CARGO_MANIFEST_DIR/resources/sprites/
        Some(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("sprites"),
        ),
        // Dev: CARGO_MANIFEST_DIR/resources/presets/
        Some(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("presets"),
        ),
    ];

    let mut seen = std::collections::HashSet::new();
    for dir in dirs_to_scan.into_iter().flatten() {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            if is_removed_sprite_set(name) {
                                continue;
                            }
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
    if is_removed_sprite_set(&set_name) {
        return Err(format!("Sprite set removed: {}", set_name));
    }

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
        let preset = resource_dir.join("presets").join(&set_name);
        if preset.exists() {
            return Ok(preset.to_string_lossy().replace('\\', "/"));
        }
    }

    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("sprites")
        .join(&set_name);
    if dev_path.exists() {
        return Ok(dev_path.to_string_lossy().replace('\\', "/"));
    }

    let dev_preset_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("presets")
        .join(&set_name);
    if dev_preset_path.exists() {
        return Ok(dev_preset_path.to_string_lossy().replace('\\', "/"));
    }

    Err(format!("Sprite set not found: {}", set_name))
}

#[derive(serde::Deserialize)]
pub struct SpriteFile {
    pub name: String, // e.g. "idle_01.png"
    pub data: String, // base64-encoded PNG content
}

#[derive(serde::Deserialize)]
pub struct GenerateAiSpriteRequest {
    pub api_key: String,
    pub set_name: String,
    pub prompt: String,
}

#[derive(serde::Serialize)]
pub struct GenerateAiSpriteResponse {
    pub set_name: String,
}

#[derive(serde::Deserialize)]
struct GeminiImageBlock {
    data: String,
    #[allow(dead_code)]
    mime_type: Option<String>,
}

#[derive(serde::Deserialize)]
struct GeminiContentBlock {
    #[serde(rename = "type")]
    block_type: Option<String>,
    data: Option<String>,
    #[allow(dead_code)]
    mime_type: Option<String>,
}

#[derive(serde::Deserialize)]
struct GeminiStep {
    content: Option<Vec<GeminiContentBlock>>,
    summary: Option<Vec<GeminiContentBlock>>,
}

#[derive(serde::Deserialize)]
struct GeminiError {
    message: Option<String>,
}

#[derive(serde::Deserialize)]
struct GeminiInteractionResponse {
    output_image: Option<GeminiImageBlock>,
    steps: Option<Vec<GeminiStep>>,
    error: Option<GeminiError>,
}

fn action_from_file_name(file_name: &str) -> Option<String> {
    let stem = std::path::Path::new(file_name)
        .file_stem()?
        .to_string_lossy()
        .to_string();

    let trimmed = stem
        .trim_end_matches(|c: char| c.is_ascii_digit())
        .trim_end_matches(|c: char| c == '_' || c == '-' || c.is_whitespace())
        .to_lowercase();

    let action = match trimmed.as_str() {
        "idle" | "待机" => "idle",
        "walk" | "walking" | "行走" | "走路" | "移动" => "walk",
        "sit" | "sitting" | "坐下" | "坐姿" | "坐着" => "sit",
        "sit_idle" | "sit-idle" | "sitting_idle" | "坐姿待机" | "坐着待机" => "sit",
        "sleep" | "sleeping" | "睡觉" | "睡眠" => "sleep",
        "liedown" | "lie_down" | "lie-down" | "趴下" | "躺下" => "liedown",
        "rest" | "break" | "休息" | "休息中" => "rest",
        "interact" | "interaction" | "互动" => "interact",
        _ => return None,
    };

    Some(action.to_string())
}

fn ensure_valid_sprite_set_name(set_name: &str) -> Result<(), String> {
    if set_name.is_empty() || set_name == "default-cat" {
        return Err("Invalid set name".to_string());
    }
    if !set_name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c > '\x7f')
    {
        return Err("Set name must only contain letters, numbers, - or _".to_string());
    }
    Ok(())
}

fn writable_sprites_base(app: &AppHandle) -> PathBuf {
    match app.path().app_data_dir() {
        Ok(p) => p.join("sprites"),
        Err(_) => PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("sprites"),
    }
}

fn build_ai_sprite_prompt(user_prompt: &str) -> String {
    format!(
        "Create one production-ready transparent background pixel-art sprite sheet for a desktop pet. \
Use the user's idea as the character direction, then complete the missing professional animation details yourself. \
User character idea: {}\n\n\
Canvas and layout rules:\n\
- Single square PNG, transparent background, no environment, no props that obscure the pet.\n\
- Clean 3x3 grid of equal square panels, with no visible grid lines and no labels.\n\
- Panel order, left to right and top to bottom: walk_01, walk_02, walk_03, sit_01, sit_02, sleep_01, rest_01, rest_02, empty transparent spare panel.\n\n\
Animation rules:\n\
- walking: three frames facing right, readable walking loop, small leg/body offsets only.\n\
- sitting: two frames, seated pose with subtle breathing, tail or ear movement; do not scale the whole body between frames.\n\
- sleeping: one calm sleeping frame, same character and visually centered like the other actions.\n\
- resting: two relaxed break frames suitable for a full-screen rest overlay, calm looping motion.\n\n\
Sprite quality rules:\n\
- Keep the same character design, colors, silhouette, costume, proportions, and art style in every panel.\n\
- Character should fill most of each panel, with minimal transparent padding, but never crop head, feet, ears, or tail.\n\
- Keep the visible pet at the visual center of each panel so switching actions does not jump up, down, or feel off-center.\n\
- Crisp readable silhouette, consistent scale, centered horizontally, front/side view suitable for a desktop pet.\n\
- Do not add text, labels, captions, UI, borders, watermarks, shadows outside the character, extra characters, or background scenery.",
        user_prompt.trim()
    )
}

fn extract_generated_image(response: GeminiInteractionResponse) -> Result<Vec<u8>, String> {
    if let Some(error) = response.error {
        return Err(error
            .message
            .unwrap_or_else(|| "Gemini image generation failed".to_string()));
    }

    if let Some(image) = response.output_image {
        return general_purpose::STANDARD
            .decode(image.data)
            .map_err(|e| format!("Gemini returned invalid image data: {}", e));
    }

    for step in response.steps.unwrap_or_default() {
        let blocks = step
            .content
            .into_iter()
            .flatten()
            .chain(step.summary.into_iter().flatten());
        for block in blocks {
            if block.block_type.as_deref() == Some("image") {
                if let Some(data) = block.data {
                    return general_purpose::STANDARD
                        .decode(data)
                        .map_err(|e| format!("Gemini returned invalid image data: {}", e));
                }
            }
        }
    }

    Err("Gemini did not return an image. Try a clearer character description.".to_string())
}

fn alpha_bounds(image: &RgbaImage) -> Option<(u32, u32, u32, u32)> {
    let mut min_x = image.width();
    let mut min_y = image.height();
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found = false;

    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] > 0 {
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x + 1);
            max_y = max_y.max(y + 1);
            found = true;
        }
    }

    found.then_some((min_x, min_y, max_x, max_y))
}

fn normalize_generated_frame(frame: RgbaImage) -> Result<RgbaImage, String> {
    let (min_x, min_y, max_x, max_y) =
        alpha_bounds(&frame).ok_or_else(|| "Generated frame is empty".to_string())?;
    let art_width = max_x - min_x;
    let art_height = max_y - min_y;
    if art_width > GENERATED_FRAME_CANVAS || art_height > GENERATED_FRAME_CANVAS {
        return Err("Generated frame is too large after trimming".to_string());
    }

    let art = image::imageops::crop_imm(&frame, min_x, min_y, art_width, art_height).to_image();
    let mut canvas = RgbaImage::from_pixel(
        GENERATED_FRAME_CANVAS,
        GENERATED_FRAME_CANVAS,
        Rgba([255, 255, 255, 0]),
    );
    let x = (GENERATED_FRAME_CANVAS - art_width) / 2;
    let y = (GENERATED_FRAME_CANVAS - art_height) / 2;
    image::imageops::overlay(&mut canvas, &art, x.into(), y.into());
    Ok(canvas)
}

fn write_generated_sprite_set(set_dir: &Path, image_bytes: &[u8]) -> Result<(), String> {
    fs::create_dir_all(set_dir).map_err(|e| {
        format!(
            "Failed to create generated sprite dir {}: {}",
            set_dir.display(),
            e
        )
    })?;

    let source = image::load_from_memory(image_bytes)
        .map_err(|e| format!("Gemini returned an unreadable image: {}", e))?;
    let (width, height) = source.dimensions();
    if width < 2 || height < 2 {
        return Err("Generated image is too small to split into actions".to_string());
    }

    let source_png = source.to_rgba8();
    source_png
        .save_with_format(set_dir.join("source.png"), ImageFormat::Png)
        .map_err(|e| format!("Failed to save source image: {}", e))?;

    let frame_width = width / GENERATED_SPRITE_GRID_COLUMNS;
    let frame_height = height / GENERATED_SPRITE_GRID_ROWS;
    let actions = [
        ("walk_01.png", 0, 0),
        ("walk_02.png", 1, 0),
        ("walk_03.png", 2, 0),
        ("sit_01.png", 0, 1),
        ("sit_02.png", 1, 1),
        ("sleep_01.png", 2, 1),
        ("rest_01.png", 0, 2),
        ("rest_02.png", 1, 2),
    ];

    for (file_name, col, row) in actions {
        let x = col * frame_width;
        let y = row * frame_height;
        let frame = source.crop_imm(x, y, frame_width, frame_height).to_rgba8();
        let frame = normalize_generated_frame(frame)?;
        let mut encoded = Vec::new();
        frame
            .write_to(&mut Cursor::new(&mut encoded), ImageFormat::Png)
            .map_err(|e| format!("Failed to encode {}: {}", file_name, e))?;
        fs::write(set_dir.join(file_name), encoded)
            .map_err(|e| format!("Failed to write {}: {}", file_name, e))?;
    }

    let manifest = serde_json::json!({
        "walk": ["walk_01.png", "walk_02.png", "walk_03.png"],
        "sit": ["sit_01.png", "sit_02.png"],
        "sleep": ["sleep_01.png"],
        "rest": ["rest_01.png", "rest_02.png"]
    });

    fs::write(
        set_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn generate_ai_sprite_set(
    app: AppHandle,
    request: GenerateAiSpriteRequest,
) -> Result<GenerateAiSpriteResponse, String> {
    let api_key = request.api_key.trim();
    if api_key.is_empty() {
        return Err("Gemini API Key is required".to_string());
    }

    let set_name = request.set_name.trim().to_string();
    ensure_valid_sprite_set_name(&set_name)?;

    let prompt = request.prompt.trim();
    if prompt.is_empty() {
        return Err("Describe the character first".to_string());
    }

    let body = serde_json::json!({
        "model": GEMINI_IMAGE_MODEL,
        "input": [
            {
                "type": "text",
                "text": build_ai_sprite_prompt(prompt)
            }
        ],
        "response_format": {
            "type": "image",
            "mime_type": "image/png",
            "aspect_ratio": "1:1"
        }
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://generativelanguage.googleapis.com/v1beta/interactions")
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Gemini response: {}", e))?;

    if status != StatusCode::OK {
        return Err(format!("Gemini request failed ({}): {}", status, text));
    }

    let parsed: GeminiInteractionResponse =
        serde_json::from_str(&text).map_err(|e| format!("Unexpected Gemini response: {}", e))?;
    let image = extract_generated_image(parsed)?;

    let sprites_base = writable_sprites_base(&app);
    fs::create_dir_all(&sprites_base).map_err(|e| {
        format!(
            "Failed to create sprites dir {}: {}",
            sprites_base.display(),
            e
        )
    })?;

    let set_dir = sprites_base.join(&set_name);
    write_generated_sprite_set(&set_dir, &image)?;

    Ok(GenerateAiSpriteResponse { set_name })
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
    ensure_valid_sprite_set_name(&set_name)?;

    // Choose a writable base directory. Prefer app_data_dir (works in production
    // and is per-user). Fall back to dev resources/sprites/ when running tauri dev.
    let sprites_base = writable_sprites_base(&app);
    fs::create_dir_all(&sprites_base).map_err(|e| {
        format!(
            "Failed to create sprites dir {}: {}",
            sprites_base.display(),
            e
        )
    })?;

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
            // Individual frame: <action>_NN.png, <action>-NN.png, <中文动作>NN.png, etc.
            if let Some(action) = action_from_file_name(&safe_name) {
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
        "idle", "walk", "sit", "sleep", "liedown", "rest", "interact",
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

#[cfg(test)]
mod tests {
    use super::{
        action_from_file_name, alpha_bounds, build_ai_sprite_prompt, is_removed_sprite_set,
        normalize_generated_frame, write_generated_sprite_set, GENERATED_FRAME_CANVAS,
    };
    use image::{Rgba, RgbaImage};
    use std::{fs, io::Cursor};

    #[test]
    fn recognizes_chinese_required_action_names() {
        assert_eq!(
            action_from_file_name("行走_01.png").as_deref(),
            Some("walk")
        );
        assert_eq!(action_from_file_name("坐姿_01.png").as_deref(), Some("sit"));
        assert_eq!(
            action_from_file_name("睡觉_01.png").as_deref(),
            Some("sleep")
        );
        assert_eq!(
            action_from_file_name("休息_01.png").as_deref(),
            Some("rest")
        );
    }

    #[test]
    fn maps_legacy_sitting_idle_names_to_sitting() {
        assert_eq!(
            action_from_file_name("sit_idle_01.png").as_deref(),
            Some("sit")
        );
        assert_eq!(
            action_from_file_name("坐姿待机_01.png").as_deref(),
            Some("sit")
        );
    }

    #[test]
    fn does_not_recognize_entry_or_sneak_actions() {
        assert_eq!(action_from_file_name("入场_01.png"), None);
        assert_eq!(action_from_file_name("entry_01.png"), None);
        assert_eq!(action_from_file_name("sneak_01.png"), None);
    }

    #[test]
    fn excludes_removed_default_cat_sprite_set() {
        assert!(is_removed_sprite_set("default-cat"));
        assert!(!is_removed_sprite_set("暴躁喵"));
    }

    #[test]
    fn ai_sprite_prompt_requests_the_four_required_actions() {
        let prompt = build_ai_sprite_prompt("a grumpy but cute pixel cat");
        assert!(prompt.contains("walking"));
        assert!(prompt.contains("sitting"));
        assert!(prompt.contains("sleeping"));
        assert!(prompt.contains("resting"));
        assert!(prompt.contains("3x3 grid"));
    }

    #[test]
    fn ai_sprite_prompt_wraps_simple_user_text_with_production_rules() {
        let prompt = build_ai_sprite_prompt("搞笑的橘猫程序员");

        assert!(prompt.contains("User character idea: 搞笑的橘猫程序员"));
        assert!(prompt.contains("walk_01, walk_02, walk_03"));
        assert!(prompt.contains("sit_01, sit_02"));
        assert!(prompt.contains("sleep_01"));
        assert!(prompt.contains("rest_01, rest_02"));
        assert!(prompt.contains("transparent background"));
        assert!(prompt.contains("visual center"));
        assert!(prompt.contains("Do not add text"));
        assert!(prompt.contains("same character design"));
        assert!(prompt.contains("fill most of each panel"));
    }

    #[test]
    fn generated_sprite_sheet_splits_into_mature_animation_frames() {
        let mut sheet = RgbaImage::from_pixel(900, 900, Rgba([255, 255, 255, 0]));
        for row in 0..3 {
            for col in 0..3 {
                for y in 80..260 {
                    for x in 90..250 {
                        sheet.put_pixel(
                            col * 300 + x,
                            row * 300 + y,
                            Rgba([40 * (row + 1) as u8, 30 * (col + 1) as u8, 180, 255]),
                        );
                    }
                }
            }
        }

        let mut encoded = Vec::new();
        sheet
            .write_to(&mut Cursor::new(&mut encoded), image::ImageFormat::Png)
            .unwrap();

        let dir =
            std::env::temp_dir().join(format!("desktop-cat-ai-sprite-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);

        write_generated_sprite_set(&dir, &encoded).unwrap();
        let manifest: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.join("manifest.json")).unwrap()).unwrap();

        assert_eq!(
            manifest["walk"],
            serde_json::json!(["walk_01.png", "walk_02.png", "walk_03.png"])
        );
        assert_eq!(
            manifest["sit"],
            serde_json::json!(["sit_01.png", "sit_02.png"])
        );
        assert_eq!(manifest["sleep"], serde_json::json!(["sleep_01.png"]));
        assert_eq!(
            manifest["rest"],
            serde_json::json!(["rest_01.png", "rest_02.png"])
        );
        for file in [
            "walk_01.png",
            "walk_02.png",
            "walk_03.png",
            "sit_01.png",
            "sit_02.png",
            "sleep_01.png",
            "rest_01.png",
            "rest_02.png",
        ] {
            assert!(dir.join(file).exists(), "{} should be written", file);
        }

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn normalizes_generated_frames_to_a_compact_centered_canvas() {
        let mut frame = RgbaImage::from_pixel(800, 800, Rgba([255, 255, 255, 0]));
        for y in 300..560 {
            for x in 260..540 {
                frame.put_pixel(x, y, Rgba([255, 128, 0, 255]));
            }
        }

        let normalized = normalize_generated_frame(frame).unwrap();
        let bounds = alpha_bounds(&normalized).unwrap();

        assert_eq!(normalized.width(), GENERATED_FRAME_CANVAS);
        assert_eq!(normalized.height(), GENERATED_FRAME_CANVAS);
        assert!(((bounds.0 + bounds.2) as i32 - GENERATED_FRAME_CANVAS as i32).abs() <= 1);
        assert!(((bounds.1 + bounds.3) as i32 - GENERATED_FRAME_CANVAS as i32).abs() <= 1);
        assert!(bounds.2 - bounds.0 > GENERATED_FRAME_CANVAS * 2 / 3);
    }
}

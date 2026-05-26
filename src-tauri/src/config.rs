use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Work interval in minutes before rest reminder
    pub work_interval_minutes: u64,
    /// Rest duration in minutes
    pub rest_duration_minutes: u64,
    /// Rest overlay mode: "A" (fullscreen cat chaos) or "B" (semi-transparent overlay)
    pub rest_mode: String,
    /// Active sprite set name (folder name under presets/)
    pub active_sprite_set: String,
    /// Launch at system startup
    pub autostart: bool,
    /// Pet window scale factor (1.0 = default 150x150)
    pub pet_scale: f64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            work_interval_minutes: 45,
            rest_duration_minutes: 5,
            rest_mode: "A".to_string(),
            active_sprite_set: "default-cat".to_string(),
            autostart: false,
            pet_scale: 1.0,
        }
    }
}

use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime;
use tauri::{AppHandle, Emitter};
use tokio::time::interval;

pub struct TimerState {
    pub elapsed_seconds: u64,
    pub work_interval_seconds: u64,
    pub rest_duration_seconds: u64,
    pub is_resting: bool,
    pub awaiting_break_decision: bool,
    pub paused: bool,
}

impl TimerState {
    pub fn new(work_minutes: u64, rest_minutes: u64) -> Self {
        Self {
            elapsed_seconds: 0,
            work_interval_seconds: work_minutes * 60,
            rest_duration_seconds: rest_minutes * 60,
            is_resting: false,
            awaiting_break_decision: false,
            paused: false,
        }
    }
}

/// Starts the background timer loop.
/// Emits:
///   - "timer-tick"    { elapsed, total, is_resting, rest_remaining }  every second
///   - "focus-complete" { focus_minutes } when work interval is reached
///   - "rest-end"      { reason }          when rest period is over
pub fn start_timer(app: AppHandle, state: Arc<Mutex<TimerState>>, rest_mode: String) {
    async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(1));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            ticker.tick().await;

            let (
                should_prompt_break,
                should_end_rest,
                elapsed,
                total,
                is_resting,
                rest_remaining,
                focus_minutes,
            ) = {
                let mut s = state.lock().unwrap();
                if s.paused {
                    continue;
                }

                s.elapsed_seconds += 1;

                let mut should_prompt_break = false;
                let mut should_end_rest = false;

                if !s.is_resting
                    && !s.awaiting_break_decision
                    && s.elapsed_seconds >= s.work_interval_seconds
                {
                    s.awaiting_break_decision = true;
                    should_prompt_break = true;
                } else if s.is_resting && s.elapsed_seconds >= s.rest_duration_seconds {
                    s.is_resting = false;
                    s.awaiting_break_decision = false;
                    s.elapsed_seconds = 0;
                    should_end_rest = true;
                }

                let rest_remaining = if s.is_resting {
                    s.rest_duration_seconds.saturating_sub(s.elapsed_seconds)
                } else {
                    0
                };
                let total = if s.is_resting {
                    s.rest_duration_seconds
                } else {
                    s.work_interval_seconds
                };

                (
                    should_prompt_break,
                    should_end_rest,
                    s.elapsed_seconds,
                    total,
                    s.is_resting,
                    rest_remaining,
                    s.work_interval_seconds / 60,
                )
            };

            // Emit timer-tick every second
            let _ = app.emit(
                "timer-tick",
                serde_json::json!({
                    "elapsed": elapsed,
                    "total": total,
                    "is_resting": is_resting,
                    "rest_remaining": rest_remaining,
                }),
            );

            if should_prompt_break {
                let _ = app.emit(
                    "focus-complete",
                    serde_json::json!({
                        "mode": rest_mode,
                        "focus_minutes": focus_minutes,
                    }),
                );
            }

            if should_end_rest {
                let _ = app.emit(
                    "rest-end",
                    serde_json::json!({
                        "reason": "completed",
                    }),
                );
            }
        }
    });
}

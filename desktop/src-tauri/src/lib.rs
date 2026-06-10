//! Arena desktop shell.
//!
//! The Tauri shell is a *live window only*: it hosts the web UI and lets it open
//! additional real OS windows for the multi-monitor pop-out (Spec 2.5). It never
//! runs orchestration, agents, or secrets — all real work happens in the cloud
//! backend, which is the single source of truth (Spec 2.4, CLAUDE §4).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Arena desktop shell");
}

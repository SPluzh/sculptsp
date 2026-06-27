mod wintab;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(wintab::WintabState::new())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      wintab::wintab_enable,
      wintab::wintab_disable
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}


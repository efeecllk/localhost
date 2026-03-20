// src-tauri/src/lib.rs
// Tauri app setup: tray icon, window management, macOS-specific configuration,
// and plugin/command registration.

// The `objc` crate's `sel_impl!` macro emits unexpected_cfgs warnings for "cargo-clippy".
// This cannot be fixed without migrating to objc2. Suppress at crate level.
#![allow(unexpected_cfgs)]

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition,
};

mod commands;
mod errors;
mod proc_cwd;
mod project_resolver;
mod scanner;
mod types;

use scanner::Scanner;

#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::appkit::{NSApp, NSApplication};
#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::base::YES;
#[cfg(target_os = "macos")]
use objc::{msg_send, runtime::Object, sel, sel_impl};

// ---- macOS window constants ----
#[cfg(target_os = "macos")]
const NS_WINDOW_COLLECTION_BEHAVIOR_CAN_JOIN_ALL_SPACES: u64 = 1 << 0;
#[cfg(target_os = "macos")]
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY: u64 = 1 << 8;
#[cfg(target_os = "macos")]
const NS_WINDOW_COLLECTION_BEHAVIOR_STATIONARY: u64 = 1 << 4;
#[cfg(target_os = "macos")]
const NS_POPUP_MENU_WINDOW_LEVEL: i64 = 101;

#[cfg(target_os = "macos")]
fn configure_macos_window(window: &tauri::WebviewWindow) {
    unsafe {
        let ns_window = window.ns_window();
        if let Ok(ns_win) = ns_window {
            let ns_win = ns_win as *mut Object;
            let behavior: u64 = NS_WINDOW_COLLECTION_BEHAVIOR_CAN_JOIN_ALL_SPACES
                | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY
                | NS_WINDOW_COLLECTION_BEHAVIOR_STATIONARY;
            let _: () = msg_send![ns_win, setCollectionBehavior: behavior];
            let _: () = msg_send![ns_win, setLevel: NS_POPUP_MENU_WINDOW_LEVEL];
        }
    }
}

fn show_window_at_position(
    _app: &AppHandle,
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
) {
    #[cfg(target_os = "macos")]
    configure_macos_window(window);

    let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "macos")]
    {
        #[allow(deprecated)]
        unsafe {
            let ns_app = NSApp();
            ns_app.activateIgnoringOtherApps_(YES);
        }
    }
}

pub fn run() {
    // Create the Scanner and wrap in Arc for sharing with Tauri state
    let scanner = Arc::new(Scanner::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(scanner)
        .setup(|app| {
            // --- Tray menu ---
            let refresh_item =
                MenuItem::with_id(app, "refresh", "Refresh Now", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit localhost", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&refresh_item, &quit_item])?;

            // --- Tray icon ---
            let tray_icon =
                tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
                    .expect("Failed to load tray icon");

            let mut tray_builder = TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("localhost — dev process monitor");

            #[cfg(target_os = "macos")]
            {
                tray_builder = tray_builder.icon_as_template(true);
            }

            let _tray = tray_builder
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "refresh" => {
                        // Emit event to frontend to trigger immediate scan
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("force-refresh", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let width = 360.0;
                                let x = (position.x - width / 2.0).max(0.0);
                                let y = position.y + 5.0;
                                show_window_at_position(app, &window, x, y);
                            }
                        }
                    }
                })
                .build(app)?;

            // Hide from dock on macOS (menu-bar-only app)
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_processes,
            commands::stop_process,
            commands::restart_process,
            commands::open_in_terminal,
            commands::open_in_editor,
            commands::open_in_browser,
            commands::stop_docker_container,
            commands::restart_docker_container,
            commands::get_settings,
            commands::save_settings,
        ])
        .on_window_event(|window, event| {
            // Close button should hide, not quit -- keep app running in tray
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

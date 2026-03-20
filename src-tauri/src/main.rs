// src-tauri/src/main.rs
// Application entry point. Delegates to lib.rs for all setup and runtime logic.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    localhost_lib::run();
}

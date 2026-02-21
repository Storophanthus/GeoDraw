// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(desktop)]
const MENU_FILE_OPEN: &str = "file_open";
#[cfg(desktop)]
const MENU_FILE_SAVE: &str = "file_save";
#[cfg(desktop)]
const MENU_FILE_SAVE_AS: &str = "file_save_as";

#[cfg(desktop)]
const EVENT_FILE_OPEN: &str = "gd-menu-file-open";
#[cfg(desktop)]
const EVENT_FILE_SAVE: &str = "gd-menu-file-save";
#[cfg(desktop)]
const EVENT_FILE_SAVE_AS: &str = "gd-menu-file-save-as";

#[cfg(desktop)]
fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let menu = Menu::default(app)?;

    let mut file_submenu: Option<tauri::menu::Submenu<R>> = None;
    for item in menu.items()? {
        if let Some(submenu) = item.as_submenu() {
            if submenu.text()? == "File" {
                file_submenu = Some(submenu.clone());
                break;
            }
        }
    }

    if let Some(file) = file_submenu {
        let open = MenuItem::with_id(app, MENU_FILE_OPEN, "Open…", true, Some("CmdOrCtrl+O"))?;
        let save = MenuItem::with_id(app, MENU_FILE_SAVE, "Save", true, Some("CmdOrCtrl+S"))?;
        let save_as =
            MenuItem::with_id(app, MENU_FILE_SAVE_AS, "Save As…", true, Some("Shift+CmdOrCtrl+S"))?;
        let sep = PredefinedMenuItem::separator(app)?;
        file.prepend_items(&[&open, &save, &save_as, &sep])?;
    }

    Ok(menu)
}

#[cfg(desktop)]
fn forward_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: tauri::menu::MenuEvent) {
    use tauri::Emitter;
    if event.id() == MENU_FILE_OPEN {
        let _ = app.emit(EVENT_FILE_OPEN, ());
        return;
    }
    if event.id() == MENU_FILE_SAVE {
        let _ = app.emit(EVENT_FILE_SAVE, ());
        return;
    }
    if event.id() == MENU_FILE_SAVE_AS {
        let _ = app.emit(EVENT_FILE_SAVE_AS, ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet]);

    #[cfg(desktop)]
    let builder = builder
        .menu(|app| build_menu(app))
        .on_menu_event(|app, event| forward_menu_event(app, event));

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Serialize)]
struct CompileTikzPreviewResult {
    pdf_base64: String,
    log: String,
    engine: String,
}

struct RunAttempt {
    binary: String,
    ok: bool,
    log: String,
}

struct CompileRunResult {
    engine: String,
    log: String,
}

#[tauri::command]
fn compile_tikz_preview(source: String) -> Result<CompileTikzPreviewResult, String> {
    if source.trim().is_empty() {
        return Err("Cannot compile empty source.".to_string());
    }

    let work_dir = create_preview_work_dir()?;
    let tex_path = work_dir.join("document.tex");
    fs::write(&tex_path, source).map_err(|err| format!("Failed to write TeX source: {err}"))?;

    let compile_result = compile_tex_document(&tex_path, &work_dir)?;
    let pdf_path = work_dir.join("document.pdf");
    if !pdf_path.exists() {
        return Err(format!(
            "Compilation did not produce a PDF at {}.\n\n{}",
            pdf_path.display(),
            compile_result.log
        ));
    }
    let pdf_bytes = fs::read(&pdf_path).map_err(|err| {
        format!(
            "Compilation succeeded but failed to read generated PDF {}: {err}",
            pdf_path.display()
        )
    })?;
    let pdf_base64 = {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(pdf_bytes)
    };

    Ok(CompileTikzPreviewResult {
        pdf_base64,
        log: compile_result.log,
        engine: compile_result.engine,
    })
}

fn create_preview_work_dir() -> Result<PathBuf, String> {
    let root = std::env::temp_dir().join("geodraw-tikz-preview");
    fs::create_dir_all(&root)
        .map_err(|err| format!("Failed to create preview root {}: {err}", root.display()))?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    let work_dir = root.join(format!("job-{stamp}-{pid}"));
    fs::create_dir_all(&work_dir)
        .map_err(|err| format!("Failed to create work dir {}: {err}", work_dir.display()))?;
    Ok(work_dir)
}

fn compile_tex_document(tex_path: &Path, work_dir: &Path) -> Result<CompileRunResult, String> {
    let tex_path_str = tex_path.to_string_lossy().to_string();
    let out_dir = work_dir.to_string_lossy().to_string();

    let latexmk_args = vec![
        "-pdf".to_string(),
        "-interaction=nonstopmode".to_string(),
        "-halt-on-error".to_string(),
        "-file-line-error".to_string(),
        format!("-outdir={}", out_dir),
        tex_path_str.clone(),
    ];
    let latexmk_candidates = [
        "latexmk",
        "/Library/TeX/texbin/latexmk",
        "/usr/texbin/latexmk",
    ];

    if let Some(run) = run_command_candidates(&latexmk_candidates, &latexmk_args, work_dir)? {
        if run.ok {
            return Ok(CompileRunResult {
                log: run.log,
                engine: run.binary,
            });
        }
        let lowered = run.log.to_lowercase();
        if !lowered.contains("pdflatex: command not found") {
            return Err(format!("TeX compilation failed.\n\n{}", run.log));
        }
    }

    let pdflatex_args = vec![
        "-interaction=nonstopmode".to_string(),
        "-halt-on-error".to_string(),
        "-file-line-error".to_string(),
        "-output-directory".to_string(),
        out_dir,
        tex_path_str,
    ];
    let pdflatex_candidates = [
        "pdflatex",
        "/Library/TeX/texbin/pdflatex",
        "/usr/texbin/pdflatex",
    ];
    let first_pass = run_command_candidates(&pdflatex_candidates, &pdflatex_args, work_dir)?;
    let Some(first) = first_pass else {
        return Err(
            "No TeX engine found. Install latexmk or pdflatex and ensure it is on PATH."
                .to_string(),
        );
    };
    if !first.ok {
        return Err(format!("TeX compilation failed.\n\n{}", first.log));
    }

    let second = run_command(&first.binary, &pdflatex_args, work_dir)
        .map_err(|err| format!("Failed to run second pdflatex pass: {err}"))?;
    if !second.ok {
        return Err(format!(
            "TeX compilation failed in second pdflatex pass.\n\n{}\n\n{}",
            first.log, second.log
        ));
    }

    Ok(CompileRunResult {
        log: format!("{}\n\n{}", first.log, second.log),
        engine: first.binary,
    })
}

fn run_command_candidates(
    candidates: &[&str],
    args: &[String],
    work_dir: &Path,
) -> Result<Option<RunAttempt>, String> {
    for candidate in candidates {
        match run_command(candidate, args, work_dir) {
            Ok(result) => return Ok(Some(result)),
            Err(err) if is_not_found_error(&err) => continue,
            Err(err) => return Err(err.to_string()),
        }
    }
    Ok(None)
}

fn run_command(
    binary: &str,
    args: &[String],
    work_dir: &Path,
) -> Result<RunAttempt, std::io::Error> {
    let mut command = Command::new(binary);
    command.args(args).current_dir(work_dir);
    augment_command_path(&mut command, binary);
    let output = command.output()?;
    Ok(RunAttempt {
        binary: binary.to_string(),
        ok: output.status.success(),
        log: build_process_log(binary, args, &output),
    })
}

fn augment_command_path(command: &mut Command, binary: &str) {
    let mut entries: Vec<PathBuf> = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();

    let mut push_entry = |path: PathBuf| {
        if path.as_os_str().is_empty() {
            return;
        }
        if seen.insert(path.clone()) {
            entries.push(path);
        }
    };

    if let Some(parent) = Path::new(binary).parent() {
        if !parent.as_os_str().is_empty() {
            push_entry(parent.to_path_buf());
        }
    }

    if let Some(path_var) = std::env::var_os("PATH") {
        for path in std::env::split_paths(&path_var) {
            push_entry(path);
        }
    }

    for extra in ["/Library/TeX/texbin", "/usr/texbin"] {
        let extra_path = PathBuf::from(extra);
        if extra_path.exists() {
            push_entry(extra_path);
        }
    }

    if let Ok(joined) = std::env::join_paths(entries) {
        command.env("PATH", joined);
    }
}

fn build_process_log(binary: &str, args: &[String], output: &Output) -> String {
    let status = output.status.code().map_or_else(
        || "terminated by signal".to_string(),
        |code| code.to_string(),
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    format!(
        "$ {} {}\nstatus: {}\n\nstdout:\n{}\n\nstderr:\n{}",
        binary,
        args.join(" "),
        status,
        stdout,
        stderr
    )
}

fn is_not_found_error(err: &std::io::Error) -> bool {
    err.kind() == std::io::ErrorKind::NotFound
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
        let save_as = MenuItem::with_id(
            app,
            MENU_FILE_SAVE_AS,
            "Save As…",
            true,
            Some("Shift+CmdOrCtrl+S"),
        )?;
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
        .invoke_handler(tauri::generate_handler![greet, compile_tikz_preview]);

    #[cfg(desktop)]
    let builder = builder
        .menu(|app| build_menu(app))
        .on_menu_event(|app, event| forward_menu_event(app, event));

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

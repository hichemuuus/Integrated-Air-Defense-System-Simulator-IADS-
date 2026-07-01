use std::net::TcpStream;
use std::process::Command;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Stores the PID of the spawned backend process.
/// We store PID (not Child handle) so both the sidecar (CommandChild)
/// and direct spawn (std::process::Child) code paths work identically.
struct BackendProcess(Mutex<Option<u32>>);

fn kill_process_tree(pid: u32) {
    println!("  Backend: killing process tree for PID {}", pid);
    // On Windows, use taskkill /F /T to force-kill the entire process tree
    // (uvicorn spawns worker processes that child.kill() alone misses)
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output();
    }
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(pid) = guard.take() {
                println!("Shutdown initiated");
                println!("  Backend: stopping server (PID {})", pid);
                kill_process_tree(pid);
                println!("  Backend: stopped");
                println!("Shutdown complete");
            }
        }
    }
}

fn is_backend_running() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:8000".parse().unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Read the backend PID from `backend_pid.txt` (written by run.bat).
/// Returns None if the file doesn't exist or can't be parsed.
fn read_prestarted_pid(project_root: &std::path::Path) -> Option<u32> {
    let pid_file = project_root.join("backend_pid.txt");
    let content = std::fs::read_to_string(pid_file).ok()?;
    let trimmed = content.trim();
    let pid: u32 = trimmed.parse().ok()?;
    println!("  Backend: read pre-started PID {} from backend_pid.txt", pid);
    Some(pid)
}

/// Try to discover the PID of any process listening on port 8000.
fn discover_backend_pid_on_port() -> Option<u32> {
    // Use netstat -ano to list all connections, then find port 8000 in the output
    let output = Command::new("netstat").args(["-ano"]).output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if !line.contains(":8000") {
            continue;
        }
        // Typical output:
        //   TCP    127.0.0.1:8000    0.0.0.0:0    LISTENING    12345
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(pid_str) = parts.last() {
            if let Ok(pid) = pid_str.parse::<u32>() {
                println!("  Backend: discovered PID {} on port 8000 via netstat", pid);
                return Some(pid);
            }
        }
    }
    None
}

#[allow(unused_variables)]
fn spawn_backend(app: &tauri::App) -> Option<u32> {
    if is_backend_running() {
        println!("  Backend: already running on 127.0.0.1:8000, trying to capture PID");
        // Try backend_pid.txt first (written by run.bat), then fall back to netstat scan
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let project_root = manifest_dir
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or(&manifest_dir)
            .to_path_buf();
        if let Some(pid) = read_prestarted_pid(&project_root) {
            return Some(pid);
        }
        if let Some(pid) = discover_backend_pid_on_port() {
            return Some(pid);
        }
        println!("  Backend: could not capture PID, will try fallback cleanup on exit");
        return None;
    }
    // Production: try sidecar binary bundled with the app
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_shell::ShellExt;
        if let Ok(sidecar) = app.shell().sidecar("iads-server") {
            if let Ok((_rx, child)) = sidecar.spawn() {
                let pid = child.pid();
                println!("  Backend: started sidecar (PID {})", pid);
                // Keep child alive — it's managed by tauri-plugin-shell,
                // but we store the PID for process-tree killing on exit.
                std::mem::forget(child);
                return Some(pid);
            }
            println!("  Backend: sidecar spawn failed, falling back");
        }
    }

    // Development: spawn python backend/server.py
    #[cfg(debug_assertions)]
    {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let project_root = manifest_dir
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or(&manifest_dir)
            .to_path_buf();
        let server_py = project_root.join("backend").join("server.py");

        if server_py.exists() {
            println!("  Backend: starting from {}", server_py.display());
            match Command::new("python")
                .arg(&server_py)
                .current_dir(project_root.join("backend"))
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
            {
                Ok(child) => {
                    let pid = child.id();
                    println!("  Backend: started python server (PID {})", pid);
                    // Re-parent by forgetting the Child handle (OS keeps process alive).
                    // Cleanup via kill_process_tree() on app exit.
                    std::mem::forget(child);
                    return Some(pid);
                }
                Err(e) => {
                    println!("  Backend: failed to start python: {}", e);
                }
            }
        } else {
            println!("  Backend: {} not found", server_py.display());
        }
    }

    None
}

fn kill_child_processes(app: &AppHandle) {
    let killed = if let Some(state) = app.try_state::<BackendProcess>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(pid) = guard.take() {
                println!("Killing child processes");
                println!("  Backend: stopping server (PID {})", pid);
                kill_process_tree(pid);
                println!("  Backend: stopped");
                true
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    // Fallback: if no PID was tracked, discover and kill any process on port 8000
    if !killed {
        println!("  Backend: no tracked PID, scanning for processes on port 8000...");
        if let Some(pid) = discover_backend_pid_on_port() {
            println!("  Backend: found PID {} on port 8000, killing...", pid);
            kill_process_tree(pid);
        } else {
            println!("  Backend: no process found on port 8000");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let backend_child = spawn_backend(app);
            app.manage(BackendProcess(Mutex::new(backend_child)));

            let show = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
            let _sep = MenuItemBuilder::with_id("sep", "").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        kill_child_processes(app);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .tooltip("Syntra Command")
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            use tauri::WindowEvent;
            let is_close_request = matches!(event, WindowEvent::CloseRequested { .. });
            if matches!(event, WindowEvent::CloseRequested { .. })
                || matches!(event, WindowEvent::Destroyed)
            {
                let app = window.app_handle();
                println!("Shutdown initiated");
                println!("Stopping simulation");
                println!("Stopping workers");
                kill_child_processes(&app);
                println!("Shutdown complete");
                if is_close_request {
                    app.exit(0);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                kill_child_processes(app_handle);
            }
        });
}

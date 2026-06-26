"""
IADS Command Center — Desktop Launcher

Launches the FastAPI backend in a background thread and opens
a native pywebview window pointing to the local server.

Usage:
    python desktop.py            # Normal mode (serves built frontend)
    python desktop.py --dev      # Developer mode (expects Vite on :3000)
"""

import sys
import os
import time
import threading
import argparse
import signal

HOST = "127.0.0.1"
PORT = 8000

# Module-level references for shutdown coordination
_server = None
_server_thread = None
_console_handler_ref = None


def start_server():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
    from server import app
    import uvicorn

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning")
    srv = uvicorn.Server(config)
    global _server
    _server = srv
    srv.run()


def _shutdown_server():
    """Stop uvicorn and force-exit — uvicorn leaves non-daemon threads alive."""
    global _server, _server_thread
    if _server is not None:
        _server.should_exit = True
        _server.force_exit = True
    if _server_thread is not None and _server_thread.is_alive():
        _server_thread.join(timeout=3)
    os._exit(0)


def _install_console_handlers():
    """Handle Ctrl+C and closing the run.bat CMD window on Windows."""
    global _console_handler_ref

    def _on_signal(signum, frame):
        _shutdown_server()

    signal.signal(signal.SIGINT, _on_signal)
    if sys.platform == "win32":
        signal.signal(signal.SIGBREAK, _on_signal)

        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.windll.kernel32
        HandlerRoutine = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)

        def _on_console_event(event):
            # 0=CTRL_C, 1=CTRL_BREAK, 2=CTRL_CLOSE (user clicked X on CMD window)
            if event in (0, 1, 2):
                _shutdown_server()
            return True

        _console_handler_ref = HandlerRoutine(_on_console_event)
        kernel32.SetConsoleCtrlHandler(_console_handler_ref, True)


def main():
    global _server_thread

    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", action="store_true", help="Connect to Vite dev server on :3000")
    args = parser.parse_args()

    _install_console_handlers()

    _server_thread = threading.Thread(target=start_server, daemon=True)
    _server_thread.start()

    time.sleep(1.5)

    frontend_url = f"http://{HOST}:{PORT}"

    if args.dev:
        frontend_url = f"http://{HOST}:3000"
        print(f"  Dev mode: expecting Vite on {frontend_url}")

    try:
        import webview

        def on_closing():
            _shutdown_server()

        window = webview.create_window(
            title="IADS Command Center",
            url=frontend_url,
            width=1600,
            height=1000,
            min_size=(1200, 800),
            resizable=True,
            fullscreen=False,
            text_select=False,
        )
        window.events.closing += on_closing

        webview.start(
            debug=args.dev,
            private_mode=False,
        )

        _shutdown_server()

    except ImportError:
        print("\n  pywebview not available — opening in browser instead.\n")
        import webbrowser
        webbrowser.open(frontend_url)
        print(f"  Server running at {frontend_url}")
        print("  Press Ctrl+C to stop.\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n  Shutting down...")
            _shutdown_server()


if __name__ == "__main__":
    main()

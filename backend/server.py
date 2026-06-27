import os
import sys
import time
import asyncio
import json
import argparse
import atexit
import signal
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from simulation_runner import SimulationRunner, ControlMessage
from comparison_coordinator import ComparisonCoordinator

_T_START = time.perf_counter()
def _log_timing(label: str):
    print(f"[TIMING] {label}: {time.perf_counter() - _T_START:.3f}s", flush=True)

_log_timing("import_start")

app = FastAPI(title="IADS Command Center")
_log_timing("fastapi_app_created")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_log_timing("middleware_added")

runners: dict[str, SimulationRunner] = {}
_log_timing("runner_dict_created")

frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
_log_timing("frontend_dist_resolved")


def stop_all_runners():
    for sim_id, runner in list(runners.items()):
        print(f"  Stopping simulation [{sim_id}]")
        runner.stop()
        del runners[sim_id]


@atexit.register
def _atexit_cleanup():
    stop_all_runners()


def _signal_handler(signum, frame):
    stop_all_runners()
    sys.exit(0)


if os.name == "nt":
    signal.signal(signal.SIGTERM, _signal_handler)
else:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)


def _mount_frontend():
    if not frontend_dist.is_dir():
        return
    if not (frontend_dist / "index.html").is_file():
        return

    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET"])
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            return JSONResponse({"error": "not found"}, status_code=404)
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        index = frontend_dist / "index.html"
        if index.is_file():
            return FileResponse(str(index))
        return JSONResponse({"error": "not found"}, status_code=404)

    print(f"  Frontend: serving from {frontend_dist}")


@app.get("/api/status")
async def status():
    if not getattr(status, "_first_call", False):
        status._first_call = True
        print(f"[TIMING] backend_accepting_requests: {time.perf_counter() - _T_START:.3f}s", flush=True)
    return {"status": "online", "simulations": len(runners)}


@app.post("/api/shutdown")
async def shutdown():
    stop_all_runners()
    return {"status": "shutdown"}


@app.post("/api/timing")
async def receive_timing(request: Request):
    data = await request.json()
    print(f"[TIMING-FRONTEND]")
    for k, v in sorted(data.items()):
        print(f"  {k}: {v}ms")
    return {"ok": True}


@app.websocket("/ws/sim/{sim_id}")
async def websocket_sim(websocket: WebSocket, sim_id: str = "default"):
    await websocket.accept()

    if sim_id not in runners:
        runners[sim_id] = SimulationRunner()
    runner = runners[sim_id]
    runner.start()

    async def control_reader():
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                action = msg.get("action", "")
                payload = msg.get("payload", {})

                print(f"\n  === WebSocket received [{sim_id}]: action={action} ===")
                if "scenario" in payload:
                    s = payload["scenario"]
                    print(f"  Scenario: hostiles={s.get('numHostiles')}, friendlies={s.get('numFriendlies')}, inventory={s.get('inventorySize')}, jam={s.get('jammingIntensity')}, speed={s.get('threatSpeed')}x, seed={s.get('randomSeed')}, swarm={s.get('swarmMode')}")
                else:
                    print(f"  Payload: {payload}")

                if action == "engage":
                    runner.send_control(ControlMessage("launch", {"target_id": msg.get("track_id")}))
                elif action == "step":
                    runner.send_control(ControlMessage("step", {}))
                elif action == "set_policy":
                    runner.send_control(ControlMessage("set_policy", {"policy_name": msg.get("policy_name")}))
                else:
                    runner.send_control(ControlMessage(action, payload))
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                pass
            except Exception:
                pass

    async def state_sender():
        while True:
            try:
                state = runner.get_state()
                if state is not None:
                    await websocket.send_json(state)
                await asyncio.sleep(0.016)
            except WebSocketDisconnect:
                break
            except Exception:
                break

    try:
        await asyncio.gather(control_reader(), state_sender())
    except:
        pass
    finally:
        runner.stop()
        if sim_id in runners:
            del runners[sim_id]


@app.websocket("/ws/sim")
async def websocket_sim_default(websocket: WebSocket):
    await websocket_sim(websocket, "default")


_mount_frontend()
_log_timing("frontend_mounted")


@app.websocket("/ws/compare")
async def websocket_compare(websocket: WebSocket):
    await websocket.accept()
    coordinator: ComparisonCoordinator | None = None

    async def control_reader():
        nonlocal coordinator
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                action = msg.get("action", "")
                payload = msg.get("payload", {})

                print(f"\n  === WebSocket received [compare]: action={action} ===")

                if action == "init":
                    if coordinator is not None:
                        coordinator.stop()
                    coordinator = ComparisonCoordinator(
                        payload.get("scenario"),
                        payload.get("policyA"),
                        payload.get("policyB"),
                    )
                    print(f"  ComparisonCoordinator created: A={payload.get('policyA')} B={payload.get('policyB')}")
                    await websocket.send_json({"type": "init_done"})

                elif action == "resume" and coordinator is not None:
                    coordinator.start()
                    print(f"  ComparisonCoordinator resumed")

                elif action == "pause" and coordinator is not None:
                    coordinator.stop()
                    print(f"  ComparisonCoordinator paused")

                elif action == "reset" and coordinator is not None:
                    coordinator.reset(
                        payload.get("scenario"),
                        payload.get("policyA"),
                        payload.get("policyB"),
                    )
                    print(f"  ComparisonCoordinator reset: A={payload.get('policyA')} B={payload.get('policyB')}")
                    await websocket.send_json({"type": "reset_done"})

                elif action == "set_policy" and coordinator is not None:
                    coordinator.set_policy(payload.get("which"), payload.get("policy_name"))
                    print(f"  ComparisonCoordinator set_policy {payload.get('which')}={payload.get('policy_name')}")

                elif action == "speed" and coordinator is not None:
                    coordinator.speed = payload.get("speed", 1.0)

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                pass
            except Exception:
                pass

    async def state_sender():
        nonlocal coordinator
        while True:
            try:
                if coordinator is not None:
                    state = coordinator.get_state()
                    if state is not None:
                        await websocket.send_json(state)
                await asyncio.sleep(0.016)
            except WebSocketDisconnect:
                break
            except Exception:
                break

    try:
        await asyncio.gather(control_reader(), state_sender())
    except:
        pass
    finally:
        if coordinator is not None:
            coordinator.stop()
            coordinator = None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    _log_timing("args_parsed")

    if not frontend_dist.is_dir() or not (frontend_dist / "index.html").is_file():
        print("  Frontend build not found at frontend/dist/.")
        print("  Run: cd frontend && npx vite build")
        print("  Starting API server only.\n")

    import uvicorn
    _log_timing("uvicorn_imported")
    print(f"\n{'='*50}", flush=True)
    print(f"  IADS Command Center", flush=True)
    print(f"  API + WebSocket: http://{args.host}:{args.port}", flush=True)
    if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
        print(f"  Frontend:       http://{args.host}:{args.port}", flush=True)
    print(f"{'='*50}\n", flush=True)
    try:
        print(f"[TIMING] uvicorn_run_start: {time.perf_counter() - _T_START:.3f}s")
        sys.stdout.flush()
        uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    finally:
        stop_all_runners()


if __name__ == "__main__":
    main()

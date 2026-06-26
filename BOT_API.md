# IADS Bot API — WebSocket Protocol

Connect an external AI agent to control the simulation in real time.

## Connection

| Description | URL |
|-------------|-----|
| Default simulation | `ws://<host>:8000/ws/sim` |
| Named simulation   | `ws://<host>:8000/ws/sim/{sim_id}` |

The server sends JSON state snapshots every tick (~16 ms). Send JSON commands to control the sim.

## Commands

### Engage — launch an interceptor at a track

```json
{"action": "engage", "track_id": 123}
```

### Set policy — swap engagement policy at runtime

```json
{"action": "set_policy", "policy_name": "BaselinePolicy"}
```

Available policies:

| Name | Behaviour |
|------|-----------|
| `BaselinePolicy` | Default threat-based engagement |
| `PriorityPolicy` | Jammed targets get highest priority |
| `PriorityPolicyUnjammedFirst` | Same as PriorityPolicy but jammed tiebreak is reversed |

### Step — advance one tick when paused

```json
{"action": "step"}
```

Only effective when the simulation is paused (no-op while running).

### Other commands (existing frontend protocol)

```json
{"action": "pause"}
{"action": "resume"}
{"action": "speed", "payload": {"speed": 2.0}}
{"action": "launch", "payload": {"target_id": 123}}
{"action": "reset"}
```

## Python example

```python
import asyncio
import json
import websockets

async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws/sim") as ws:
        # Wait for one state snapshot so we know the sim is ready
        state = await ws.recv()
        print("Connected, state received")

        # Engage track #42
        await ws.send(json.dumps({"action": "engage", "track_id": 42}))

        # Pause, step once, resume
        await ws.send(json.dumps({"action": "pause"}))
        await ws.send(json.dumps({"action": "step"}))
        await ws.send(json.dumps({"action": "resume"}))

        # Keep reading state until disconnected
        async for msg in ws:
            data = json.loads(msg)
            # data contains full simulation snapshot
            print(f"Tracks: {len(data.get('tracks', []))}")

if __name__ == "__main__":
    asyncio.run(main())
```

Requirements: `pip install websockets`

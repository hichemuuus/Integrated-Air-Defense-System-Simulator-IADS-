import pytest
from comparison_coordinator import ComparisonCoordinator


BASELINE_SCENARIO = {
    "numHostiles": 8,
    "numFriendlies": 3,
    "inventorySize": 30,
    "jammingIntensity": 0.2,
    "swarmMode": True,
    "threatSpeed": 1.0,
    "randomSeed": 42,
}


def test_creates_two_simulations():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    assert coord.sim_a is not None
    assert coord.sim_b is not None
    assert coord.sim_a is not coord.sim_b


def test_both_sims_identical_initial_state():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "Baseline", "Baseline")
    snap_a = coord.sim_a.get_state_snapshot()
    snap_b = coord.sim_b.get_state_snapshot()
    assert snap_a["simTime"] == snap_b["simTime"] == 0
    assert len(snap_a["tracks"]) == len(snap_b["tracks"])
    assert snap_a["stats"] == snap_b["stats"]
    assert snap_a["threats"] == snap_b["threats"]
    assert snap_a["events"] == snap_b["events"]


def test_different_policies_cause_divergence():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    for _ in range(600):
        coord.sim_a.step(0.05)
        coord.sim_b.step(0.05)
    snap_a = coord.sim_a.get_state_snapshot()
    snap_b = coord.sim_b.get_state_snapshot()
    assert snap_a["stats"] != snap_b["stats"], \
        "PPO_800k and Baseline should produce different stats"
    assert snap_a["simTime"] == snap_b["simTime"], \
        "Both sims should have identical sim_time"


def test_lockstep_sim_time():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "Baseline", "Baseline")
    for _ in range(50):
        coord.sim_a.step(0.05)
        coord.sim_b.step(0.05)
    assert coord.sim_a.sim_time == coord.sim_b.sim_time == pytest.approx(2.5, 0.01)


def test_identical_policies_produce_identical_results():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "Baseline", "Baseline")
    for _ in range(300):
        coord.sim_a.step(0.05)
        coord.sim_b.step(0.05)
    snap_a = coord.sim_a.get_state_snapshot()
    snap_b = coord.sim_b.get_state_snapshot()
    assert snap_a["stats"] == snap_b["stats"], \
        "Two Baseline sims with same seed should have identical stats"
    assert len(snap_a["tracks"]) == len(snap_b["tracks"]), \
        "Two Baseline sims should have same number of tracks"
    assert len(snap_a["interceptors"]) == len(snap_b["interceptors"]), \
        "Two Baseline sims should have same number of interceptors"


def test_reset_restores_initial_state():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    for _ in range(100):
        coord.sim_a.step(0.05)
        coord.sim_b.step(0.05)
    coord.reset(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    assert coord.sim_a.sim_time == 0
    assert coord.sim_b.sim_time == 0
    snap_a = coord.sim_a.get_state_snapshot()
    snap_b = coord.sim_b.get_state_snapshot()
    assert len(snap_a["tracks"]) == len(snap_b["tracks"])
    assert snap_a["stats"] == snap_b["stats"]


def test_set_policy_changes_only_target_sim():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "Baseline", "Baseline")
    coord.set_policy("A", "PPO_800k")
    for _ in range(600):
        coord.sim_a.step(0.05)
        coord.sim_b.step(0.05)
    snap_a = coord.sim_a.get_state_snapshot()
    snap_b = coord.sim_b.get_state_snapshot()
    assert snap_a["stats"] != snap_b["stats"], \
        "PPO_800k and Baseline should diverge after set_policy"


def test_deterministic_identical_runs():
    coord1 = ComparisonCoordinator(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    coord2 = ComparisonCoordinator(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    for _ in range(200):
        coord1.sim_a.step(0.05)
        coord1.sim_b.step(0.05)
        coord2.sim_a.step(0.05)
        coord2.sim_b.step(0.05)
    assert coord1.sim_a.get_state_snapshot()["stats"] == coord2.sim_a.get_state_snapshot()["stats"]
    assert coord1.sim_b.get_state_snapshot()["stats"] == coord2.sim_b.get_state_snapshot()["stats"]


def test_paired_snapshots_same_sim_time():
    coord = ComparisonCoordinator(BASELINE_SCENARIO, "PPO_800k", "Baseline")
    coord.start()
    import time
    time.sleep(0.3)
    coord.stop()
    state = coord.get_state()
    assert state is not None
    assert state["type"] == "snapshot"
    assert state["snapshotA"]["simTime"] == state["snapshotB"]["simTime"], \
        "Paired snapshots must have identical sim_time"
    assert state["snapshotA"]["simTime"] > 0

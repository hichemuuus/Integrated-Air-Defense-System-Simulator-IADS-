"""
Compare BaselinePolicy vs PriorityPolicy (jammed-first, spec) vs
PriorityPolicyUnjammedFirst (A/B variant) across multiple seeded runs.

Usage: python backend/compare_policies.py
No server or frontend required.

Each trial runs until 100 total hostiles have been spawned (fixed scenario
size), then all remaining in-flight interceptors are allowed to resolve
before final stats are captured. This eliminates the spawn-rate confound
(faster killers see more hostiles per tick, biasing raw leaker counts).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from simulation.simulator import Simulation
from simulation.policies import BaselinePolicy, PriorityPolicy, PriorityPolicyUnjammedFirst

TRIAL_HOSTILES = 100
DT = 0.05
SEEDS = [42, 123, 456, 789, 101112]
MAX_HOSTILE_DIVERGENCE_PCT = 10


def run_trial(seed, policy_cls):
    sim = Simulation(dt=DT, seed=seed, policy=policy_cls)
    while sim._total_hostiles_spawned < TRIAL_HOSTILES:
        sim.step(DT)
    for _ in range(2000):
        if not sim.interceptors and not sim.explosions:
            break
        sim.step(DT)

    stats = dict(sim._stats)
    stats['total_hostiles'] = sim._total_hostiles_spawned
    stats['jammed_candidate_count'] = sim._jammed_candidate_count
    stats['swarm_candidate_count'] = sim._swarm_candidate_count
    stats['jammed_spawned'] = sim._jammed_spawned
    stats['swarm_spawned'] = sim._swarm_spawned
    return stats


def pct(a, b):
    if b == 0:
        return float('inf') if a > 0 else 0.0
    return (a - b) / b * 100


def fmt_delta(val):
    if isinstance(val, float) and val == float('inf'):
        return "   inf "
    return f"{val:>+7.1f}"


POLICIES = [
    ("Baseline", BaselinePolicy),
    ("JamFirst", PriorityPolicy),
    ("UnjamFirst", PriorityPolicyUnjammedFirst),
]


def main():
    rows = []
    valid_seeds = []

    for seed in SEEDS:
        results = {}
        for label, cls in POLICIES:
            results[label] = run_trial(seed, cls)

        bh = results["Baseline"]['total_hostiles']
        jh = results["JamFirst"]['total_hostiles']
        uh = results["UnjamFirst"]['total_hostiles']
        divergence = max(
            abs(bh - jh) / max(bh, jh, 1) * 100,
            abs(bh - uh) / max(bh, uh, 1) * 100,
        )
        valid = divergence <= MAX_HOSTILE_DIVERGENCE_PCT
        if valid:
            valid_seeds.append(seed)

        rows.append((seed, results, divergence, valid))

    line = "=" * 80
    print(line)
    print("POLICY COMPARISON — Baseline vs JamFirst vs UnjamFirst (A/B)")
    print(f"  Seeds: {SEEDS}")
    print(f"  Trial: {TRIAL_HOSTILES} hostiles spawned per run (+ resolution phase)")
    print(line)
    print()

    fields = [
        ("Kills", "kills"),
        ("Misses", "misses"),
        ("Leakers", "leakers"),
        ("Launched", "launched"),
        ("Inventory Rem.", "inventory_remaining"),
        ("Threats Eng.", "threats_engaged"),
        ("Total Hostiles", "total_hostiles"),
    ]

    candidate_fields = [
        ("Jam Cand.", "jammed_candidate_count"),
        ("Swarm Cand.", "swarm_candidate_count"),
        ("Jam Spawned", "jammed_spawned"),
        ("Swarm Spawned", "swarm_spawned"),
    ]

    for seed, results, divergence, valid in rows:
        flag = "  << SKIPPED (divergent)" if not valid else ""
        print(f"-- Seed {seed} {flag}")
        header = f"{'Metric':<20}"
        for label, _ in POLICIES:
            header += f" {label:>12}"
        header += f" {'JvsB%':>8} {'UvsB%':>8}"
        print(header)
        print("-" * len(header))
        for label, key in fields:
            vals = []
            for p_label, _ in POLICIES:
                v = results[p_label].get(key, 0)
                vals.append(len(v) if isinstance(v, list) else v)
            line_out = f"{label:<20}"
            for v in vals:
                line_out += f" {v:>12d}"
            line_out += f" {fmt_delta(pct(vals[1], vals[0]))}"
            line_out += f" {fmt_delta(pct(vals[2], vals[0]))}"
            print(line_out)
        # Candidate breakdown
        for label, key in candidate_fields:
            vals = [results[p_label].get(key, 0) for p_label, _ in POLICIES]
            line_out = f"{label:<20}"
            for v in vals:
                line_out += f" {v:>12d}"
            line_out += f" {'':>8} {'':>8}"
            print(line_out)
        print(f"{'Hostile divergence':<20} {divergence:>12.1f}%")
        print()

    # Averaged summary (valid seeds only)
    print(line)
    print("AVERAGED SUMMARY (valid seeds only)")
    print(f"  Valid seeds ({len(valid_seeds)}): {valid_seeds}")
    if len(valid_seeds) < 3:
        print(f"  WARNING: fewer than 3 valid seeds ({len(valid_seeds)}).")
        print("  The averaged result below may not be statistically meaningful.")
        print("  Consider running with more seeds.")
    print(line)
    header = f"{'Metric':<20}"
    for label, _ in POLICIES:
        header += f" {label:>12}"
    header += f" {'JvsB%':>8} {'UvsB%':>8}"
    print(header)
    print("-" * len(header))

    if valid_seeds:
        for label, key in fields:
            all_vals = {p_label: [] for p_label, _ in POLICIES}
            for seed, results, _, valid in rows:
                if not valid:
                    continue
                for p_label, _ in POLICIES:
                    v = results[p_label].get(key, 0)
                    all_vals[p_label].append(len(v) if isinstance(v, list) else v)

            avgs = {}
            for p_label, _ in POLICIES:
                avgs[p_label] = sum(all_vals[p_label]) / len(all_vals[p_label])

            line_out = f"{label:<20}"
            for p_label, _ in POLICIES:
                line_out += f" {avgs[p_label]:>12.1f}"
            line_out += f" {fmt_delta(pct(avgs['JamFirst'], avgs['Baseline']))}"
            line_out += f" {fmt_delta(pct(avgs['UnjamFirst'], avgs['Baseline']))}"
            print(line_out)

        # Candidate averages
        for label, key in candidate_fields:
            all_vals = {p_label: [] for p_label, _ in POLICIES}
            for seed, results, _, valid in rows:
                if not valid:
                    continue
                for p_label, _ in POLICIES:
                    all_vals[p_label].append(results[p_label].get(key, 0))

            avgs = {}
            for p_label, _ in POLICIES:
                avgs[p_label] = sum(all_vals[p_label]) / len(all_vals[p_label])

            line_out = f"{label:<20}"
            for p_label, _ in POLICIES:
                line_out += f" {avgs[p_label]:>12.1f}"
            line_out += f" {'':>8} {'':>8}"
            print(line_out)
    else:
        print(f"{'No valid seeds':<20}")
    print()

    # Headline: leaker comparison for both JamFirst and UnjamFirst
    if valid_seeds:
        b_leakers = []
        j_leakers = []
        u_leakers = []
        for seed, results, _, valid in rows:
            if not valid:
                continue
            b_leakers.append(results["Baseline"]['leakers'])
            j_leakers.append(results["JamFirst"]['leakers'])
            u_leakers.append(results["UnjamFirst"]['leakers'])

        avg_b = sum(b_leakers) / len(b_leakers)
        avg_j = sum(j_leakers) / len(j_leakers)
        avg_u = sum(u_leakers) / len(u_leakers)
        jam_delta = (avg_j - avg_b) / avg_b * 100 if avg_b > 0 else 0
        unjam_delta = (avg_u - avg_b) / avg_b * 100 if avg_b > 0 else 0
        print(f"HEADLINE (JamFirst | spec): {avg_b:.1f} -> {avg_j:.1f}  leakers  ({jam_delta:+.1f}%)")
        print(f"HEADLINE (UnjamFirst | A/B): {avg_b:.1f} -> {avg_u:.1f}  leakers  ({unjam_delta:+.1f}%)")
    else:
        print("HEADLINE: insufficient valid seeds to compute average.")

    print(line)


if __name__ == "__main__":
    main()

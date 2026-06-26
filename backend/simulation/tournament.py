"""Policy Tournament Framework.

Usage:
    from simulation.tournament import Tournament
    from simulation.policies import BaselinePolicy, PriorityPolicy

    t = Tournament(num_runs=100)
    t.register("Baseline", BaselinePolicy)
    t.register("Priority", PriorityPolicy)
    t.run()
    t.save_leaderboard("leaderboard.json")
    t.save_csv("results.csv")
    t.save_html("report.html")
"""

import json
import csv
import time
import os
import sys
import numpy as np

from .simulator import Simulation
from .policies import BaselinePolicy, PriorityPolicy, PriorityPolicyUnjammedFirst

TRIAL_HOSTILES = 100
SIM_DT = 0.05
DRAIN_MAX_TICKS = 3000


class RunResult:
    __slots__ = (
        "policy", "seed",
        "kills", "misses", "leakers", "launched",
        "total_hostiles", "inventory_remaining",
        "response_times",
        "jammed_candidate_count", "swarm_candidate_count",
    )

    def __init__(self, policy, seed):
        self.policy = policy
        self.seed = seed
        self.kills = 0
        self.misses = 0
        self.leakers = 0
        self.launched = 0
        self.total_hostiles = 0
        self.inventory_remaining = 0
        self.response_times = []
        self.jammed_candidate_count = 0
        self.swarm_candidate_count = 0

    @property
    def kill_rate(self):
        return self.kills / max(self.total_hostiles, 1)

    @property
    def leaker_rate(self):
        return self.leakers / max(self.total_hostiles, 1)

    @property
    def inventory_efficiency(self):
        return self.kills / max(self.launched, 1)

    @property
    def avg_response_time(self):
        if not self.response_times:
            return 0.0
        return float(np.mean(self.response_times))

    @property
    def interceptor_usage(self):
        return self.launched / 30.0

    @property
    def survival_score(self):
        cap_kr = min(self.kill_rate, 1.0)
        cap_lr = min(self.leaker_rate, 1.0)
        raw = cap_kr * (1.0 - cap_lr) * 100.0
        return round(raw, 2)

    def to_dict(self):
        return {
            "policy": self.policy,
            "seed": self.seed,
            "kills": self.kills,
            "misses": self.misses,
            "leakers": self.leakers,
            "launched": self.launched,
            "total_hostiles": self.total_hostiles,
            "inventory_remaining": self.inventory_remaining,
            "kill_rate": round(self.kill_rate, 4),
            "leaker_rate": round(self.leaker_rate, 4),
            "inventory_efficiency": round(self.inventory_efficiency, 4),
            "avg_response_time": round(self.avg_response_time, 2),
            "interceptor_usage": round(self.interceptor_usage, 4),
            "survival_score": self.survival_score,
        }


class _PolicyStats:
    def __init__(self, name):
        self.name = name
        self.runs = []

    def add(self, run):
        self.runs.append(run)

    @property
    def n(self):
        return len(self.runs)

    def _values(self, attr):
        return np.array([getattr(r, attr) for r in self.runs])

    def _dict_values(self, key):
        return np.array([r.to_dict()[key] for r in self.runs])

    def mean_std(self, key):
        vals = self._dict_values(key)
        return float(np.mean(vals)), float(np.std(vals, ddof=1))

    def summary(self):
        return {
            "policy": self.name,
            "num_runs": self.n,
            "avg_kill_rate": self.mean_std("kill_rate")[0],
            "std_kill_rate": self.mean_std("kill_rate")[1],
            "avg_leaker_rate": self.mean_std("leaker_rate")[0],
            "std_leaker_rate": self.mean_std("leaker_rate")[1],
            "avg_inventory_efficiency": self.mean_std("inventory_efficiency")[0],
            "std_inventory_efficiency": self.mean_std("inventory_efficiency")[1],
            "avg_avg_response_time": self.mean_std("avg_response_time")[0],
            "std_avg_response_time": self.mean_std("avg_response_time")[1],
            "avg_interceptor_usage": self.mean_std("interceptor_usage")[0],
            "std_interceptor_usage": self.mean_std("interceptor_usage")[1],
            "avg_survival_score": self.mean_std("survival_score")[0],
            "std_survival_score": self.mean_std("survival_score")[1],
            "total_kills": int(np.sum(self._dict_values("kills"))),
            "total_leakers": int(np.sum(self._dict_values("leakers"))),
            "total_misses": int(np.sum(self._dict_values("misses"))),
            "total_launched": int(np.sum(self._dict_values("launched"))),
        }


class Tournament:
    def __init__(self, num_runs=100, trial_hostiles=TRIAL_HOSTILES, seed_offset=0, verbose=True):
        self.num_runs = num_runs
        self.trial_hostiles = trial_hostiles
        self.seed_offset = seed_offset
        self.verbose = verbose
        self._policies = {}
        self.results = []
        self._stats = {}

    def register(self, name, policy_class):
        self._policies[name] = policy_class

    def _log(self, msg):
        if self.verbose:
            print(msg)

    def run(self):
        if not self._policies:
            raise ValueError("No policies registered. Call register() first.")
        total_sims = self.num_runs * len(self._policies)
        policy_names = list(self._policies.keys())
        self._log(f"Tournament: {self.num_runs} runs × {len(self._policies)} policies = {total_sims} simulations")
        self._log(f"  Trial: {self.trial_hostiles} hostiles per run + resolution")
        self._log("")

        start_wall = time.time()
        run_number = 0

        for run_idx in range(self.num_runs):
            for pname in policy_names:
                run_number += 1
                seed = self.seed_offset + run_idx
                elapsed = time.time() - start_wall
                if self.verbose and (run_number % 5 == 0 or run_number == total_sims):
                    pct = run_number / total_sims * 100
                    eta_remaining = (elapsed / max(run_number, 1)) * (total_sims - run_number)
                    line = f"  [{run_number}/{total_sims}] {pname} seed={seed}  ({pct:.0f}%  ETA {eta_remaining:.0f}s)"
                    end_char = "\r" if run_number < total_sims else "\n"
                    sys.stdout.write(line + end_char)
                    sys.stdout.flush()

                result = self._run_single(pname, self._policies[pname], seed)
                self.results.append(result)

        wall = time.time() - start_wall
        self._log(f"\nDone in {wall:.1f}s ({total_sims / max(wall, 0.1):.1f} sims/s)")
        self._aggregate()

    def _run_single(self, policy_name, policy_cls, seed):
        sim = Simulation(dt=SIM_DT, seed=seed, policy=policy_cls)
        result = RunResult(policy_name, seed)

        candidate_warn_time = {}
        prev_warned = set(sim._warned_threats)
        prev_launched = set(sim._launched_at)

        while sim._total_hostiles_spawned < self.trial_hostiles:
            sim.step(SIM_DT)

            for tid in sim._warned_threats:
                if tid not in prev_warned:
                    candidate_warn_time[tid] = sim.sim_time

            for tid in sim._launched_at:
                if tid not in prev_launched and tid in candidate_warn_time and candidate_warn_time[tid] is not None:
                    rt = sim.sim_time - candidate_warn_time[tid]
                    result.response_times.append(rt)
                    candidate_warn_time[tid] = None

            prev_warned = set(sim._warned_threats)
            prev_launched = set(sim._launched_at)

        for _ in range(DRAIN_MAX_TICKS):
            if not sim.interceptors and not sim.explosions:
                break
            sim.step(SIM_DT)

        result.kills = sim._stats["kills"]
        result.misses = sim._stats["misses"]
        result.leakers = sim._stats["leakers"]
        result.launched = sim._stats["launched"]
        result.total_hostiles = sim._total_hostiles_spawned
        result.inventory_remaining = sim._stats["inventory_remaining"]
        result.jammed_candidate_count = sim._jammed_candidate_count
        result.swarm_candidate_count = sim._swarm_candidate_count

        return result

    def _aggregate(self):
        groups = {}
        for r in self.results:
            groups.setdefault(r.policy, _PolicyStats(r.policy)).add(r)
        self._stats = {name: g.summary() for name, g in groups.items()}

    def leaderboard(self):
        sorted_stats = sorted(self._stats.values(),
                              key=lambda s: s["avg_survival_score"],
                              reverse=True)
        for i, entry in enumerate(sorted_stats):
            entry["rank"] = i + 1
        return sorted_stats

    def save_leaderboard(self, path):
        lb = self.leaderboard()
        total_sims = len(self.results)
        doc = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "num_seeds": self.num_runs,
            "total_simulations": total_sims,
            "trial_hostiles": self.trial_hostiles,
            "policies": [s["policy"] for s in lb],
            "leaderboard": lb,
            "runs": [r.to_dict() for r in self.results],
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, indent=2)
        self._log(f"  leaderboard -> {path}")

    def save_csv(self, path):
        if not self.results:
            self._log("  no results to save")
            return
        fields = list(self.results[0].to_dict().keys())
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in self.results:
                w.writerow(r.to_dict())
        self._log(f"  csv -> {path}")

    def save_html(self, path):
        lb = self.leaderboard()
        runs_by_policy = {}
        for r in self.results:
            runs_by_policy.setdefault(r.policy, []).append(r)

        rows_html = ""
        for i, s in enumerate(lb):
            style = "background:#0d1117;" if i % 2 == 1 else ""
            rows_html += f"""<tr style="{style}">
            <td class="c">{s["rank"]}</td>
            <td><strong>{s["policy"]}</strong></td>
            <td class="c">{s["num_runs"]}</td>
            <td class="c">{s["avg_survival_score"]:.1f} ± {s["std_survival_score"]:.1f}</td>
            <td class="c">{s["avg_kill_rate"]*100:.1f}% ± {s["std_kill_rate"]*100:.1f}%</td>
            <td class="c">{s["avg_leaker_rate"]*100:.1f}% ± {s["std_leaker_rate"]*100:.1f}%</td>
            <td class="c">{s["avg_inventory_efficiency"]*100:.1f}% ± {s["std_inventory_efficiency"]*100:.1f}%</td>
            <td class="c">{s["avg_avg_response_time"]:.1f}s ± {s["std_avg_response_time"]:.1f}s</td>
            <td class="c">{s["avg_interceptor_usage"]*100:.1f}% ± {s["std_interceptor_usage"]*100:.1f}%</td>
        </tr>"""

        detail_rows = ""
        for pname, runs in runs_by_policy.items():
            summary = self._stats[pname]
            best_run = max(runs, key=lambda r: r.survival_score)
            worst_run = min(runs, key=lambda r: r.survival_score)
            kr_vals = np.array([r.kill_rate * 100 for r in runs])
            lr_vals = np.array([r.leaker_rate * 100 for r in runs])
            detail_rows += f"""<tr><td colspan="10" style="padding:0"><div class="section-break">{pname}</div></td></tr>
<tr>
    <td class="c" colspan="2">Average</td>
    <td class="c">{summary["avg_survival_score"]:.1f}</td>
    <td class="c">{summary["avg_kill_rate"]*100:.1f}%</td>
    <td class="c">{summary["avg_leaker_rate"]*100:.1f}%</td>
    <td class="c">{summary["avg_inventory_efficiency"]*100:.1f}%</td>
    <td class="c">{summary["avg_avg_response_time"]:.1f}s</td>
    <td class="c">{summary["avg_interceptor_usage"]*100:.1f}%</td>
    <td class="c">{summary["total_kills"]}</td>
    <td class="c">{summary["total_leakers"]}</td>
</tr>
<tr>
    <td class="c" colspan="2">Best</td>
    <td class="c">{best_run.survival_score:.1f}</td>
    <td class="c">{best_run.kill_rate*100:.1f}%</td>
    <td class="c">{best_run.leaker_rate*100:.1f}%</td>
    <td class="c">{best_run.inventory_efficiency*100:.1f}%</td>
    <td class="c">{best_run.avg_response_time:.1f}s</td>
    <td class="c">{best_run.interceptor_usage*100:.1f}%</td>
    <td class="c">{best_run.kills}</td>
    <td class="c">{best_run.leakers}</td>
</tr>
<tr>
    <td class="c" colspan="2">Worst</td>
    <td class="c">{worst_run.survival_score:.1f}</td>
    <td class="c">{worst_run.kill_rate*100:.1f}%</td>
    <td class="c">{worst_run.leaker_rate*100:.1f}%</td>
    <td class="c">{worst_run.inventory_efficiency*100:.1f}%</td>
    <td class="c">{worst_run.avg_response_time:.1f}s</td>
    <td class="c">{worst_run.interceptor_usage*100:.1f}%</td>
    <td class="c">{worst_run.kills}</td>
    <td class="c">{worst_run.leakers}</td>
</tr>"""

            p25 = float(np.percentile(kr_vals, 25))
            p75 = float(np.percentile(kr_vals, 75))
            detail_rows += f"""<tr>
    <td class="c" colspan="2">Kill Rate 25th/75th</td>
    <td colspan="8">{p25:.1f}% / {p75:.1f}%</td>
</tr>"""

        max_score = max(s["avg_survival_score"] for s in lb) if lb else 1
        chart_bars = ""
        chart_colors = ["#58a6ff", "#ff8c00", "#ff4444", "#3fb950", "#da3633"]
        for i, s in enumerate(lb):
            pct = s["avg_survival_score"] / max_score * 100 if max_score > 0 else 0
            clr = chart_colors[i % len(chart_colors)]
            chart_bars += f"""<div class="bar-row">
                <div class="bar-label">{s["policy"]}</div>
                <div class="bar-track"><div class="bar-fill" style="width:{pct:.1f}%;background:{clr}"></div></div>
                <div class="bar-val">{s["avg_survival_score"]:.1f}</div>
            </div>"""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>IADS Policy Tournament Leaderboard</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ background:#0a0f14; color:#c5d0de; font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; padding:24px; }}
h1 {{ color:#e6edf3; font-size:22px; margin-bottom:4px; }}
h2 {{ color:#8b949e; font-size:14px; font-weight:400; margin-bottom:20px; }}
.sub {{ color:#8b949e; font-size:12px; margin-bottom:20px; }}
table {{ width:100%; border-collapse:collapse; font-size:12px; }}
th {{ text-align:left; padding:8px 6px; border-bottom:1px solid #1e2a3a; color:#8b949e; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }}
td {{ padding:8px 6px; border-bottom:1px solid #161b22; }}
.c {{ text-align:center; }}
strong {{ color:#e6edf3; }}
.section-break {{ background:#161b22; color:#58a6ff; font-weight:bold; padding:10px 6px; font-size:13px; }}
.chart-container {{ margin:24px 0; padding:16px; background:#0d1117; border:1px solid #1e2a3a; border-radius:6px; }}
.bar-row {{ display:flex; align-items:center; margin-bottom:8px; }}
.bar-label {{ width:140px; font-size:13px; color:#c5d0de; text-align:right; padding-right:12px; }}
.bar-track {{ flex:1; height:22px; background:#161b22; border-radius:4px; overflow:hidden; }}
.bar-fill {{ height:100%; border-radius:4px; transition:width 0.3s; min-width:2px; }}
.bar-val {{ width:60px; text-align:right; font-size:13px; font-weight:bold; padding-left:8px; color:#e6edf3; }}
.meta {{ color:#8b949e; font-size:12px; margin-top:16px; }}
.footer {{ margin-top:30px; padding-top:12px; border-top:1px solid #1e2a3a; color:#484f58; font-size:10px; }}
</style>
</head>
<body>
<h1>&#9812; IADS Policy Tournament</h1>
<h2>Leaderboard &mdash; {sum(1 for _ in self.results)} simulations across {len(lb)} policies</h2>
<div class="sub">{self.num_runs} seeded runs per policy &middot; {self.trial_hostiles} hostiles per run</div>

<div class="chart-container">
    <div style="color:#8b949e;font-size:11px;margin-bottom:8px;">SURVIVAL SCORE (avg)</div>
    {chart_bars}
</div>

<table>
<thead>
<tr>
    <th class="c">Rank</th>
    <th>Policy</th>
    <th class="c">Runs</th>
    <th class="c">Survival Score</th>
    <th class="c">Kill Rate</th>
    <th class="c">Leaker Rate</th>
    <th class="c">Inventory Eff.</th>
    <th class="c">Resp. Time</th>
    <th class="c">Interceptor Usage</th>
</tr>
</thead>
<tbody>
{rows_html}
</tbody>
</table>

<h2 style="margin-top:24px;">Per-Policy Detail</h2>
<table>
<thead>
<tr>
    <th colspan="2">Policy</th>
    <th class="c">Survival Score</th>
    <th class="c">Kill Rate</th>
    <th class="c">Leaker Rate</th>
    <th class="c">Inv. Eff.</th>
    <th class="c">Resp. Time</th>
    <th class="c">Interceptor Usage</th>
    <th class="c">Total Kills</th>
    <th class="c">Total Leakers</th>
</tr>
</thead>
<tbody>
{detail_rows}
</tbody>
</table>

<div class="meta">Generated {time.strftime("%Y-%m-%d %H:%M:%S")}</div>
<div class="footer">IADS Policy Tournament Framework</div>
</body>
</html>"""

        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        self._log(f"  html -> {path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="IADS Policy Tournament")
    parser.add_argument("--runs", type=int, default=100, help="runs per policy (default 100)")
    parser.add_argument("--hostiles", type=int, default=TRIAL_HOSTILES, help="hostiles per run")
    parser.add_argument("--seed-offset", type=int, default=0)
    parser.add_argument("--output-dir", default=".",
                        help="directory for output files")
    parser.add_argument("--quiet", action="store_true", help="suppress progress")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    t = Tournament(num_runs=args.runs, trial_hostiles=args.hostiles,
                   seed_offset=args.seed_offset, verbose=not args.quiet)
    t.register("Baseline", BaselinePolicy)
    t.register("JamFirst", PriorityPolicy)
    t.register("UnjamFirst", PriorityPolicyUnjammedFirst)
    t.run()

    t.save_leaderboard(os.path.join(args.output_dir, "leaderboard.json"))
    t.save_csv(os.path.join(args.output_dir, "results.csv"))
    t.save_html(os.path.join(args.output_dir, "report.html"))


if __name__ == "__main__":
    main()

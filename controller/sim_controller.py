from PyQt6.QtCore import QObject
from model.simulation import Simulation, Classification, ThreatAssessor
from view.main_window import MainWindow


class SimController(QObject):
    def __init__(self):
        super().__init__()
        self.model = Simulation()
        self.view = MainWindow()

        self.model.step_completed.connect(self._on_step_completed)
        self.model.track_destroyed.connect(self._on_track_destroyed)
        self._warned_threats = set()
        self._launched_at = set()

        self.model.start()

    def _on_step_completed(self):
        self._update_time_display()
        self._update_counts()
        self._update_tracks_list()

        sweep = self.model.radar.sweep_angle
        self.view.render_radar(sweep)
        self.view.render_ppi(self.model.tracks, self.model.interceptors, sweep)
        self.view.render_explosions(self.model.explosions)
        self.view.render_tracks(self.model.tracks, self.model.interceptors)

        self._evaluate_threats()
        self._update_intercept_status()

    def _on_track_destroyed(self, track_id):
        ts = self._format_ts(self.model.sim_time)
        self.view.log_intercept(f"[{ts}] TRK-{track_id:03d} DESTROYED")

    def _update_time_display(self):
        t = self.model.sim_time
        minutes = int(t // 60)
        seconds = int(t % 60)
        centiseconds = int((t * 100) % 100)
        self.view.update_sim_time(f"{minutes:02d}:{seconds:02d}.{centiseconds:02d}")

    def _update_counts(self):
        threat_count = sum(
            1 for t in self.model.tracks.values()
            if t.classification == Classification.HOSTILE and t.visible
        )
        interceptor_count = len(self.model.interceptors)
        self.view.update_threat_count(str(threat_count))
        self.view.update_interceptor_count(str(interceptor_count))

    def _update_tracks_list(self):
        self.view.update_tracks_list(self.model.tracks, self.model.interceptors)

    def _evaluate_threats(self):
        for tid, track in list(self.model.tracks.items()):
            if track.classification != Classification.HOSTILE or not track.visible:
                continue

            eta = ThreatAssessor.evaluate(track)
            if eta is not None and eta < 60:
                if tid not in self._warned_threats:
                    self._warned_threats.add(tid)
                    self._log_threat_warning(tid, track, eta)
                if tid not in self._launched_at:
                    self._launched_at.add(tid)
                    iid = self.model.launch_interceptor(tid)
                    if iid is not None:
                        ts = self._format_ts(self.model.sim_time)
                        self.view.log_intercept(
                            f"[{ts}] INT-{iid:03d} LAUNCH -> TRK-{tid:03d}"
                        )

    def _update_intercept_status(self):
        self.view.clear_intercepts()
        for iid, interceptor in self.model.interceptors.items():
            tid = interceptor.target_id
            target_alive = tid in self.model.tracks
            status = f"INT-{iid:03d} -> TRK-{tid:03d}"
            if target_alive:
                tgt = self.model.tracks[tid]
                dx = interceptor.x - tgt.x
                dy = interceptor.y - tgt.y
                dist = (dx**2 + dy**2) ** 0.5
                status += f"  |  DIST {dist:.0f}"
            else:
                status += "  |  TARGET LOST"
            self.view.log_intercept(status)

    def _format_ts(self, sim_time):
        h = int(sim_time // 3600)
        m = int((sim_time % 3600) // 60)
        s = int(sim_time % 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    def _format_eta(self, eta):
        m = int(eta // 60)
        s = int(eta % 60)
        return f"{m:02d}:{s:02d}"

    def _log_threat_warning(self, tid, track, eta):
        ts = self._format_ts(self.model.sim_time)
        eta_str = self._format_eta(eta)
        self.view.log_threat(f"[{ts}] TRK-{tid:03d}  ETA {eta_str}  SPD {track.speed:.0f}")

    def show(self):
        self.view.show()

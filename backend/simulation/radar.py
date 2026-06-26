import numpy as np


class Radar:
    def __init__(self, id=0, x=0, y=0, jam_radius=2500, jam_noise_multiplier=5, jam_flicker_chance=0.20, rng=None, sweep_start=0.0, detection_range=10000, auto_track_range=4000, noise_std=50.0, sweep_rate=None, sweep_half_width=None, hold_time=0.5):
        self.id = id
        self.x = x
        self.y = y
        self.sweep_angle = sweep_start
        self.sweep_rate = sweep_rate if sweep_rate is not None else (2.0 * np.pi / 4.0)
        self.detection_range = detection_range
        self.auto_track_range = auto_track_range
        self.sweep_half_width = sweep_half_width if sweep_half_width is not None else np.radians(3)
        self.hold_time = hold_time
        self.noise_std = noise_std
        self.jam_radius = jam_radius
        self.jam_noise_multiplier = jam_noise_multiplier
        self.jam_flicker_chance = jam_flicker_chance
        self._rng = rng if rng is not None else np.random.default_rng()
        self._last_detected_time = {}
        self._visible_set = set()

    def update(self, tracks, sim_time, dt):
        self.sweep_angle = (self.sweep_angle + self.sweep_rate * dt) % (2.0 * np.pi)

        site_visible = set()
        for tid, track in tracks.items():
            dx = track.x - self.x
            dy = track.y - self.y
            dist = np.sqrt(dx**2 + dy**2)
            bearing = np.arctan2(dy, dx) % (2.0 * np.pi)
            angle_diff = min(
                abs(self.sweep_angle - bearing),
                2.0 * np.pi - abs(self.sweep_angle - bearing),
            )
            currently_swept = angle_diff <= self.sweep_half_width

            if currently_swept and dist <= self.detection_range:
                self._last_detected_time[tid] = sim_time
                site_visible.add(tid)
            elif dist <= self.auto_track_range:
                site_visible.add(tid)
            elif (
                tid in self._last_detected_time
                and (sim_time - self._last_detected_time[tid]) <= self.hold_time
            ):
                site_visible.add(tid)

        self._visible_set = site_visible

    def get_visible_set(self):
        return self._visible_set

    def get_sweep_endpoint(self, length=12000):
        return (
            self.x + length * np.cos(self.sweep_angle),
            self.y + length * np.sin(self.sweep_angle),
        )


class ThreatAssessor:
    @staticmethod
    def evaluate(track):
        dist = np.sqrt(track.x**2 + track.y**2)
        if track.speed <= 0:
            return None
        bearing_to_center = np.arctan2(-track.y, -track.x)
        angle_diff = abs(track.heading - bearing_to_center)
        angle_diff = min(angle_diff, 2.0 * np.pi - angle_diff)
        if angle_diff >= np.pi / 2.0:
            return None
        eta = dist / (track.speed * max(np.cos(angle_diff), 0.1))
        return eta

import numpy as np
from enum import Enum, auto
from PyQt6.QtCore import QTimer, QObject, pyqtSignal


class Classification(Enum):
    HOSTILE = auto()
    FRIENDLY = auto()


class Track:
    def __init__(self, track_id, x, y, vx, vy, classification, altitude=5000):
        self.id = track_id
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.classification = classification
        self.altitude = altitude
        self.history = [(x, y)]
        self.visible = True
        self.display_x = x
        self.display_y = y

    @property
    def heading(self):
        return np.arctan2(self.vy, self.vx)

    @property
    def speed(self):
        return np.sqrt(self.vx**2 + self.vy**2)

    def step(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.history.append((self.x, self.y))
        if len(self.history) > 50:
            self.history.pop(0)


class Interceptor(Track):
    def __init__(self, track_id, x, y, vx, vy, target_id=None):
        super().__init__(track_id, x, y, vx, vy, Classification.FRIENDLY, altitude=500)
        self.target_id = target_id
        self.max_speed = 1029.0
        self.max_accel = 147.15
        self.nav_constant = 3.5

    def step(self, dt, target_pos, target_vel):
        tx, ty = target_pos
        tvx, tvy = target_vel

        los_x = tx - self.x
        los_y = ty - self.y
        range_ = np.sqrt(los_x**2 + los_y**2)

        if range_ < 1.0:
            return

        rel_vx = tvx - self.vx
        rel_vy = tvy - self.vy

        los_rate = (los_x * rel_vy - los_y * rel_vx) / (range_**2)

        V_c = -(los_x * rel_vx + los_y * rel_vy) / range_
        if V_c < 0:
            V_c = 0.0

        a_cmd = self.nav_constant * V_c * los_rate

        speed = self.speed
        if speed > 0:
            perp_x = -self.vy / speed
            perp_y = self.vx / speed
            ax = a_cmd * perp_x
            ay = a_cmd * perp_y

            a_mag = np.sqrt(ax**2 + ay**2)
            if a_mag > self.max_accel:
                ax *= self.max_accel / a_mag
                ay *= self.max_accel / a_mag

            self.vx += ax * dt
            self.vy += ay * dt

            new_speed = np.sqrt(self.vx**2 + self.vy**2)
            if new_speed > self.max_speed:
                self.vx *= self.max_speed / new_speed
                self.vy *= self.max_speed / new_speed

        self.x += self.vx * dt
        self.y += self.vy * dt
        self.history.append((self.x, self.y))
        if len(self.history) > 50:
            self.history.pop(0)


class Explosion:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 0.0
        self.max_radius = 2000.0
        self.growth_rate = 800.0
        self.alive = True

    @property
    def alpha(self):
        return max(0.0, 1.0 - self.radius / self.max_radius)

    def update(self, dt):
        self.radius += self.growth_rate * dt
        if self.radius >= self.max_radius:
            self.alive = False


class Radar:
    def __init__(self):
        self.sweep_angle = 0.0
        self.sweep_rate = 2.0 * np.pi / 4.0
        self.detection_range = 10000
        self.auto_track_range = 4000
        self.sweep_half_width = np.radians(3)
        self.hold_time = 0.5
        self.noise_std = 50.0
        self._last_detected_time = {}

    def update(self, tracks, sim_time, dt):
        self.sweep_angle = (self.sweep_angle + self.sweep_rate * dt) % (2.0 * np.pi)

        for tid, track in tracks.items():
            dist = np.sqrt(track.x**2 + track.y**2)
            bearing = np.arctan2(track.y, track.x) % (2.0 * np.pi)
            angle_diff = min(
                abs(self.sweep_angle - bearing),
                2.0 * np.pi - abs(self.sweep_angle - bearing),
            )
            currently_swept = angle_diff <= self.sweep_half_width

            if currently_swept and dist <= self.detection_range:
                self._last_detected_time[tid] = sim_time
                track.visible = True
            elif dist <= self.auto_track_range:
                track.visible = True
            elif (
                tid in self._last_detected_time
                and (sim_time - self._last_detected_time[tid]) <= self.hold_time
            ):
                track.visible = True
            else:
                track.visible = False

            if track.visible:
                track.display_x = track.x + np.random.normal(0, self.noise_std)
                track.display_y = track.y + np.random.normal(0, self.noise_std)
            else:
                track.display_x = track.x
                track.display_y = track.y

    def get_sweep_endpoint(self, length=12000):
        return (
            length * np.cos(self.sweep_angle),
            length * np.sin(self.sweep_angle),
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


class Simulation(QObject):
    step_completed = pyqtSignal()
    track_destroyed = pyqtSignal(int)

    def __init__(self, dt=0.05, parent=None):
        super().__init__(parent)
        self.dt = dt
        self.sim_time = 0.0
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)
        self.running = False
        self.tracks = {}
        self.interceptors = {}
        self.explosions = []
        self.radar = Radar()
        self._next_id = 1
        self._spawn_hostiles()

    def _spawn_hostiles(self):
        speed = 250.0
        spawns = [(-9500, -2000), (1500, -9500), (9500, 3000)]
        altitudes = [7500, 4500, 9000]

        for (sx, sy), alt in zip(spawns, altitudes):
            angle = np.arctan2(-sy, -sx)
            vx = speed * np.cos(angle)
            vy = speed * np.sin(angle)
            track = Track(self._next_id, sx, sy, vx, vy, Classification.HOSTILE, altitude=alt)
            self.tracks[self._next_id] = track
            self._next_id += 1

    def launch_interceptor(self, target_id):
        if target_id not in self.tracks:
            return None
        target = self.tracks[target_id]
        dx = target.x
        dy = target.y
        dist = np.sqrt(dx**2 + dy**2)
        if dist < 1.0:
            return None
        angle = np.arctan2(dy, dx)
        speed = 400.0
        iid = self._next_id
        self._next_id += 1
        interceptor = Interceptor(
            iid, 0.0, 0.0, speed * np.cos(angle), speed * np.sin(angle),
            target_id=target_id,
        )
        self.interceptors[iid] = interceptor
        return iid

    def step(self, dt):
        self.sim_time += dt

        for track in self.tracks.values():
            track.step(dt)

        destroyed = []
        for iid, interceptor in list(self.interceptors.items()):
            target = self.tracks.get(interceptor.target_id)
            if target is None:
                destroyed.append((iid, None, self.interceptors[iid].x, self.interceptors[iid].y))
                continue
            interceptor.step(dt, (target.x, target.y), (target.vx, target.vy))
            dx = interceptor.x - target.x
            dy = interceptor.y - target.y
            if np.sqrt(dx**2 + dy**2) < 500.0:
                destroyed.append((iid, interceptor.target_id, interceptor.x, interceptor.y))

        for iid, tid, x, y in destroyed:
            self.interceptors.pop(iid, None)
            if tid is not None and tid in self.tracks:
                self.tracks.pop(tid, None)
                self.track_destroyed.emit(tid)
            self.explosions.append(Explosion(x, y))

        for explosion in list(self.explosions):
            explosion.update(dt)
            if not explosion.alive:
                self.explosions.remove(explosion)

        self.radar.update(self.tracks, self.sim_time, dt)

    def _tick(self):
        self.step(self.dt)
        self.step_completed.emit()

    def start(self):
        self.sim_time = 0.0
        self.timer.start(int(self.dt * 1000))
        self.running = True

    def stop(self):
        self.timer.stop()
        self.running = False

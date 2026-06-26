import numpy as np
from enum import Enum, auto


class Classification(Enum):
    HOSTILE = auto()
    FRIENDLY = auto()
    INTERCEPTOR = auto()


class Track:
    def __init__(self, track_id, x, y, vx, vy, classification, altitude=5000, track_type='STANDARD', group_id=None):
        self.id = track_id
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.classification = classification
        self.altitude = altitude
        self.track_type = track_type
        self.jammed = False
        self.group_id = group_id
        self.offset_x = 0.0
        self.offset_y = 0.0
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
        super().__init__(track_id, x, y, vx, vy, Classification.INTERCEPTOR, altitude=500)
        self.target_id = target_id
        self.max_speed = 1029.0
        self.max_accel = 147.15
        self.nav_constant = 3.5
        self.has_engaged = False

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


class MissMarker:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 0.0
        self.max_radius = 400.0
        self.growth_rate = 1200.0
        self.alive = True

    @property
    def alpha(self):
        return max(0.0, 1.0 - self.radius / self.max_radius)

    def update(self, dt):
        self.radius += self.growth_rate * dt
        if self.radius >= self.max_radius:
            self.alive = False

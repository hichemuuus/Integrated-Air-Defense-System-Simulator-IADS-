import numpy as np
import pyqtgraph as pg
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTextEdit, QLabel, QFrame, QGridLayout, QListWidget, QListWidgetItem,
    QScrollArea, QGroupBox,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from model.simulation import Classification

# ── color system ──────────────────────────────────────────────
BG = "#0A0F14"
BG_PANEL = "#0D1117"
BORDER = "#1E2A3A"
TEXT = "#C5D0DE"
TEXT_MUTED = "#8B949E"
TEXT_DIM = "#484F58"
COLOR_HOSTILE = "#FF4444"
COLOR_INTERCEPTOR = "#FF8C00"
COLOR_FRIENDLY = "#4A9EFF"
GRID_CYAN = "#00FFFF"
SWEEP = "#00FFAA"

S = 8  # spacing unit


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("IADS COMMAND CENTER")
        self.setMinimumSize(1400, 900)
        self._build_ui()
        self._init_map_items()
        self._init_map_static()
        self._init_ppi()

    # ── helpers ───────────────────────────────────────────────
    def _grp(self, title):
        g = QGroupBox(title.upper())
        g.setFont(QFont('Consolas', 9, QFont.Weight.Bold))
        l = QVBoxLayout(g)
        l.setContentsMargins(S * 2, S * 2, S * 2, S * 2)
        l.setSpacing(S)
        return g, l

    def _lbl(self, text, obj="val"):
        return QLabel(text, objectName=obj)

    # ── layout ────────────────────────────────────────────────
    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ── left: map ──
        map_frame = QFrame()
        map_frame.setStyleSheet(f"background: {BG}; border: none;")
        map_clay = QVBoxLayout(map_frame)
        map_clay.setContentsMargins(0, 0, 0, 0)

        self.map_grid = QGridLayout()
        self.map_grid.setContentsMargins(0, 0, 0, 0)
        self.map_grid.setSpacing(0)
        map_clay.addLayout(self.map_grid)

        self.map_widget = pg.PlotWidget()
        self.map_widget.setBackground(BG)
        self.map_widget.setAspectLocked(True)
        self.map_widget.hideButtons()
        pi = self.map_widget.getPlotItem()
        pi.hideAxis('bottom')
        pi.hideAxis('left')
        pi.showGrid(x=True, y=True, alpha=0.08)
        for ax in ['bottom', 'left']:
            pi.getAxis(ax).setPen(pg.mkPen(GRID_CYAN, width=1, alpha=60))
        self.map_widget.setRange(xRange=(-10000, 10000), yRange=(-10000, 10000))

        self.map_grid.addWidget(self.map_widget, 0, 0)
        root.addWidget(map_frame, stretch=1)

        # ── right: sidebar ──
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFixedWidth(360)
        sw = QWidget()
        sl = QVBoxLayout(sw)
        sl.setContentsMargins(S, S, S, S)
        sl.setSpacing(S)

        # ──── SYSTEM STATUS ────
        g_s, l_s = self._grp("SYSTEM STATUS")
        self.lbl_time = QLabel("00:00.00", objectName="time")
        l_s.addWidget(self.lbl_time)
        kpi = QHBoxLayout()
        kpi.setSpacing(S * 3)
        for label_text, obj, kpi_obj in [
            ("THREATS", "kpi_threat", "lbl_threats"),
            ("INTERCEPTORS", "kpi_inter", "lbl_interceptors"),
        ]:
            vb = QVBoxLayout()
            vb.setSpacing(2)
            vb.addWidget(self._lbl(label_text, "hdr"))
            lbl = QLabel("0", objectName=obj)
            setattr(self, kpi_obj, lbl)
            vb.addWidget(lbl)
            kpi.addLayout(vb)
        kpi.addStretch()
        l_s.addLayout(kpi)
        sl.addWidget(g_s)

        # ──── ACTIVE TRACKS ────
        g_t, l_t = self._grp("ACTIVE TRACKS")
        hdr = QLabel(
            "ID        TYPE       ALT       SPD",
            styleSheet=f"color: {TEXT_DIM}; font-size: 8px; background: transparent; letter-spacing: 1px;",
        )
        l_t.addWidget(hdr)
        self.tracks_list = QListWidget()
        self.tracks_list.setMinimumHeight(120)
        l_t.addWidget(self.tracks_list)
        sl.addWidget(g_t)

        # ──── THREAT ANALYSIS ────
        g_h, l_h = self._grp("THREAT ANALYSIS")
        self.threat_text = QTextEdit()
        self.threat_text.setReadOnly(True)
        self.threat_text.setPlaceholderText("— NO THREATS —")
        self.threat_text.setMinimumHeight(80)
        l_h.addWidget(self.threat_text)
        sl.addWidget(g_h)

        # ──── INTERCEPT STATUS ────
        g_i, l_i = self._grp("INTERCEPT STATUS")
        self.intercept_text = QTextEdit()
        self.intercept_text.setReadOnly(True)
        self.intercept_text.setPlaceholderText("— NO INTERCEPTORS —")
        self.intercept_text.setMinimumHeight(80)
        l_i.addWidget(self.intercept_text)
        sl.addWidget(g_i)

        sl.addStretch()
        scroll.setWidget(sw)
        root.addWidget(scroll)

    # ── static map elements ───────────────────────────────────
    def _init_map_static(self):
        rf = QFont('Consolas', 7)
        rpen = pg.mkPen(GRID_CYAN, width=1, alpha=25, style=Qt.PenStyle.DashLine)
        for r in [2000, 4000, 6000, 8000, 10000]:
            th = np.linspace(0, 2 * np.pi, 72)
            self.map_widget.addItem(pg.PlotDataItem(r * np.cos(th), r * np.sin(th), pen=rpen))
            lb = pg.TextItem(text=f"{r//1000}km", color=(140, 160, 180, 50), anchor=(0, 0.5))
            lb.setFont(rf)
            lb.setPos(r, 0)
            self.map_widget.addItem(lb)

        bf = QFont('Consolas', 6)
        apen = pg.mkPen(GRID_CYAN, width=1, alpha=15)
        for d in range(0, 360, 30):
            rad = np.radians(d)
            x, y = 11000 * np.cos(rad), 11000 * np.sin(rad)
            self.map_widget.addItem(pg.PlotDataItem([0, x], [0, y], pen=apen))
            lb = pg.TextItem(text=f"{d:03d}", color=(140, 160, 180, 35), anchor=(0.5, 0.5))
            lb.setFont(bf)
            lb.setPos(x, y)
            self.map_widget.addItem(lb)

    # ── PPI mini-radar ────────────────────────────────────────
    def _init_ppi(self):
        c = QFrame()
        c.setFixedSize(200, 200)
        c.setStyleSheet(f"background: {BG}; border: 1px solid {BORDER};")
        inner = QVBoxLayout(c)
        inner.setContentsMargins(1, 1, 1, 1)

        self.ppi = pg.PlotWidget()
        self.ppi.setBackground(BG)
        self.ppi.setAspectLocked(True)
        self.ppi.hideButtons()
        pp = self.ppi.getPlotItem()
        pp.hideAxis('bottom')
        pp.hideAxis('left')
        self.ppi.setRange(xRange=(-3000, 3000), yRange=(-3000, 3000))

        for r in [1000, 2000, 3000]:
            th = np.linspace(0, 2 * np.pi, 36)
            self.ppi.addItem(pg.PlotDataItem(
                r * np.cos(th), r * np.sin(th),
                pen=pg.mkPen(GRID_CYAN, width=1, alpha=20),
            ))

        self.ppi_sweep = pg.PlotDataItem()
        self.ppi_sweep.setData([0, 0], [0, 0])
        self.ppi.addItem(self.ppi_sweep)

        self.ppi_dots = pg.ScatterPlotItem()
        self.ppi.addItem(self.ppi_dots)

        lb = pg.TextItem(text="PPI", color=(100, 130, 160, 60), anchor=(0, 1))
        lb.setFont(QFont('Consolas', 6))
        lb.setPos(-2900, -2900)
        self.ppi.addItem(lb)

        inner.addWidget(self.ppi)
        self.map_grid.addWidget(c, 0, 0, Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignTop)

    # ── dynamic map items ─────────────────────────────────────
    def _init_map_items(self):
        self.track_dots = pg.ScatterPlotItem()
        self.map_widget.addItem(self.track_dots)
        self.trail_lines = {}
        self.velocity_lines = {}
        self.vdot_lines = {}
        self.interceptor_arrows = {}
        self.track_labels = {}
        self.explosion_items = []

        self.radar_sweep = pg.PlotDataItem()
        self.radar_sweep.setData([0, 0], [0, 0])
        self.map_widget.addItem(self.radar_sweep)

    # ── public update methods ─────────────────────────────────
    def update_sim_time(self, s):
        self.lbl_time.setText(s)

    def update_threat_count(self, n):
        self.lbl_threats.setText(str(n))

    def update_interceptor_count(self, n):
        self.lbl_interceptors.setText(str(n))

    def update_tracks_list(self, tracks, interceptors):
        self.tracks_list.clear()
        for t in tracks.values():
            tag = "HOSTILE" if t.classification == Classification.HOSTILE else "UNKNOWN"
            self.tracks_list.addItem(
                QListWidgetItem(
                    f"TRK-{t.id:03d}  | {tag:<9} | ALT {t.altitude:<5.0f} | SPD {t.speed:<5.0f}"
                )
            )
        for i in interceptors.values():
            self.tracks_list.addItem(
                QListWidgetItem(
                    f"INT-{i.id:03d}  | INTERCEPT | SPD {i.speed:<5.0f} | TGT TRK-{i.target_id:03d}"
                )
            )

    def log_threat(self, msg):
        self.threat_text.append(msg)

    def log_intercept(self, msg):
        self.intercept_text.append(msg)

    def clear_intercepts(self):
        self.intercept_text.clear()

    # ── render methods ────────────────────────────────────────
    def render_radar(self, angle):
        sx = 12000 * np.cos(angle)
        sy = 12000 * np.sin(angle)
        self.radar_sweep.setData([0, sx], [0, sy], pen=pg.mkPen(SWEEP, width=1, alpha=0.3))

    def render_explosions(self, explosions):
        n = len(explosions)
        while len(self.explosion_items) > n:
            self.map_widget.removeItem(self.explosion_items.pop())
        while len(self.explosion_items) < n:
            it = pg.PlotDataItem()
            self.map_widget.addItem(it)
            self.explosion_items.append(it)
        for i, ex in enumerate(explosions):
            th = np.linspace(0, 2 * np.pi, 36)
            cx = ex.x + ex.radius * np.cos(th)
            cy = ex.y + ex.radius * np.sin(th)
            a = max(0, int(ex.alpha * 255))
            self.explosion_items[i].setData(
                cx, cy,
                pen=pg.mkPen(COLOR_INTERCEPTOR, width=2, alpha=ex.alpha),
                brush=pg.mkBrush(255, 140, 0, a // 4),
            )

    def render_ppi(self, tracks, interceptors, angle):
        sx = 4000 * np.cos(angle)
        sy = 4000 * np.sin(angle)
        self.ppi_sweep.setData([0, sx], [0, sy], pen=pg.mkPen(SWEEP, width=1, alpha=0.25))
        all_e = list(tracks.values()) + list(interceptors.values())
        pts = []
        for e in all_e:
            if not e.visible:
                continue
            if e.x**2 + e.y**2 > 3000**2:
                continue
            pts.append({'pos': (e.x, e.y), 'size': 5, 'brush': pg.mkBrush(SWEEP), 'symbol': 'o'})
        self.ppi_dots.setData(pts)

    def render_tracks(self, tracks, interceptors):
        all_e = list(tracks.values()) + list(interceptors.values())
        visible = [e for e in all_e if e.visible]
        seen = {e.id for e in visible}

        for tid in list(self.trail_lines.keys()):
            if tid not in seen:
                self.map_widget.removeItem(self.trail_lines.pop(tid))
                self.map_widget.removeItem(self.velocity_lines.pop(tid))
                if tid in self.vdot_lines:
                    self.map_widget.removeItem(self.vdot_lines.pop(tid))
        for iid in list(self.interceptor_arrows.keys()):
            if iid not in seen:
                self.map_widget.removeItem(self.interceptor_arrows.pop(iid))
        for eid in list(self.track_labels.keys()):
            if eid not in seen:
                self.map_widget.removeItem(self.track_labels.pop(eid))

        scatter = []
        for e in visible:
            is_int = e.classification == Classification.FRIENDLY and hasattr(e, 'target_id')
            if e.classification == Classification.HOSTILE:
                color = COLOR_HOSTILE
                label = f"TRACK-{e.id:03d}"
                sym = 's'
                sz = 10
            elif is_int:
                color = COLOR_INTERCEPTOR
                label = f"INTER-{e.id:03d}"
                sym = 't'
                sz = 12
            else:
                color = COLOR_FRIENDLY
                label = f"TRACK-{e.id:03d}"
                sym = 'o'
                sz = 8

            eid = e.id

            if eid not in self.trail_lines:
                self.trail_lines[eid] = pg.PlotDataItem()
                self.map_widget.addItem(self.trail_lines[eid])
            if len(e.history) > 1:
                tx = [p[0] for p in e.history]
                ty = [p[1] for p in e.history]
                self.trail_lines[eid].setData(tx, ty, pen=pg.mkPen(color, width=1, alpha=0.18))
            else:
                self.trail_lines[eid].setData([], [])

            if eid not in self.velocity_lines:
                self.velocity_lines[eid] = pg.PlotDataItem()
                self.map_widget.addItem(self.velocity_lines[eid])
            scale = 4.0
            vx = e.display_x + e.vx * scale
            vy = e.display_y + e.vy * scale
            self.velocity_lines[eid].setData(
                [e.display_x, vx], [e.display_y, vy],
                pen=pg.mkPen(color, width=1, style=Qt.PenStyle.DashLine),
            )

            if eid not in self.vdot_lines:
                self.vdot_lines[eid] = pg.PlotDataItem()
                self.map_widget.addItem(self.vdot_lines[eid])
            self.vdot_lines[eid].setData(
                [vx], [vy],
                pen=None, symbol='o', symbolSize=3, symbolBrush=pg.mkBrush(color),
            )

            if eid not in self.track_labels:
                tl = pg.TextItem(anchor=(0, 0.5))
                tl.setFont(QFont('Consolas', 8))
                self.map_widget.addItem(tl)
                self.track_labels[eid] = tl
            tl = self.track_labels[eid]
            tl.setText(label)
            tl.setPos(e.display_x + 12, e.display_y - 12)

            if is_int:
                if eid in self.interceptor_arrows:
                    self.interceptor_arrows[eid].setPos(e.display_x, e.display_y)
                    self.interceptor_arrows[eid].setStyle(angle=np.degrees(e.heading))
                else:
                    arr = pg.ArrowItem(
                        pos=(e.display_x, e.display_y),
                        angle=np.degrees(e.heading),
                        headLen=14, tailLen=0,
                        brush=pg.mkBrush(color),
                        pen=pg.mkPen(color, width=1),
                    )
                    self.map_widget.addItem(arr)
                    self.interceptor_arrows[eid] = arr

            scatter.append({
                'pos': (e.display_x, e.display_y),
                'size': sz,
                'brush': pg.mkBrush(color),
                'symbol': sym,
            })

        self.track_dots.setData(scatter)

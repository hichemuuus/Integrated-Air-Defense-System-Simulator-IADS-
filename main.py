import sys
from PyQt6.QtWidgets import QApplication
from controller.sim_controller import SimController

FONT = "'JetBrains Mono', 'Consolas', 'Courier New', monospace"

QSS = f"""
QMainWindow {{
    background-color: #0A0F14;
}}
QWidget {{
    background-color: transparent;
    color: #C5D0DE;
    font-family: {FONT};
    font-size: 10px;
}}
QGroupBox {{
    border: 1px solid #1E2A3A;
    border-radius: 4px;
    margin-top: 14px;
    padding-top: 6px;
    font-size: 10px;
    font-weight: bold;
    color: #8B949E;
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 12px;
    padding: 0 6px;
    color: #8B949E;
}}
QLabel {{
    padding: 2px 4px;
    color: #C5D0DE;
}}
QLabel#hdr {{
    color: #8B949E;
    font-size: 9px;
    font-weight: bold;
}}
QLabel#val {{
    color: #E6EDF3;
    font-size: 11px;
}}
QLabel#time {{
    color: #58A6FF;
    font-size: 24px;
    font-weight: bold;
}}
QLabel#kpi_threat {{
    color: #FF4444;
    font-size: 18px;
    font-weight: bold;
}}
QLabel#kpi_inter {{
    color: #FF8C00;
    font-size: 18px;
    font-weight: bold;
}}
QLabel#badge {{
    color: #4A9EFF;
    font-size: 10px;
    font-weight: bold;
}}
QListWidget {{
    background-color: #0D1117;
    color: #C5D0DE;
    border: none;
    font-family: {FONT};
    font-size: 9px;
    outline: none;
}}
QListWidget::item {{
    padding: 3px 4px;
    border-bottom: 1px solid #161B22;
}}
QTextEdit {{
    background-color: #0D1117;
    color: #8B949E;
    border: none;
    font-family: {FONT};
    font-size: 9px;
}}
QScrollArea {{
    border: none;
    background-color: #0A0F14;
}}
QScrollBar:vertical {{
    background: #0A0F14;
    width: 6px;
}}
QScrollBar::handle:vertical {{
    background: #1E2A3A;
    border-radius: 3px;
    min-height: 24px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}
"""


def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    app.setStyleSheet(QSS)

    controller = SimController()
    controller.show()

    sys.exit(app.exec())


if __name__ == '__main__':
    main()

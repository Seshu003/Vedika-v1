import sys
import os
import ctypes

# Hide console window immediately at startup if running with console
if sys.platform == 'win32':
    try:
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
    except Exception:
        pass

# Redirect standard file descriptors to NUL in windowless mode to prevent PortAudio/C-level crashes
if sys.platform == 'win32':
    try:
        redirect_needed = False
        try:
            fd_out = sys.stdout.fileno()
        except Exception:
            redirect_needed = True
            
        if redirect_needed or sys.stdout is None or sys.stderr is None:
            nul_fd = os.open('NUL', os.O_WRONLY)
            try:
                os.dup2(nul_fd, 1)
            except Exception:
                pass
            try:
                os.dup2(nul_fd, 2)
            except Exception:
                pass
            
            # Redefine sys.stdout/stderr to dummy writers
            class DummyWriter:
                def write(self, *args, **kwargs): pass
                def flush(self, *args, **kwargs): pass
            sys.stdout = DummyWriter()
            sys.stderr = DummyWriter()
    except Exception:
        pass
import time
import math
import webbrowser
import json
from PyQt5.QtCore import Qt, QTimer, QPoint, QUrl, QThread, pyqtSignal, QRect, QRectF, QObject
from PyQt5.QtWidgets import QApplication, QWidget, QMenu, QAction, QMessageBox, QPushButton
from PyQt5.QtGui import QPainter, QCursor, QColor, QPen, QPolygon
from PyQt5.QtSvg import QSvgRenderer
from PyQt5.QtWebSockets import QWebSocket

# Initialize SAPI text-to-speech speaker (Windows Native SpVoice)
try:
    import win32com.client
    SPEAKER = win32com.client.Dispatch("SAPI.SpVoice")
    try:
        voices = SPEAKER.GetVoices()
        selected_voice = None
        for i in range(voices.Count):
            v = voices.Item(i)
            desc = v.GetDescription().lower()
            if "zira" in desc or "hazel" in desc or "female" in desc:
                selected_voice = v
                break
        if not selected_voice and voices.Count > 1:
            selected_voice = voices.Item(1)
        if selected_voice:
            SPEAKER.Voice = selected_voice
            print(f"[Cosmos] Native SAPI voice selected: {selected_voice.GetDescription()}")
    except Exception as voice_err:
        print(f"[Cosmos] Voice selection warning: {voice_err}")
except Exception:
    SPEAKER = None

# Optional speech recognition imports
try:
    import speech_recognition as sr
    HAS_SPEECH = True
except ImportError:
    HAS_SPEECH = False

# Optional active window tracking imports (Windows only)
if sys.platform == 'win32':
    try:
        import win32gui
        import win32process
        import win32con
        HAS_WIN32 = True
    except ImportError:
        HAS_WIN32 = False
else:
    HAS_WIN32 = False

# Standard SVG template of the mascot with placeholders for animations and states
SVG_TEMPLATE = """
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <linearGradient id="helmetGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="60%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <linearGradient id="visorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>
    <linearGradient id="controlBoxGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <linearGradient id="laptopScreenGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="laptopBaseGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#64748b" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
  </defs>

  <!-- Drop shadow under feet -->
  <ellipse cx="256" cy="485" rx="75" ry="8" fill="rgba(15,23,42,0.14)" />

  <!-- Master Mascot Motion Group -->
  <g transform="{bot_transform}">
    <!-- Neck Connector -->
    <path d="M 200,275 C 200,290 312,290 312,275" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linecap="round" />

    <!-- Left Leg Group -->
    <g transform="{left_leg_transform}">
      <path d="M 195,412 L 195,455 C 195,475 175,470 175,485 L 235,485 C 235,465 225,450 225,412 Z" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />
      <path d="M 180,473 C 195,473 215,473 230,473" fill="none" stroke="#000000" stroke-width="9" stroke-linecap="round" />
    </g>

    <!-- Right Leg Group -->
    <g transform="{right_leg_transform}">
      <path d="M 317,412 L 317,455 C 317,475 337,470 337,485 L 277,485 C 277,465 287,450 287,412 Z" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />
      <path d="M 332,473 C 317,473 297,473 282,473" fill="none" stroke="#000000" stroke-width="9" stroke-linecap="round" />
    </g>

    <!-- Torso / Body Block -->
    <path d="M 180,300 C 180,270 332,270 332,300 L 338,380 C 338,410 320,430 256,430 C 192,430 174,410 174,380 Z" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />

    <!-- Helmet Cast Shadow on Torso -->
    <path d="M 180,300 C 220,320 292,320 332,300 C 320,315 292,325 256,325 C 220,325 192,315 180,300 Z" fill="rgba(0, 0, 0, 0.12)" />

    <!-- Waist Belt -->
    <rect x="186" y="385" width="140" height="18" rx="9" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />

    <!-- Chest Control Box -->
    <rect x="210" y="315" width="92" height="60" rx="12" fill="url(#controlBoxGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />
    <path d="M 235,315 L 235,340 C 235,350 250,350 250,360 L 250,375" fill="none" stroke="#000000" stroke-width="8" stroke-linecap="round" />
    <circle cx="270" cy="345" r="9" fill="{voice_button_color}" stroke="#000000" stroke-width="6" />

    <!-- Left Arm Group -->
    <g transform="{left_arm_transform}">
      <path d="M 178,292 C 155,315 155,365 170,385 C 180,395 195,385 195,372 C 195,350 190,320 182,295" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M 170,370 C 162,370 160,360 168,355" fill="none" stroke="#000000" stroke-width="10" stroke-linecap="round" />
      <path d="M 160,358 C 170,363 182,363 190,356" fill="none" stroke="#000000" stroke-width="10" stroke-linecap="round" />
    </g>

    <!-- Right Arm Group -->
    <g transform="{right_arm_transform}">
      <path d="M 334,292 C 357,315 357,365 342,385 C 332,395 317,385 317,372 C 317,350 322,320 330,295" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M 342,370 C 350,370 352,360 344,355" fill="none" stroke="#000000" stroke-width="10" stroke-linecap="round" />
      <path d="M 352,358 C 342,363 330,363 322,356" fill="none" stroke="#000000" stroke-width="10" stroke-linecap="round" />

      <!-- Pencil (for writing state) -->
      <g transform="translate(332, 365) scale(1.55) translate(-332, -365)" style="display: {pencil_display}">
        <line x1="332" y1="365" x2="276" y2="395" stroke="#000000" stroke-width="11" stroke-linecap="round" />
        <line x1="332" y1="365" x2="276" y2="395" stroke="#eab308" stroke-width="7" stroke-linecap="round" />
        <polygon points="276,395 281,388 286,392" fill="#000000" />
      </g>

      <!-- Magnifying Glass (for searching state) -->
      <g transform="translate(332, 365) scale(1.55) translate(-332, -365)" style="display: {magnifier_display}">
        <line x1="332" y1="365" x2="310" y2="345" stroke="#000000" stroke-width="11" stroke-linecap="round" />
        <line x1="332" y1="365" x2="310" y2="345" stroke="#d97706" stroke-width="7" stroke-linecap="round" />
        <circle cx="300" cy="335" r="20" fill="rgba(56, 189, 248, 0.25)" stroke="#000000" stroke-width="8" />
        <path d="M 290,325 A 14,14 0 0,1 310,325" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6" />
      </g>
    </g>

    <!-- Head & Helmet Group (Parallax Shift) -->
    <g transform="{head_transform}">
      <!-- Left Ear Receiver -->
      <rect x="115" y="165" width="30" height="70" rx="15" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />
      <rect x="125" y="180" width="12" height="40" rx="6" fill="#cbd5e1" />
      
      <!-- Right Ear Receiver -->
      <rect x="367" y="165" width="30" height="70" rx="15" fill="url(#bodyGrad)" stroke="#000000" stroke-width="14" stroke-linejoin="round" />
      <rect x="375" y="180" width="12" height="40" rx="6" fill="#cbd5e1" />

      <!-- Helmet base -->
      <circle cx="256" cy="195" r="110" fill="url(#helmetGrad)" stroke="#000000" stroke-width="14" />

      <!-- Helmet Visor (black faceplate) -->
      <circle cx="256" cy="195" r="92" fill="url(#visorGrad)" stroke="#000000" stroke-width="14" />

      <!-- Visor Left Crescent Reflection -->
      <path d="M 185,195 A 71,71 0 0,1 230,130 A 92,92 0 0,0 164,195 Z" fill="#ffffff" opacity="0.12" />

      <!-- Glowing Digital Eyes -->
      <g transform="{eye_transform}">
        <ellipse cx="225" cy="195" rx="4.5" ry="9.5" fill="#ffffff" />
        <ellipse cx="287" cy="195" rx="4.5" ry="9.5" fill="#ffffff" />
      </g>

      <!-- Visor gloss reflections -->
      <g transform="{reflection_transform}">
        <circle cx="310" cy="170" r="14" fill="#ffffff" opacity="0.8" />
        <circle cx="292" cy="208" r="8" fill="#ffffff" opacity="0.8" />
      </g>
    </g>

    <!-- Laptop Overlay -->
    <g transform="translate(256, 395) scale(1.55) translate(-256, -395)" style="display: {laptop_display}">
      <polygon points="220,395 292,395 304,345 208,345" fill="url(#laptopScreenGrad)" stroke="#000000" stroke-width="10" stroke-linejoin="round" />
      <polygon points="224,391 288,391 298,351 214,351" fill="#0b0f19" />
      <rect x="222" y="357" width="35" height="3" rx="1.5" fill="#38BDF8" opacity="0.8" />
      <rect x="222" y="364" width="55" height="3" rx="1.5" fill="#34D399" opacity="0.8" />
      <rect x="222" y="371" width="25" height="3" rx="1.5" fill="#FBBF24" opacity="0.8" />
      <rect x="222" y="378" width="45" height="3" rx="1.5" fill="#38BDF8" opacity="0.8" />
      <rect x="235" y="385" width="20" height="3" rx="1.5" fill="#A78BFA" opacity="0.8" />
      <path d="M 214,351 L 255,351 L 225,391 L 214,391 Z" fill="#ffffff" opacity="0.08" />
      <polygon points="208,395 304,395 316,415 196,415" fill="url(#laptopBaseGrad)" stroke="#000000" stroke-width="10" stroke-linejoin="round" />
      <polygon points="214,398 298,398 308,411 204,411" fill="#1e293b" />
      <line x1="220" y1="404" x2="292" y2="404" stroke="rgba(56, 189, 248, 0.4)" stroke-width="3" stroke-linecap="round" />
      <rect x="246" y="406" width="20" height="4" rx="1" fill="#000000" />
    </g>

    <!-- Open Book Overlay -->
    <g transform="translate(256, 395) scale(1.55) translate(-256, -395)" style="display: {book_display}">
      <path d="M 210,410 C 225,405 245,412 256,415 C 267,412 287,405 302,410 L 302,390 C 287,385 267,392 256,395 C 245,392 225,385 210,390 Z" fill="#991b1b" stroke="#000000" stroke-width="8" stroke-linejoin="round" />
      <path d="M 214,406 C 225,401 243,407 254,410 L 254,390 C 243,387 225,381 214,386 Z" fill="#f8fafc" stroke="#000000" stroke-width="5" stroke-linejoin="round" />
      <path d="M 258,410 C 269,407 287,401 298,406 L 298,386 C 287,381 269,387 258,390 Z" fill="#f8fafc" stroke="#000000" stroke-width="5" stroke-linejoin="round" />
      <line x1="220" y1="392" x2="246" y2="395" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="220" y1="398" x2="246" y2="401" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="220" y1="404" x2="240" y2="406" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="266" y1="395" x2="292" y2="392" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="266" y1="401" x2="292" y2="398" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="266" y1="406" x2="286" y2="404" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
    </g>

    <!-- Clipboard Overlay -->
    <g transform="translate(256, 395) scale(1.55) translate(-256, -395)" style="display: {clipboard_display}">
      <rect x="220" y="375" width="72" height="48" rx="4" fill="#d97706" stroke="#000000" stroke-width="8" stroke-linejoin="round" />
      <rect x="226" y="381" width="60" height="38" rx="2" fill="#ffffff" stroke="#000000" stroke-width="4" />
      <rect x="246" y="370" width="20" height="10" rx="2" fill="#94a3b8" stroke="#000000" stroke-width="4" />
      <line x1="234" y1="390" x2="278" y2="390" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="234" y1="396" x2="278" y2="396" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
      <line x1="234" y1="402" x2="262" y2="402" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
    </g>

    <!-- Golden Trophy Overlay -->
    <g transform="translate(256, 395) scale(1.55) translate(-256, -395)" style="display: {trophy_display}">
      <rect x="238" y="415" width="36" height="10" rx="3" fill="#64748b" stroke="#000000" stroke-width="7" />
      <polygon points="250,415 262,415 259,400 253,400" fill="#d97706" stroke="#000000" stroke-width="7" />
      <path d="M 230,375 C 220,375 220,390 232,390" fill="none" stroke="#eab308" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M 282,375 C 292,375 292,390 280,390" fill="none" stroke="#eab308" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M 230,370 L 282,370 L 274,400 C 268,410 244,410 238,400 Z" fill="#eab308" stroke="#000000" stroke-width="8" stroke-linejoin="round" />
      <polygon points="234,360 237,353 234,346 231,353" fill="#ffffff" />
      <polygon points="278,355 281,348 278,341 275,348" fill="#ffffff" />
    </g>
  </g>
</svg>
"""


class VoiceRecognizer(QObject):
    command_heard = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)


MENU_ITEMS = [
    {"id": "dashboard",      "icon": "🏠", "label": "Dashboard"     },
    {"id": "courses",        "icon": "📖", "label": "Courses"       },
    {"id": "quizzes",        "icon": "🏆", "label": "Quizzes"       },
    {"id": "assignments",    "icon": "📝", "label": "Assignments"   },
    {"id": "resources",      "icon": "📁", "label": "Resources"     },
    {"id": "general-tutor",  "icon": "🧠", "label": "Ask AI Tutor"  },
    {"id": "coding-tutor",   "icon": "💻", "label": "Code AI Tutor" },
    {"id": "code-puzzle",    "icon": "🧩", "label": "Code Puzzle"   },
    {"id": "jobs",           "icon": "💼", "label": "Jobs"          },
    {"id": "progress",       "icon": "📊", "label": "Progress"      },
    {"id": "physics-lab",    "icon": "⚛️", "label": "Physics Lab"   },
    {"id": "chemistry-lab",  "icon": "🧪", "label": "Chemistry Lab" },
    {"id": "biology-lab",    "icon": "🧬", "label": "Biology Lab"   },
]


class DesktopMascot(QWidget):
    def __init__(self):
        super().__init__()

        # Read config (userId, server endpoint)
        self.user_id = self.load_user_id()
        self.server_url = "ws://localhost:3000/api/ws?clientType=desktop&userId=" + self.user_id

        # Animation state attributes
        self.state = "idle"
        self.prev_state = "idle"
        self.t = 0.0
        self.eye_x = 0.0
        self.eye_y = 0.0
        self.is_dragging = False
        self.drag_position = QPoint()

        # Windows API tracking attributes
        self.active_app_seconds = 0
        self.current_active_window = ""
        self.idle_alert_triggered = False

        # Visual speech bubble attributes
        self.speech_text = ""
        self.speech_timer = QTimer()
        self.speech_timer.setSingleShot(True)
        self.speech_timer.timeout.connect(self.clear_speech)

        # Set up transparent, always-on-top window properties
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.SubWindow)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(220, 220)  # Canvas size for mascot (140x140) + speech bubble (220x60)

        # Position bot in bottom-right corner
        self.move_to_bottom_right()

        # PyQt SVG renderer setup
        self.renderer = QSvgRenderer()

        # Connect WebSocket to Next.js server
        self.socket = QWebSocket()
        self.socket.connected.connect(self.on_ws_connected)
        self.socket.disconnected.connect(self.on_ws_disconnected)
        self.socket.textMessageReceived.connect(self.on_ws_message)
        self.reconnect_timer = QTimer()
        self.reconnect_timer.timeout.connect(self.connect_websocket)
        self.reconnect_timer.start(5000)
        self.connect_websocket()

        self.is_speaking = False
        self.listening_active = False
        self.stop_listening_fn = None
        
        # Start non-blocking background speech recognition
        QTimer.singleShot(1000, self.start_listening)

        # Main animation frame update timer (60 FPS)
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_animation)
        self.timer.start(16)

        # Background system tracking timer (every 1 second)
        self.system_timer = QTimer()
        self.system_timer.timeout.connect(self.monitor_system_activity)
        self.system_timer.start(1000)

        # Periodic random interactive gestures
        self.gesture_timer = QTimer()
        self.gesture_timer.timeout.connect(self.trigger_random_gesture)
        self.gesture_timer.start(12000) # Every 12 seconds

        # Setup circular menu
        self.menu_open = False
        self.menu_buttons = []
        for item in MENU_ITEMS:
            btn = QPushButton(item["icon"], self)
            btn.setFixedSize(40, 40)
            btn.setStyleSheet("""
                QPushButton {
                    background-color: rgba(15, 23, 42, 230);
                    border: 1px solid rgba(56, 189, 248, 150);
                    border-radius: 20px;
                    color: #F8FAFC;
                    font-size: 18px;
                }
                QPushButton:hover {
                    border-color: #38BDF8;
                    background-color: rgba(56, 189, 248, 60);
                }
            """)
            btn.setToolTip(item["label"])
            btn.clicked.connect(lambda checked, page=item["id"]: self.navigate_from_menu(page))
            btn.hide()
            self.menu_buttons.append(btn)

    def start_listening(self):
        if not HAS_SPEECH or self.listening_active:
            return
        try:
            import speech_recognition as sr
            self.recognizer = sr.Recognizer()
            self.recognizer.dynamic_energy_threshold = False
            self.recognizer.energy_threshold = 280
            self.microphone = sr.Microphone()
            
            # Setup thread-safe cross-thread signal relay
            self.voice_recognizer = VoiceRecognizer(self)
            self.voice_recognizer.command_heard.connect(self.handle_voice_command)
            
            # Calibrate microphone for ambient noise in a short helper
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                
            def voice_callback(recognizer, audio):
                if getattr(self, "is_speaking", False):
                    return
                try:
                    text = recognizer.recognize_google(audio, language="en-IN").lower()
                    print(f"[Voice] Recognized speech: {text}")
                    # Thread-safe signal emit to trigger slot on GUI thread
                    self.voice_recognizer.command_heard.emit(text)
                except Exception:
                    pass

            self.stop_listening_fn = self.recognizer.listen_in_background(self.microphone, voice_callback, phrase_time_limit=4.0)
            self.listening_active = True
            print("[Voice] Background listening started.")
        except Exception as e:
            print("[Voice] Error starting background listening:", e)

    def stop_listening(self):
        if hasattr(self, "stop_listening_fn") and self.stop_listening_fn:
            try:
                self.stop_listening_fn(wait_for_stop=False)
                print("[Voice] Background listening stopped.")
            except Exception:
                pass
            self.stop_listening_fn = None
            if hasattr(self, "voice_recognizer") and self.voice_recognizer:
                try:
                    self.voice_recognizer.command_heard.disconnect(self.handle_voice_command)
                except Exception:
                    pass
                self.voice_recognizer = None
        self.listening_active = False

    def load_user_id(self):
        config_path = os.path.expandvars(r"%APPDATA%\VyomantaBot\config.json")
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    data = json.load(f)
                    if 'userId' in data:
                        return data['userId']
            except Exception:
                pass
        
        new_id = "user-" + os.getlogin() + "-" + str(int(time.time()))[-4:]
        try:
            with open(config_path, 'w') as f:
                json.dump({'userId': new_id}, f)
        except Exception:
            pass
        return new_id

    def move_to_bottom_right(self):
        screen = QApplication.primaryScreen().geometry()
        x = screen.width() - self.width() - 20
        y = screen.height() - self.height() - 60
        self.move(x, y)

    def connect_websocket(self):
        if self.socket.state() == 0:  # UnconnectedState
            print(f"[WebSocket] Connecting to {self.server_url}...")
            self.socket.open(QUrl(self.server_url))

    def on_ws_connected(self):
        print("[WebSocket] Connected successfully!")
        self.reconnect_timer.stop()

    def on_ws_disconnected(self):
        print("[WebSocket] Disconnected. Reconnecting in 5 seconds...")
        self.reconnect_timer.start(5000)

    def on_ws_message(self, message):
        try:
            msg = json.loads(message)
            print("[WebSocket] Received:", msg)
            
            if msg.get('type') == 'tab_change':
                tab = msg.get('tab')
                if tab == 'code-puzzle' or tab == 'coding-tutor':
                    self.set_state('typing')
                elif tab == 'quizzes':
                    self.set_state('writing')
                elif tab == 'courses':
                    self.set_state('reading')
                elif tab == 'resources' or tab == 'jobs':
                    self.set_state('searching')
                elif tab == 'progress':
                    self.set_state('celebrating')
                else:
                    self.set_state('idle')

            elif msg.get('type') == 'action' and msg.get('name') == 'navigateToPage':
                page = msg.get('args', {}).get('page')
                print(f"[WebSocket] Navigate request from server to: {page}")
                if page == 'code-puzzle':
                    self.set_state('typing')
                elif page == 'quizzes':
                    self.set_state('writing')
                elif page == 'courses':
                    self.set_state('reading')
                else:
                    self.set_state('idle')

            elif msg.get('type') == 'speech_response':
                text = msg.get('text')
                print(f"[WebSocket] Relayed speech response: {text}")
                self.speak(text)

        except Exception as e:
            print("[WebSocket] Message parsing error:", e)

    def set_state(self, new_state):
        if self.state != new_state:
            self.prev_state = self.state
            self.state = new_state
            print(f"[Mascot] State changed from {self.prev_state} to {self.state}")

    def clear_speech(self):
        self.speech_text = ""
        self.update()

    def finish_speaking(self):
        self.is_speaking = False
        print("[Cosmos] Finished speaking, microphone listening resumed.")
        self.start_listening()

    def speak(self, text):
        print(f"[Cosmos] Speaking: {text}")
        
        # Stop listening completely to prevent echo feedback loops
        self.stop_listening()
        self.is_speaking = True
        speak_duration = max(1500, len(text) * 90) # ~90ms per character
        QTimer.singleShot(speak_duration, self.finish_speaking)

        self.speech_text = text
        self.speech_timer.start(5000) # Show bubble for 5 seconds
        self.update() # Force repaint
        
        if SPEAKER:
            try:
                SPEAKER.Speak(text, 1) # 1 is SVSFlagsAsync (asynchronous, non-blocking)
            except Exception as e:
                print(f"[Cosmos] SpVoice Speak error: {e}")

    def trigger_random_gesture(self):
        # Trigger random animation if currently idle on the desktop
        if self.state == "idle" and not self.is_dragging:
            import random
            gestures = ["dance", "wave", "searching", "idle"]
            chosen_gesture = random.choice(gestures)
            if chosen_gesture != "idle":
                self.set_state(chosen_gesture)
                duration = random.randint(2000, 4500)
                # Revert back to idle after duration
                QTimer.singleShot(duration, lambda: self.set_state("idle") if self.state == chosen_gesture else None)

    def update_animation(self):
        self.t += 0.016
        if self.t > 1000.0:
            self.t = 0.0

        # Calculate cursor eye tracking
        cursor_pos = QCursor.pos()
        window_center = self.geometry().center()
        
        dx = cursor_pos.x() - window_center.x()
        dy = cursor_pos.y() - window_center.y()
        distance = math.sqrt(dx*dx + dy*dy)
        
        if distance > 0.1:
            angle = math.atan2(dy, dx)
            shift = min(14.0, distance * 0.04)
            self.eye_x = math.cos(angle) * shift
            self.eye_y = math.sin(angle) * shift
        else:
            self.eye_x = 0.0
            self.eye_y = 0.0

        self.update()

    def generate_svg(self):
        bot_y, bot_rot, bot_scale_y = 0.0, 0.0, 1.0
        l_arm_rot, l_arm_x, l_arm_y = 0.0, 0.0, 0.0
        r_arm_rot, r_arm_x, r_arm_y = 0.0, 0.0, 0.0
        l_leg_rot, l_leg_y = 0.0, 0.0
        r_leg_rot, r_leg_y = 0.0, 0.0

        laptop_disp = "none"
        book_disp = "none"
        clipboard_disp = "none"
        trophy_disp = "none"
        pencil_disp = "none"
        magnifier_disp = "none"

        if self.is_dragging:
            bot_y = -4.0 * math.sin(self.t * 10.0)
            bot_rot = -15.0
            l_arm_rot = -120.0
            l_arm_x, l_arm_y = 5.0, -10.0
            r_arm_rot = 120.0
            r_arm_x, r_arm_y = -5.0, -10.0
            l_leg_rot, l_leg_y = 45.0, -8.0
            r_leg_rot, r_leg_y = -45.0, -8.0
        elif self.state == "idle":
            bot_y = -6.0 * math.sin(self.t * 2.2)
            bot_rot = -1.0 * math.sin(self.t * 1.1)
            l_arm_rot = -6.0 * math.sin(self.t * 2.2)
            r_arm_rot = 6.0 * math.sin(self.t * 2.2)
        elif self.state == "dance":
            bot_y = -18.0 * abs(math.sin(self.t * 10.0))
            bot_rot = 5.0 * math.sin(self.t * 10.0)
            l_arm_rot = -55.0 + 20.0 * math.sin(self.t * 10.0)
            r_arm_rot = 55.0 - 20.0 * math.sin(self.t * 10.0)
            l_leg_rot = 15.0 * math.sin(self.t * 10.0)
            r_leg_rot = -15.0 * math.sin(self.t * 10.0)
            l_leg_y = -6.0 * abs(math.sin(self.t * 10.0))
            r_leg_y = -6.0 * abs(math.sin(self.t * 10.0))
        elif self.state == "typing":
            laptop_disp = "block"
            bot_y = -3.0 * math.sin(self.t * 8.0)
            bot_rot = 1.5 * math.sin(self.t * 8.0)
            l_arm_rot = 18.0 + 6.0 * math.sin(self.t * 30.0)
            l_arm_x = 10.0 + 4.0 * math.sin(self.t * 30.0)
            l_arm_y = 6.0 + 3.0 * math.sin(self.t * 30.0)
            r_arm_rot = -18.0 - 6.0 * math.sin(self.t * 30.0)
            r_arm_x = -10.0 - 4.0 * math.sin(self.t * 30.0)
            r_arm_y = 6.0 + 3.0 * math.sin(self.t * 30.0)
            l_leg_rot = 6.0
            r_leg_rot = -6.0
        elif self.state == "reading":
            book_disp = "block"
            bot_y = -2.0 * math.sin(self.t * 2.5)
            bot_rot = 1.5
            l_arm_rot = 22.0
            l_arm_x, l_arm_y = 12.0, 10.0
            r_arm_rot = -22.0
            r_arm_x, r_arm_y = -12.0, 10.0
            l_leg_rot = 2.0
            r_leg_rot = -2.0
        elif self.state == "writing":
            clipboard_disp = "block"
            pencil_disp = "block"
            bot_y = -2.0 * math.sin(self.t * 3.0)
            bot_rot = -1.5
            l_arm_rot = 22.0
            l_arm_x, l_arm_y = 14.0, 8.0
            r_arm_rot = -10.0 - 8.0 * math.sin(self.t * 25.0)
            r_arm_x = -15.0 - 5.0 * math.sin(self.t * 25.0)
            r_arm_y = 10.0 + 4.0 * math.sin(self.t * 25.0)
            l_leg_rot = 3.0
            r_leg_rot = -3.0
        elif self.state == "searching":
            magnifier_disp = "block"
            bot_y = -4.0 * math.sin(self.t * 3.0)
            bot_rot = 4.0 * math.sin(self.t * 3.0)
            l_arm_rot = -15.0
            r_arm_rot = 45.0 + 15.0 * math.sin(self.t * 3.0)
            r_arm_x = -10.0 - 5.0 * math.sin(self.t * 3.0)
            r_arm_y = 10.0 - 4.0 * math.sin(self.t * 3.0)
            l_leg_rot = -5.0 * math.sin(self.t * 3.0)
            r_leg_rot = 5.0 * math.sin(self.t * 3.0)
        elif self.state == "celebrating":
            trophy_disp = "block"
            bot_y = -16.0 * math.sin(self.t * 10.0)
            bot_rot = -4.0 * math.sin(self.t * 10.0)
            bot_scale_y = 1.0 + 0.04 * math.sin(self.t * 10.0)
            l_arm_rot = -45.0 - 15.0 * math.sin(self.t * 10.0)
            r_arm_rot = 45.0 + 15.0 * math.sin(self.t * 10.0)
            l_leg_rot = -22.0 * abs(math.sin(self.t * 10.0))
            r_leg_rot = 22.0 * abs(math.sin(self.t * 10.0))

        bot_transform = f"translate(0, {bot_y}) rotate({bot_rot}, 256, 256) scale(1, {bot_scale_y})"
        left_arm_transform = f"rotate({l_arm_rot}, 170, 310) translate({l_arm_x}, {l_arm_y})"
        right_arm_transform = f"rotate({r_arm_rot}, 342, 310) translate({r_arm_x}, {r_arm_y})"
        left_leg_transform = f"rotate({l_leg_rot}, 210, 412) translate(0, {l_leg_y})"
        right_leg_transform = f"rotate({r_leg_rot}, 302, 412) translate(0, {r_leg_y})"

        head_transform = f"translate({self.eye_x * 0.4}, {self.eye_y * 0.4}) rotate({self.eye_x * 0.8}, 256, 195)"
        eye_transform = f"translate({self.eye_x * 1.25}, {self.eye_y * 1.25})"
        reflection_transform = f"translate({self.eye_x * 0.7}, {self.eye_y * 0.7})"

        voice_button_color = "#38bdf8" if getattr(self, "listening_active", False) else "#ef4444"

        svg_xml = SVG_TEMPLATE.format(
            bot_transform=bot_transform,
            left_leg_transform=left_leg_transform,
            right_leg_transform=right_leg_transform,
            left_arm_transform=left_arm_transform,
            right_arm_transform=right_arm_transform,
            head_transform=head_transform,
            eye_transform=eye_transform,
            reflection_transform=reflection_transform,
            laptop_display=laptop_disp,
            book_display=book_disp,
            clipboard_display=clipboard_disp,
            trophy_display=trophy_disp,
            pencil_display=pencil_disp,
            magnifier_display=magnifier_disp,
            voice_button_color=voice_button_color
        )

        return svg_xml.encode('utf-8')

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)

        # Draw Mascot centered (x=110 if menu open else 40, y=110 if menu open else 80, w=140, h=140)
        mx = 110 if self.menu_open else 40
        my = 110 if self.menu_open else 80
        mascot_rect = QRect(mx, my, 140, 140)
        
        svg_data = self.generate_svg()
        self.renderer.load(svg_data)
        self.renderer.render(painter, QRectF(mascot_rect))

        # Render Speech Bubble if there is active text
        if hasattr(self, "speech_text") and self.speech_text:
            bx = 80 if self.menu_open else 10
            by = 40 if self.menu_open else 10
            bubble_rect = QRect(bx, by, 200, 60)
            
            # Bubble background: Dark slate with slight transparency
            painter.setBrush(QColor(15, 23, 42, 230))
            painter.setPen(QPen(QColor(56, 189, 248, 220), 2))
            painter.drawRoundedRect(bubble_rect, 10, 10)
            
            # Bubble indicator pointer (triangle pointing down at mascot's head)
            px = 180 if self.menu_open else 110
            py = 100 if self.menu_open else 70
            pointer = QPolygon([
                QPoint(px - 10, py),
                QPoint(px + 10, py),
                QPoint(px, py + 10)
            ])
            painter.drawPolygon(pointer)
            
            # Draw Text inside the bubble (white)
            painter.setPen(QColor(248, 250, 252))
            font = painter.font()
            font.setPointSize(9)
            font.setBold(True)
            painter.setFont(font)
            
            text_rect = bubble_rect.adjusted(8, 6, -8, -6)
            painter.drawText(text_rect, Qt.AlignCenter | Qt.TextWordWrap, self.speech_text)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            pos = event.pos()
            cx = 180 if self.menu_open else 110
            cy = 204 if self.menu_open else 174
            dx = pos.x() - cx
            dy = pos.y() - cy
            dist = math.sqrt(dx*dx + dy*dy)
            
            # Check if clicked chest voice button
            if dist < 18:
                if getattr(self, "listening_active", False):
                    self.stop_listening()
                    self.speak("Voice recognition disabled.")
                else:
                    self.start_listening()
                    self.speak("Voice recognition enabled.")
                event.accept()
                return

            # Click & Drag tracking
            self.click_start_pos = event.globalPos()
            self.is_drag_action = False
            self.is_dragging = True
            self.drag_position = event.globalPos() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.LeftButton and self.is_dragging:
            if (event.globalPos() - self.click_start_pos).manhattanLength() > 5:
                self.is_drag_action = True
            self.move(event.globalPos() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event):
        if self.is_dragging:
            self.is_dragging = False
            # If mouse didn't drag, toggle the circular menu
            if not self.is_drag_action:
                self.toggle_menu()
            event.accept()

    def contextMenuEvent(self, event):
        menu = QMenu(self)
        
        open_action = QAction("Open AI Tutor", self)
        open_action.triggered.connect(lambda: self.launch_lms_site())
        menu.addAction(open_action)

        menu.addSeparator()
        
        states_menu = menu.addMenu("Set Mascot State")
        for st in ["idle", "dance", "typing", "reading", "writing", "searching", "celebrating"]:
            act = QAction(st.capitalize(), self)
            act.triggered.connect(lambda checked, s=st: self.set_state(s))
            states_menu.addAction(act)

        menu.addSeparator()

        speech_status = "Listening Active" if HAS_SPEECH else "Voice Recognition Disabled"
        speech_info = QAction(speech_status, self)
        speech_info.setEnabled(False)
        menu.addAction(speech_info)
        
        exit_action = QAction("Exit mascot", self)
        exit_action.triggered.connect(QApplication.quit)
        menu.addAction(exit_action)
        
        menu.exec_(event.globalPos())

    def launch_lms_site(self, page=""):
        url = "http://localhost:3000"
        if page:
            url += f"/{page}"
        url += f"?clientType=web&userId={self.user_id}"
        print(f"[Mascot] Launching browser: {url}")
        webbrowser.open(url)

    def handle_voice_command(self, text):
        print(f"[Mascot] Parsing voice command: '{text}'")
        
        target_page = None
        if "puzzle" in text or "code puzzle" in text:
            target_page = "code-puzzle"
        elif "quiz" in text or "quizzes" in text:
            target_page = "quizzes"
        elif "course" in text or "courses" in text:
            target_page = "courses"
        elif "progress" in text or "dashboard" in text:
            target_page = "progress"
        elif "general tutor" in text or "ask tutor" in text or "socratic" in text:
            target_page = "general-tutor"
        elif "resources" in text:
            target_page = "resources"

        is_control_command = False

        # Check for navigation or opening
        if "open" in text or "go to" in text or "launch" in text or "navigate" in text:
            is_control_command = True
            if target_page:
                if self.socket.isValid():
                    print(f"[Mascot] WebSocket connected. Relaying navigation target: {target_page}")
                    payload = {
                        "type": "control",
                        "action": "navigateToPage",
                        "page": target_page
                    }
                    self.socket.sendTextMessage(json.dumps(payload))
                    self.speak(f"Going to {target_page}!")
                    # Set pose immediately
                    if target_page == "code-puzzle":
                        self.set_state("typing")
                    elif target_page == "quizzes":
                        self.set_state("writing")
                    elif target_page == "courses":
                        self.set_state("reading")
                else:
                    self.speak(f"Opening AI Tutor on {target_page}!")
                    self.launch_lms_site(target_page)
            else:
                if "tutor" in text or "website" in text or "vyomanta" in text or "cosmos" in text or "vedika" in text:
                    self.speak("Opening VEDIKA AI Tutor!")
                    self.launch_lms_site()
                    
        elif "dance" in text:
            is_control_command = True
            self.set_state("dance")
            self.speak("Let's dance!")
            QTimer.singleShot(5000, lambda: self.set_state("idle"))
            
        elif "stop" in text or "rest" in text or "idle" in text:
            is_control_command = True
            self.set_state("idle")
            self.speak("Going to sleep now.")

        # If it is a general tutoring query, relay it to Gemini via WebSocket
        if not is_control_command:
            if self.socket.isValid():
                print(f"[Mascot] Relaying chat command to web client: {text}")
                payload = {
                    "type": "chat_command",
                    "text": text
                }
                self.socket.sendTextMessage(json.dumps(payload))
                self.speak("Thinking...")
            else:
                self.speak("Connect me to the website first!")

    def navigate_from_menu(self, page):
        if self.socket.isValid():
            payload = {
                "type": "control",
                "action": "navigateToPage",
                "page": page
            }
            self.socket.sendTextMessage(json.dumps(payload))
            self.speak(f"Navigating to {page.replace('-', ' ')}!")
        else:
            self.speak("Not connected to website!")
        self.toggle_menu()

    def toggle_menu(self):
        if hasattr(self, 'anim_timer') and self.anim_timer:
            try:
                self.anim_timer.stop()
            except Exception:
                pass
        
        self.menu_open = not self.menu_open
        if self.menu_open:
            pos = self.pos()
            self.orig_pos = pos
            self.setFixedSize(360, 360)
            self.move(pos.x() - 70, pos.y() - 30)
            
            radius = 130
            center_x = 180
            center_y = 180
            
            self.anim_step = 0.0
            self.anim_timer = QTimer(self)
            
            def animate_out():
                self.anim_step += 0.1
                if self.anim_step >= 1.0:
                    self.anim_step = 1.0
                    self.anim_timer.stop()
                
                curr_r = radius * self.anim_step
                for idx, btn in enumerate(self.menu_buttons):
                    angle = -math.pi / 2 + (idx * (2 * math.pi)) / len(self.menu_buttons)
                    bx = int(center_x + curr_r * math.cos(angle) - 20)
                    by = int(center_y + curr_r * math.sin(angle) - 20)
                    btn.move(bx, by)
                    btn.show()
            
            self.anim_timer.timeout.connect(animate_out)
            self.anim_timer.start(16)
        else:
            for btn in self.menu_buttons:
                btn.hide()
            pos = self.pos()
            self.setFixedSize(220, 220)
            self.move(pos.x() + 70, pos.y() + 30)

    def monitor_system_activity(self):
        if HAS_WIN32:
            try:
                hwnd = win32gui.GetForegroundWindow()
                title = win32gui.GetWindowText(hwnd)
                
                title_lower = title.lower()
                matched = False
                
                # 1. Coding mimicry (Visual Studio Code, Python, Javascript files, etc.)
                if any(x in title_lower for x in ["visual studio", "vscode", "code.exe", ".py", ".js", ".html", ".css", ".cpp", ".java"]):
                    self.set_state("typing")
                    matched = True
                
                # 2. Studying / Reading mimicry (PDFs, Adobe Acrobat, Word Documents)
                elif any(x in title_lower for x in ["pdf", "acrobat", "reader", "document", "word", "textbook"]):
                    self.set_state("reading")
                    matched = True
                
                # 3. Spreadsheets / Data mimicry (Excel, spreadsheets, CSV files)
                elif any(x in title_lower for x in ["excel", "spreadsheet", "csv", "xlsx"]):
                    self.set_state("writing")
                    matched = True
                
                # 4. Standard Browser Whitelist (only increments timers, let ws control animations)
                elif any(x in title_lower for x in ["chrome", "edge", "firefox", "browser"]):
                    if not self.socket.isValid():
                        self.set_state("idle")
                    matched = True

                if matched:
                    self.active_app_seconds += 1
                    if self.active_app_seconds == 2700: # 45 minutes of continuous study
                        QMessageBox.information(
                            self, 
                            "Rest reminder!", 
                            "Take a few minutes of rest! You have been working for so long."
                        )
                else:
                    # Ignore other personal applications (e.g. WhatsApp, Discord, Spotify)
                    self.set_state("idle")
                    self.active_app_seconds = 0
                    
            except Exception:
                pass

        self.connect_websocket()

    def closeEvent(self, event):
        if self.voice_thread:
            self.voice_thread.stop()
        self.socket.close()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    mascot = DesktopMascot()
    mascot.show()
    sys.exit(app.exec_())

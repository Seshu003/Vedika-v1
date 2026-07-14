import sys
import os
import ctypes
import time
import math
import webbrowser
import json
import http.server
import socketserver
import threading

# Hide console window immediately at startup if running with console
if sys.platform == 'win32':
    try:
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
    except Exception:
        pass

# Redirect standard file descriptors to NUL in windowless mode to prevent crashes
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
            
            class DummyWriter:
                def write(self, *args, **kwargs): pass
                def flush(self, *args, **kwargs): pass
            sys.stdout = DummyWriter()
            sys.stderr = DummyWriter()
    except Exception:
        pass

from PyQt5.QtCore import Qt, QTimer, QPoint, QUrl, QObject, pyqtSignal, pyqtSlot
from PyQt5.QtWidgets import QApplication, QWidget, QMenu, QAction, QMessageBox, QVBoxLayout
from PyQt5.QtGui import QCursor
from PyQt5.QtWebSockets import QWebSocket
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWebChannel import QWebChannel

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


class MascotHTTPServer(threading.Thread):
    """Lightweight local HTTP server running in a background thread to serve 3D models and Three.js files."""
    def __init__(self, directory):
        super().__init__(daemon=True)
        self.directory = directory
        self.port = 0
        self.server = None

    def run(self):
        from http.server import SimpleHTTPRequestHandler
        dir_path = self.directory
        
        class CustomHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=dir_path, **kwargs)
            def log_message(self, format, *args):
                pass # Suppress command line log floods
                
        self.server = socketserver.TCPServer(("127.0.0.1", 0), CustomHandler)
        self.port = self.server.server_address[1]
        self.server.serve_forever()

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()


class WebBridge(QObject):
    """QtWebChannel bridge exposing slots and signals for Javascript-to-Python communication."""
    drag_started = pyqtSignal(int, int)
    dragged = pyqtSignal(int, int)
    drag_stopped = pyqtSignal()
    menu_navigated = pyqtSignal(str)
    menu_toggled = pyqtSignal(bool)
    voice_toggled = pyqtSignal()
    log_relayed = pyqtSignal(str)

    @pyqtSlot(int, int)
    def startDrag(self, x, y):
        self.drag_started.emit(x, y)

    @pyqtSlot(int, int)
    def drag(self, x, y):
        self.dragged.emit(x, y)

    @pyqtSlot()
    def stopDrag(self):
        self.drag_stopped.emit()

    @pyqtSlot(str)
    def navigate_from_menu(self, page):
        self.menu_navigated.emit(page)

    @pyqtSlot(bool)
    def toggleMenuState(self, open_state):
        self.menu_toggled.emit(open_state)

    @pyqtSlot()
    def toggleVoiceListening(self):
        self.voice_toggled.emit()

    @pyqtSlot(str)
    def log(self, msg):
        self.log_relayed.emit(msg)


class VoiceRecognizer(QObject):
    command_heard = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)


class DesktopMascot(QWidget):
    def __init__(self):
        super().__init__()

        # Read config (userId)
        self.user_id = self.load_user_id()
        self.server_url = "ws://localhost:3000/api/ws?clientType=desktop&userId=" + self.user_id

        # State attributes
        self.state = "idle"
        self.prev_state = "idle"
        self.is_dragging = False
        self.drag_position = QPoint()
        self.menu_open = False
        self.is_speaking = False
        self.listening_active = False
        self.stop_listening_fn = None
        self.page_loaded = False

        # Windows API tracking attributes
        self.active_app_seconds = 0
        self.current_active_window = ""
        self.idle_alert_triggered = False

        # Set up transparent, always-on-top window properties
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.SubWindow)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(220, 220)  # Default sized canvas for 3D mascot + speech bubble

        # Position bot in bottom-right corner
        self.move_to_bottom_right()

        # Setup layout and Transparent Web view
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.web_view = QWebEngineView(self)
        self.web_view.setAttribute(Qt.WA_TranslucentBackground)
        self.web_view.page().setBackgroundColor(Qt.transparent)
        
        # Disable default chrome context menu and connect to custom Qt menu
        self.web_view.setContextMenuPolicy(Qt.CustomContextMenu)
        self.web_view.customContextMenuRequested.connect(self.show_context_menu)
        layout.addWidget(self.web_view)

        # Start background HTTP Server
        desktop_dir = os.path.dirname(os.path.abspath(__file__))
        self.http_server = MascotHTTPServer(desktop_dir)
        self.http_server.start()
        
        # Sleep briefly to ensure socket binding completed
        time.sleep(0.1)

        # Setup Bidirectional QWebChannel Bridge
        self.channel = QWebChannel(self)
        self.bridge = WebBridge()
        self.channel.registerObject("pybridge", self.bridge)
        self.web_view.page().setWebChannel(self.channel)

        # Connect bridge signals to slots
        self.bridge.drag_started.connect(self.js_start_drag)
        self.bridge.dragged.connect(self.js_drag)
        self.bridge.drag_stopped.connect(self.js_stop_drag)
        self.bridge.menu_navigated.connect(self.navigate_from_menu)
        self.bridge.menu_toggled.connect(self.js_menu_toggled)
        self.bridge.voice_toggled.connect(self.js_voice_toggled)
        self.bridge.log_relayed.connect(lambda msg: print(f"[JS] {msg}"))

        # Monitor page loading status
        self.web_view.loadFinished.connect(self.on_load_finished)

        # Load transparent HTML page containing Three.js mascot
        local_url = f"http://127.0.0.1:{self.http_server.port}/index.html"
        print(f"[Mascot] Loading WebGL mascot from: {local_url}")
        self.web_view.load(QUrl(local_url))

        # Connect WebSocket to Next.js server
        self.socket = QWebSocket()
        self.socket.connected.connect(self.on_ws_connected)
        self.socket.disconnected.connect(self.on_ws_disconnected)
        self.socket.textMessageReceived.connect(self.on_ws_message)
        self.reconnect_timer = QTimer()
        self.reconnect_timer.timeout.connect(self.connect_websocket)
        self.reconnect_timer.start(5000)
        self.connect_websocket()
        
        # Start non-blocking background speech recognition
        QTimer.singleShot(1500, self.start_listening)

        # Cursor tracking update timer (30 FPS)
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_look_at)
        self.timer.start(33)

        # Background system tracking timer (every 1 second)
        self.system_timer = QTimer()
        self.system_timer.timeout.connect(self.monitor_system_activity)
        self.system_timer.start(1000)

        # Periodic random interactive gestures
        self.gesture_timer = QTimer()
        self.gesture_timer.timeout.connect(self.trigger_random_gesture)
        self.gesture_timer.start(12000) # Every 12 seconds

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

    def on_load_finished(self, success):
        if success:
            self.page_loaded = True
            print("[Mascot] Transparent WebGL page loaded successfully!")
            # Synchronize initial states to JS context
            self.run_js(f"setVoiceHudActive({1 if self.listening_active else 0});")
            self.run_js(f"setMascotState('{self.state}');")
        else:
            print("[Mascot] ERROR: Failed to load transparent WebGL page!")

    def run_js(self, code):
        if getattr(self, "page_loaded", False):
            self.web_view.page().runJavaScript(code)

    def set_state(self, new_state):
        if self.state != new_state:
            self.prev_state = self.state
            self.state = new_state
            print(f"[Mascot] State changed from {self.prev_state} to {self.state}")
            self.run_js(f"setMascotState('{new_state}');")

    def speak(self, text):
        print(f"[Cosmos] Speaking: {text}")
        
        # Stop listening completely to prevent echo feedback loops
        self.stop_listening()
        self.is_speaking = True
        speak_duration = max(1500, len(text) * 90) # ~90ms per character
        QTimer.singleShot(speak_duration, self.finish_speaking)

        # Show speech bubble inside the web view
        escaped_text = text.replace("'", "\\'").replace('"', '\\"')
        self.run_js(f"showSpeechBubble('{escaped_text}');")
        
        if SPEAKER:
            try:
                SPEAKER.Speak(text, 1) # 1 is SVSFlagsAsync (asynchronous, non-blocking)
            except Exception as e:
                print(f"[Cosmos] SpVoice Speak error: {e}")

    def finish_speaking(self):
        self.is_speaking = False
        print("[Cosmos] Finished speaking, microphone listening resumed.")
        self.start_listening()

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

    def update_look_at(self):
        if self.is_dragging or self.menu_open or not self.page_loaded:
            return

        # Calculate look coordinates relative to window center
        cursor_pos = QCursor.pos()
        window_center = self.geometry().center()
        
        dx = cursor_pos.x() - window_center.x()
        dy = cursor_pos.y() - window_center.y()
        
        # Normalize target pointer coordinate with range [-1.0, 1.0] using 300px radius
        look_x = max(-1.0, min(1.0, dx / 300.0))
        look_y = max(-1.0, min(1.0, dy / 300.0))
        
        self.run_js(f"pointer.x = {look_x}; pointer.y = {-look_y};")

    def js_start_drag(self, x, y):
        self.is_dragging = True
        self.drag_position = QCursor.pos() - self.pos()
        self.run_js("isDragging = true;")

    def js_drag(self, x, y):
        if self.is_dragging:
            self.move(QCursor.pos() - self.drag_position)

    def js_stop_drag(self):
        self.is_dragging = False
        self.run_js("isDragging = false;")

    def js_menu_toggled(self, open_state):
        self.menu_open = open_state
        pos = self.pos()
        if open_state:
            # Expand window to fit radial menu layout (symmetrical center)
            self.setFixedSize(400, 400)
            self.move(pos.x() - 90, pos.y() - 90)
        else:
            # Collapse window back to smaller mascot layout
            self.setFixedSize(220, 220)
            self.move(pos.x() + 90, pos.y() + 90)

    def js_voice_toggled(self):
        if self.listening_active:
            self.stop_listening()
            self.speak("Voice recognition disabled.")
        else:
            self.start_listening()
            self.speak("Voice recognition enabled.")

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

    def launch_lms_site(self, page=""):
        url = "http://localhost:3000"
        if page:
            url += f"/{page}"
        url += f"?clientType=web&userId={self.user_id}"
        print(f"[Mascot] Launching browser: {url}")
        webbrowser.open(url)

    def start_listening(self):
        if not HAS_SPEECH or self.listening_active:
            return
        try:
            import speech_recognition as sr
            self.recognizer = sr.Recognizer()
            self.recognizer.dynamic_energy_threshold = False
            self.recognizer.energy_threshold = 280
            self.microphone = sr.Microphone()
            
            self.voice_recognizer = VoiceRecognizer(self)
            self.voice_recognizer.command_heard.connect(self.handle_voice_command)
            
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                
            def voice_callback(recognizer, audio):
                if getattr(self, "is_speaking", False):
                    return
                try:
                    text = recognizer.recognize_google(audio, language="en-IN").lower()
                    print(f"[Voice] Recognized speech: {text}")
                    self.voice_recognizer.command_heard.emit(text)
                except Exception:
                    pass

            self.stop_listening_fn = self.recognizer.listen_in_background(self.microphone, voice_callback, phrase_time_limit=4.0)
            self.listening_active = True
            self.run_js("setVoiceHudActive(true);")
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
        self.run_js("setVoiceHudActive(false);")

    def monitor_system_activity(self):
        if HAS_WIN32:
            try:
                hwnd = win32gui.GetForegroundWindow()
                title = win32gui.GetWindowText(hwnd)
                
                title_lower = title.lower()
                matched = False
                
                # Coding tracking
                if any(x in title_lower for x in ["visual studio", "vscode", "code.exe", ".py", ".js", ".html", ".css", ".cpp", ".java"]):
                    self.set_state("typing")
                    matched = True
                
                # Study tracking
                elif any(x in title_lower for x in ["pdf", "acrobat", "reader", "document", "word", "textbook"]):
                    self.set_state("reading")
                    matched = True
                
                # Spreadsheet tracking
                elif any(x in title_lower for x in ["excel", "spreadsheet", "csv", "xlsx"]):
                    self.set_state("writing")
                    matched = True
                
                # Browser tracking
                elif any(x in title_lower for x in ["chrome", "edge", "firefox", "browser"]):
                    if not self.socket.isValid():
                        self.set_state("idle")
                    matched = True

                if matched:
                    self.active_app_seconds += 1
                    if self.active_app_seconds == 2700: # 45 minutes
                        QMessageBox.information(
                            self, 
                            "Rest reminder!", 
                            "Take a few minutes of rest! You have been working for so long."
                        )
                else:
                    self.set_state("idle")
                    self.active_app_seconds = 0
            except Exception:
                pass

        self.connect_websocket()

    def show_context_menu(self, pos):
        global_pos = self.web_view.mapToGlobal(pos)
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
        
        menu.exec_(global_pos)

    def closeEvent(self, event):
        if hasattr(self, "http_server") and self.http_server:
            self.http_server.stop()
        self.stop_listening()
        self.socket.close()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    mascot = DesktopMascot()
    mascot.show()
    sys.exit(app.exec_())

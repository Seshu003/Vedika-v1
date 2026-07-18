# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop\\desktop_mascot.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['win32com', 'win32com.client', 'speech_recognition', 'PyQt5.QtSvg', 'PyQt5.QtWebSockets'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torch', 'tensorflow', 'numpy', 'scipy', 'pandas', 'pyarrow', 'cv2', 'matplotlib', 'IPython'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='desktop_mascot',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

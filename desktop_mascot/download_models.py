import os
import sys
import urllib.request

def get_data_dir():
    d = os.path.join(os.path.expanduser("~"), ".vedika_mascot")
    os.makedirs(d, exist_ok=True)
    return d

def download_piper():
    print("=== DOWNLOADING PIPER TTS MODEL ===")
    models_dir = os.path.join(get_data_dir(), "models")
    os.makedirs(models_dir, exist_ok=True)
    
    model_path = os.path.join(models_dir, "en_US-lessac-medium.onnx")
    config_path = os.path.join(models_dir, "en_US-lessac-medium.onnx.json")
    
    base_url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium"
    
    def download_file(url, dest_path):
        print(f"Downloading {url} -> {dest_path}...")
        try:
            urllib.request.urlretrieve(url, dest_path)
            print("Download complete.")
        except Exception as e:
            print(f"Error downloading: {e}")
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise

    if not os.path.exists(model_path):
        download_file(f"{base_url}/en_US-lessac-medium.onnx", model_path)
    else:
        print("Piper model .onnx file already exists.")

    if not os.path.exists(config_path):
        download_file(f"{base_url}/en_US-lessac-medium.onnx.json", config_path)
    else:
        print("Piper config .json file already exists.")

def download_whisper():
    print("\n=== DOWNLOADING WHISPER STT MODEL ===")
    whisper_dir = os.path.join(get_data_dir(), "models", "whisper-tiny.en")
    os.makedirs(whisper_dir, exist_ok=True)
    
    try:
        from huggingface_hub import snapshot_download
        print("Downloading Systran/faster-whisper-tiny.en weights from Hugging Face...")
        # local_dir_use_symlinks=False avoids Windows Dev Mode/Admin warnings completely!
        snapshot_download(
            repo_id="Systran/faster-whisper-tiny.en",
            local_dir=whisper_dir,
            local_dir_use_symlinks=False
        )
        print(f"Whisper model downloaded successfully to: {whisper_dir}")
    except ImportError:
        print("huggingface_hub package is not installed. Please run: pip install huggingface-hub")
    except Exception as e:
        print(f"Error downloading Whisper model: {e}")

if __name__ == "__main__":
    download_piper()
    download_whisper()
    print("\n🎉 Model setup complete! Models are fully prepared in ~/.vedika_mascot/models/")

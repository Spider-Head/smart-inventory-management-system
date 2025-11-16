import serial
import requests
import json
import time

# Configure your serial and server settings
SERIAL_PORT = "COM3"   # <-- change this to your Arduino COM port
BAUD_RATE = 9600
DJANGO_URL = "http://127.0.0.1:8000/inventory/api/iot-data/"  # your Django endpoint

def main():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        print(f"🔌 Connected to {SERIAL_PORT}")
        time.sleep(2)  # wait for Arduino to initialize

        while True:
            line = ser.readline().decode('utf-8').strip()
            if line:
                print("📥 Received:", line)
                try:
                    data = json.loads(line)
                    if "temperature" in data and "humidity" in data:
                        response = requests.post(DJANGO_URL, json=data)
                        print("📤 Sent to Django:", response.status_code, response.text)
                except json.JSONDecodeError:
                    print("⚠️ Invalid JSON:", line)
            time.sleep(3)
    except serial.SerialException as e:
        print(f"❌ Serial error: {e}")
    except KeyboardInterrupt:
        print("\n🛑 Stopped manually.")

if __name__ == "__main__":
    main()

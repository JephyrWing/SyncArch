"""One Waitress process; wait for the existing DB and apply forward migrations."""
import subprocess
import sys
import time


def main():
    for attempt in range(30):
        ready = subprocess.run([sys.executable, "-m", "flask", "--app", "app:create_app", "db-check"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if ready.returncode == 0:
            break
        if attempt == 29:
            raise SystemExit("Database was not ready; application not started (credentials suppressed).")
        time.sleep(2)
    subprocess.run([sys.executable, "-m", "flask", "--app", "app:create_app", "db", "upgrade"], check=True)
    # Presence is process-local. Do not add workers/replicas without shared presence storage.
    from waitress import serve
    from wsgi import app
    serve(app, host="0.0.0.0", port=5000, threads=8, clear_untrusted_proxy_headers=True)


if __name__ == "__main__":
    main()

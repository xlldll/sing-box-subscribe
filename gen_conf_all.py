#!/usr/bin/env python3
import subprocess
import time

def run_task(name, path):
    print(f"\n=== Running {name} ({path}) ===")
    try:
        result = subprocess.run(
            ["python", path],
            check=True,
            capture_output=True,
            text=True
        )
        print(f"[OK] {name} finished successfully.")
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] {name} failed!!")
        print("Exit code:", e.returncode)
        print("Stdout:", e.stdout)
        print("Stderr:", e.stderr)
    print("=====================================")

print(">>> Start tasks...")

run_task("A", "conf-ax6000-1.12.12/merge.py")
time.sleep(3)

run_task("B", "conf-ios-1.12.12/merge.py")
time.sleep(3)

run_task("C", "conf-mac-1.12.12/merge.py")

print("\n>>> All tasks finished!")
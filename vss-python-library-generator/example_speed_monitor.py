#!/usr/bin/env python3
"""
Simple Speed Monitor Example
Demonstrates vehicle library integration in deployed Python apps

This app monitors vehicle speed and prints it every second.
Works when deployed via vehicle-edge-runtime Python deployment.
"""

import asyncio
from vehicle import vehicle

async def main():
    print("=== Speed Monitor App ===")
    print("Monitoring vehicle speed...")
    print("Press Ctrl+C to stop\n")

    while True:
        try:
            # Get current speed from vehicle
            speed_data = await vehicle.Speed.get()

            if speed_data.value is not None:
                speed = speed_data.value
                print(f"Current Speed: {speed} km/h")

                # Warning if speed is high
                if speed > 120:
                    print("  ⚠️  High speed warning!")
            else:
                print("Speed data not available")

            # Wait 1 second before next reading
            await asyncio.sleep(1)

        except Exception as e:
            print(f"Error reading speed: {e}")
            print("Retrying in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nSpeed monitor stopped by user")

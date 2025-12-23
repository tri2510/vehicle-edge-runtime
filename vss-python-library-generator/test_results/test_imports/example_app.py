#!/usr/bin/env python3
"""
Example vehicle app using generated vehicle library
"""
import asyncio
import signal
from sdv.vehicle_app import VehicleApp
from vehicle import Vehicle, vehicle

class ExampleApp(VehicleApp):
    def __init__(self, vehicle_client: Vehicle):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        print("Vehicle app started")
        print("Available vehicle paths:")

        # List some common paths
        paths = [
            "Vehicle.Body.Lights.Beam.Low.IsOn",
            "Vehicle.Speed",
            "Vehicle.Cabin.Door.Row1.LeftSide.IsOpen",
        ]

        for path in paths:
            print(f"  - {path}")

        while True:
            await asyncio.sleep(5)
            print("App running...")

async def main():
    vehicle_app = ExampleApp(vehicle)
    await vehicle_app.run()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGTERM, loop.stop)
    loop.run_until_complete(main())
    loop.close()

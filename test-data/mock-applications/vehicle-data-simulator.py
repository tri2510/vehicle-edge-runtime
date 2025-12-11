#!/usr/bin/env python3
"""
Vehicle data simulation application.
"""

import asyncio
import json
import time
from datetime import datetime

class VehicleDataSimulator:
    def __init__(self):
        self.vehicle_data = {
            'Vehicle.Speed': 0.0,
            'Vehicle.Body.Lights.IsLowBeamOn': False,
            'Vehicle.Body.Lights.IsHighBeamOn': False,
            'Vehicle.Powertrain.Transmission.CurrentGear': 1,
            'Vehicle.ADAS.ABS.IsActive': False,
            'Vehicle.Cabin.Infotainment.HMI.CurrentLanguage': 'en-US'
        }

    async def simulate(self):
        print("🚗 Vehicle data simulator started")

        for i in range(10):
            # Update vehicle data
            self.vehicle_data['Vehicle.Speed'] = min(120.0, max(0.0, self.vehicle_data['Vehicle.Speed'] + 10))
            self.vehicle_data['Vehicle.Body.Lights.IsLowBeamOn'] = i > 3
            self.vehicle_data['Vehicle.Powertrain.Transmission.CurrentGear'] = min(5, int(self.vehicle_data['Vehicle.Speed'] / 20) + 1)

            print(f"📊 Update {i+1}/10 - Speed: {self.vehicle_data['Vehicle.Speed']:.1f} km/h")
            await asyncio.sleep(0.5)

        print("✅ Vehicle data simulation completed")

async def main():
    simulator = VehicleDataSimulator()
    await simulator.simulate()

if __name__ == "__main__":
    asyncio.run(main())

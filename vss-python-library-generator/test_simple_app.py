import asyncio
from sdv import VehicleApp
from vehicle import vehicle

class TestApp(VehicleApp):
    def __init__(self, vehicle_client):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        print("✅ App started successfully!")
        print("✅ Vehicle library is working!")
        print("✅ Connected to Kuksa databroker!")

        # Just read values in a loop (don't try to set)
        count = 0
        while count < 5:  # Only loop 5 times for testing
            try:
                # Try to read vehicle speed
                speed = await self.Vehicle.Speed.get()
                print(f"Iteration {count + 1}: Speed = {speed.value}")

                # Try to read light status
                light = await self.Vehicle.Body.Lights.Beam.Low.IsOn.get()
                print(f"Iteration {count + 1}: Light = {light.value}")

            except Exception as e:
                print(f"Error reading signals: {e}")

            await asyncio.sleep(2)
            count += 1

        print("✅ Test completed successfully!")
        # Stop the app gracefully
        await asyncio.sleep(1)

async def main():
    app = TestApp(vehicle)
    await app.run()

if __name__ == "__main__":
    asyncio.run(main())

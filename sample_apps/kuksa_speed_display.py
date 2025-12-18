#!/usr/bin/env python3
"""
Sample Vehicle Edge Runtime Application
Real-time Vehicle Speed Display using KUKSA Client

This app demonstrates the smart deployment features:
- Auto-detection of kuksa-client dependency
- Vehicle signal subscription
- Real-time data processing and display
"""

import asyncio
import json
import time
from datetime import datetime
import logging

# These imports will be auto-detected by the smart deployment system
from kuksa_client import KuksaClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SpeedDisplayApp:
    """Vehicle Speed Display Application"""

    def __init__(self):
        self.kuksa_server = "localhost:55555"
        self.speed_data = []
        self.max_readings = 10
        self.running = True

    async def connect_to_kuksa(self):
        """Connect to KUKSA databroker"""
        try:
            logger.info("Connecting to KUKSA databroker...")
            client = KuksaClient(self.kuksa_server)
            await client.connect()
            logger.info("✅ Connected to KUKSA databroker")
            return client
        except Exception as e:
            logger.error(f"❌ Failed to connect to KUKSA: {e}")
            # Fallback: Use mock data for development
            return MockKuksaClient()

    async def subscribe_to_speed(self, client):
        """Subscribe to vehicle speed updates"""
        try:
            logger.info("Subscribing to Vehicle.Speed signal...")

            # Subscribe to speed updates
            subscription = await client.subscribe({
                "path": "Vehicle.Speed",
                "action": "subscribe"
            })

            logger.info("✅ Subscribed to Vehicle.Speed")
            return subscription

        except Exception as e:
            logger.error(f"❌ Failed to subscribe to speed: {e}")
            return None

    def process_speed_data(self, speed_value):
        """Process and store speed data"""
        try:
            speed_kmh = float(speed_value)
            speed_mph = speed_kmh * 0.621371  # Convert to MPH

            reading = {
                "timestamp": datetime.now().isoformat(),
                "speed_kmh": speed_kmh,
                "speed_mph": speed_mph
            }

            self.speed_data.append(reading)

            # Keep only recent readings
            if len(self.speed_data) > self.max_readings:
                self.speed_data = self.speed_data[-self.max_readings:]

            return reading

        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid speed data: {speed_value}, error: {e}")
            return None

    def display_speed_info(self, reading):
        """Display speed information"""
        if reading:
            print(f"🚗 Speed: {reading['speed_kmh']:.1f} km/h ({reading['speed_mph']:.1f} mph)")
            print(f"   Time: {reading['timestamp']}")

            # Show average speed
            if len(self.speed_data) > 1:
                avg_kmh = sum(r['speed_kmh'] for r in self.speed_data) / len(self.speed_data)
                avg_mph = sum(r['speed_mph'] for r in self.speed_data) / len(self.speed_data)
                print(f"   Average: {avg_kmh:.1f} km/h ({avg_mph:.1f} mph)")

            print("-" * 50)

    async def handle_speed_updates(self, subscription):
        """Handle real-time speed updates"""
        try:
            async for update in subscription:
                if not self.running:
                    break

                if 'value' in update and update['value'] is not None:
                    reading = self.process_speed_data(update['value'])
                    self.display_speed_info(reading)
                else:
                    logger.debug("Received empty speed update")

        except Exception as e:
            logger.error(f"Error handling speed updates: {e}")

    async def run_simulation(self, client):
        """Run with simulated speed data for development/testing"""
        logger.info("🧪 Running in simulation mode...")

        # Simulate speed values
        simulated_speeds = [0, 15, 30, 45, 60, 75, 90, 80, 65, 50, 35, 20, 0]

        while self.running:
            for speed in simulated_speeds:
                if not self.running:
                    break

                # Simulate speed update
                update = {"value": speed}
                reading = self.process_speed_data(speed)
                self.display_speed_info(reading)

                await asyncio.sleep(2)  # Update every 2 seconds

    async def run(self):
        """Main application loop"""
        logger.info("🚀 Starting Vehicle Speed Display Application")
        print("=" * 50)
        print("Vehicle Edge Runtime - Speed Display App")
        print("=" * 50)

        try:
            # Connect to KUKSA
            client = await self.connect_to_kuksa()

            # Try to subscribe to real speed data
            subscription = await self.subscribe_to_speed(client)

            if subscription:
                logger.info("📡 Listening for real vehicle speed data...")
                await self.handle_speed_updates(subscription)
            else:
                logger.info("🎮 Running in simulation mode...")
                await self.run_simulation(client)

        except KeyboardInterrupt:
            logger.info("🛑 Application stopped by user")
        except Exception as e:
            logger.error(f"❌ Application error: {e}")
        finally:
            self.running = False
            logger.info("🏁 Vehicle Speed Display App finished")


class MockKuksaClient:
    """Mock KUKSA client for development/testing"""

    async def connect(self):
        """Mock connection"""
        logger.info("🧪 Connected to mock KUKSA client")
        return True

    async def subscribe(self, signal_config):
        """Mock subscription - returns simulated data generator"""
        logger.info("🧪 Subscribed to mock Vehicle.Speed")

        async def mock_generator():
            speeds = [0, 25, 50, 75, 100, 80, 60, 40, 20, 0]
            i = 0
            while True:
                yield {"value": speeds[i % len(speeds)]}
                i += 1
                await asyncio.sleep(1.5)

        return mock_generator()


async def main():
    """Main entry point"""
    app = SpeedDisplayApp()
    await app.run()


if __name__ == "__main__":
    # Run the application
    asyncio.run(main())
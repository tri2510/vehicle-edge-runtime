#!/usr/bin/env python3
"""
Simple Mock Service - Echoes actuator target values to current values
This version doesn't require VSS metadata - it just subscribes and echoes
"""

import asyncio
import logging
import os
import signal
import sys
from kuksa_client.grpc import VSSClient, Datapoint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

# Configuration
KUKSA_HOST = os.getenv("KUKSA_HOST", "127.0.0.1")
KUKSA_PORT = os.getenv("KUKSA_PORT", "55555")

# Signals to mock (from signals.json)
MOCK_SIGNALS = [
    "Vehicle.Body.Lights.Beam.High.IsOn",
    "Vehicle.Body.Lights.Beam.Low.IsOn",
    "Vehicle.Body.Hood.IsOpen",
    "Vehicle.Body.Trunk.Rear.IsOpen",
    "Vehicle.ADAS.CruiseControl.SpeedSet",
    # Note: The following signals require VSS metadata that may not be loaded
    # "Vehicle.Cabin.Door.Row1.Left.IsOpen",
    # "Vehicle.Cabin.Door.Row1.Right.IsOpen",
    # "Vehicle.Cabin.HVAC.Station.Row1.Left.FanSpeed",
    # "Vehicle.Cabin.HVAC.Station.Row2.Left.FanSpeed",
    # "Vehicle.Cabin.Seat.Row1.Pos1.Position",
]

class SimpleMockService:
    """Simple mock service that echoes target values to current values"""

    def __init__(self, host: str, port: str):
        self.client = VSSClient(host, int(port))
        self.running = False

    async def connect(self) -> bool:
        """Connect to Kuksa databroker with retries"""
        max_retries = 30
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                log.info(f"Connecting to Kuksa at {KUKSA_HOST}:{KUKSA_PORT} (attempt {attempt + 1}/{max_retries})...")
                self.client.connect()  # This is NOT async
                log.info("✅ Connected to Kuksa databroker")
                return True
            except Exception as e:
                if attempt < max_retries - 1:
                    log.warning(f"Connection failed: {e}. Retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                else:
                    log.error(f"❌ Failed to connect after {max_retries} attempts")
                    return False

    async def feed_initial_values(self):
        """Feed initial values to Kuksa"""
        log.info("Feeding initial values...")

        initial_values = {
            "Vehicle.Body.Lights.Beam.High.IsOn": Datapoint(False),
            "Vehicle.Body.Lights.Beam.Low.IsOn": Datapoint(False),
            "Vehicle.Body.Hood.IsOpen": Datapoint(False),
            "Vehicle.Body.Trunk.Rear.IsOpen": Datapoint(False),
            "Vehicle.ADAS.CruiseControl.SpeedSet": Datapoint(0.0),
        }

        for path, value in initial_values.items():
            try:
                # Set current value (this will create the entry if it doesn't exist)
                self.client.set_current_values({path: value})
                log.info(f"  Set {path} = {value.value}")
            except Exception as e:
                log.warning(f"  Failed to set {path}: {e}")
                # Continue even if some values fail

        log.info("✅ Initial values fed")

    async def subscribe_and_echo(self):
        """Subscribe to target values and echo to current values"""
        log.info("Subscribing to target value changes...")

        try:
            # Subscribe to target values for all mock signals
            subscribe_response = self.client.subscribe_target_values(MOCK_SIGNALS)

            log.info(f"✅ Subscribed to {len(MOCK_SIGNALS)} signals")
            log.info("Listening for target value changes...")

            # Process updates
            for update in subscribe_response:
                # update is a dict with signal paths as keys
                for path, datapoint in update.items():
                    if datapoint is not None and hasattr(datapoint, 'value'):
                        value = datapoint.value

                        # Echo target value to current value
                        log.info(f"📥 Target: {path} = {value}")
                        try:
                            self.client.set_current_values({path: Datapoint(value)})
                            log.info(f"📤 Echoed to current: {path} = {value}")
                        except Exception as e:
                            log.error(f"  Failed to echo {path}: {e}")

        except Exception as e:
            log.error(f"❌ Subscription error: {e}")
            raise

    async def run(self):
        """Main run loop"""
        self.running = True

        # Connect to Kuksa
        if not await self.connect():
            return

        # Feed initial values
        await self.feed_initial_values()

        # Subscribe and echo
        await self.subscribe_and_echo()

    async def stop(self):
        """Stop the service"""
        log.info("Stopping simple mock service...")
        self.running = False
        try:
            # disconnect() is also not async
            self.client.disconnect()
        except:
            pass


async def main():
    """Main entry point"""
    log.info("=" * 60)
    log.info("Simple Mock Service - Echo Mode")
    log.info("=" * 60)
    log.info(f"Kuksa: {KUKSA_HOST}:{KUKSA_PORT}")
    log.info("")

    service = SimpleMockService(KUKSA_HOST, KUKSA_PORT)

    # Set up signal handlers
    loop = asyncio.get_event_loop()

    def signal_handler():
        log.info("Received shutdown signal")
        asyncio.create_task(service.stop())

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    # Run the service
    try:
        await service.run()
    except Exception as e:
        log.error(f"Service error: {e}", exc_info=True)
    finally:
        await service.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(0)

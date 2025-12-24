#!/usr/bin/env python3
"""
Simple Mock Service - Configurable modes for vehicle signal mocking
Supports: echo-all, echo-specific, random, static, off modes
"""

import asyncio
import logging
import os
import signal
import sys
import json
import argparse
import random
from kuksa_client.grpc import VSSClient, Datapoint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

# Configuration from environment or defaults
KUKSA_HOST = os.getenv("KUKSA_HOST", "127.0.0.1")
KUKSA_PORT = os.getenv("KUKSA_PORT", "55555")

# Default signals to mock
DEFAULT_MOCK_SIGNALS = [
    "Vehicle.Body.Lights.Beam.High.IsOn",
    "Vehicle.Body.Lights.Beam.Low.IsOn",
    "Vehicle.Body.Hood.IsOpen",
    "Vehicle.Body.Trunk.Rear.IsOpen",
    "Vehicle.ADAS.CruiseControl.SpeedSet",
]

# Static default values for each signal
STATIC_DEFAULT_VALUES = {
    "Vehicle.Body.Lights.Beam.High.IsOn": False,
    "Vehicle.Body.Lights.Beam.Low.IsOn": False,
    "Vehicle.Body.Hood.IsOpen": False,
    "Vehicle.Body.Trunk.Rear.IsOpen": False,
    "Vehicle.ADAS.CruiseControl.SpeedSet": 0.0,
}

# Random value ranges for each signal (if not specified, uses default)
RANDOM_VALUE_RANGES = {
    "Vehicle.Body.Lights.Beam.High.IsOn": (0, 1),  # Boolean
    "Vehicle.Body.Lights.Beam.Low.IsOn": (0, 1),    # Boolean
    "Vehicle.Body.Hood.IsOpen": (0, 1),             # Boolean
    "Vehicle.Body.Trunk.Rear.IsOpen": (0, 1),       # Boolean
    "Vehicle.ADAS.CruiseControl.SpeedSet": (0, 200), # Float 0-200 km/h
}


class SimpleMockService:
    """Configurable mock service with multiple modes"""

    def __init__(self, host: str, port: str, mode: str = "echo-all", signals: list = None):
        self.client = VSSClient(host, int(port))
        self.running = False
        self.mode = mode
        self.signals = signals or DEFAULT_MOCK_SIGNALS
        log.info(f"Initialized with mode={mode}, signals={len(self.signals)}")

    async def connect(self) -> bool:
        """Connect to Kuksa databroker with retries"""
        max_retries = 30
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                log.info(f"Connecting to Kuksa at {KUKSA_HOST}:{KUKSA_PORT} (attempt {attempt + 1}/{max_retries})...")
                self.client.connect()
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

        initial_values = {}
        for signal in self.signals:
            if signal in STATIC_DEFAULT_VALUES:
                initial_values[signal] = Datapoint(STATIC_DEFAULT_VALUES[signal])
            else:
                # Default to False/0 for unknown signals
                initial_values[signal] = Datapoint(False)

        for path, value in initial_values.items():
            try:
                self.client.set_current_values({path: value})
                log.info(f"  Set {path} = {value.value}")
            except Exception as e:
                log.warning(f"  Failed to set {path}: {e}")

        log.info("✅ Initial values fed")

    async def mode_echo_all(self):
        """Echo all target values to current values (default)"""
        log.info("Mode: echo-all - Subscribing to all target value changes...")

        try:
            subscribe_response = self.client.subscribe_target_values(self.signals)
            log.info(f"✅ Subscribed to {len(self.signals)} signals")
            log.info("Listening for target value changes...")

            for update in subscribe_response:
                for path, datapoint in update.items():
                    if datapoint is not None and hasattr(datapoint, 'value'):
                        value = datapoint.value
                        log.info(f"📥 Target: {path} = {value}")
                        try:
                            self.client.set_current_values({path: Datapoint(value)})
                            log.info(f"📤 Echoed to current: {path} = {value}")
                        except Exception as e:
                            log.error(f"  Failed to echo {path}: {e}")

        except Exception as e:
            log.error(f"❌ Subscription error: {e}")
            raise

    async def mode_echo_specific(self, specific_signals: list):
        """Echo only specific signals"""
        log.info(f"Mode: echo-specific - Only echoing {len(specific_signals)} signals: {specific_signals}")

        try:
            subscribe_response = self.client.subscribe_target_values(specific_signals)
            log.info(f"✅ Subscribed to {len(specific_signals)} signals")

            for update in subscribe_response:
                for path, datapoint in update.items():
                    if path in specific_signals and datapoint is not None and hasattr(datapoint, 'value'):
                        value = datapoint.value
                        log.info(f"📥 Target: {path} = {value}")
                        try:
                            self.client.set_current_values({path: Datapoint(value)})
                            log.info(f"📤 Echoed to current: {path} = {value}")
                        except Exception as e:
                            log.error(f"  Failed to echo {path}: {e}")

        except Exception as e:
            log.error(f"❌ Subscription error: {e}")
            raise

    async def mode_random(self, interval: float = 2.0):
        """Generate random values for all signals"""
        log.info(f"Mode: random - Generating random values every {interval}s")

        try:
            while self.running:
                current_values = {}

                for signal in self.signals:
                    if signal in RANDOM_VALUE_RANGES:
                        min_val, max_val = RANDOM_VALUE_RANGES[signal]
                        # Determine if boolean or numeric
                        if min_val == 0 and max_val == 1 and "IsOn" in signal or "IsOpen" in signal:
                            # Boolean signal
                            value = random.choice([True, False])
                        else:
                            # Numeric signal
                            value = random.uniform(min_val, max_val)

                        current_values[signal] = Datapoint(value)
                        log.info(f"🎲 Random: {signal} = {value}")

                try:
                    self.client.set_current_values(current_values)
                except Exception as e:
                    log.error(f"Failed to set random values: {e}")

                await asyncio.sleep(interval)

        except Exception as e:
            log.error(f"❌ Random mode error: {e}")
            raise

    async def mode_static(self):
        """Set static values (no updates)"""
        log.info("Mode: static - Setting static values (no further updates)")

        # Just set initial values and idle
        await self.feed_initial_values()
        log.info("✅ Static values set, service idling...")

        # Keep running but don't update anything
        while self.running:
            await asyncio.sleep(10)

    async def mode_off(self):
        """Off mode - service runs but doesn't update any values"""
        log.info("Mode: off - Service running but not updating any signals")
        log.info("Switch to another mode to activate mocking")

        # Just keep connection alive but don't do anything
        while self.running:
            await asyncio.sleep(10)

    async def run(self):
        """Main run loop"""
        self.running = True

        # Connect to Kuksa
        if not await self.connect():
            return

        # Feed initial values
        await self.feed_initial_values()

        # Run in selected mode
        log.info(f"🚀 Starting mode: {self.mode}")

        if self.mode == "echo-all":
            await self.mode_echo_all()

        elif self.mode == "echo-specific":
            # Get specific signals from environment or use all
            specific_str = os.getenv("MOCK_SPECIFIC_SIGNALS", "")
            specific_signals = [s.strip() for s in specific_str.split(",") if s.strip()]
            if not specific_signals:
                specific_signals = self.signals
            await self.mode_echo_specific(specific_signals)

        elif self.mode == "random":
            interval = float(os.getenv("MOCK_RANDOM_INTERVAL", "2.0"))
            await self.mode_random(interval)

        elif self.mode == "static":
            await self.mode_static()

        elif self.mode == "off":
            await self.mode_off()

        else:
            log.error(f"❌ Unknown mode: {self.mode}")
            log.info(f"Available modes: echo-all, echo-specific, random, static, off")
            raise ValueError(f"Unknown mode: {self.mode}")

    async def stop(self):
        """Stop the service"""
        log.info("Stopping simple mock service...")
        self.running = False
        try:
            self.client.disconnect()
        except:
            pass


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Simple Mock Service - Configurable vehicle signal mocking",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Modes:
  echo-all         Echo all target values to current values (default)
  echo-specific    Echo only specific signals (set MOCK_SPECIFIC_SIGNALS env var)
  random           Generate random values for all signals
  static           Set static default values (no updates)
  off              Service runs but doesn't update any signals

Environment Variables:
  KUKSA_HOST       Kuksa databroker host (default: 127.0.0.1)
  KUKSA_PORT       Kuksa databroker port (default: 55555)
  MOCK_SPECIFIC_SIGNALS  Comma-separated list of signals for echo-specific mode
  MOCK_RANDOM_INTERVAL   Interval in seconds for random mode (default: 2.0)

Examples:
  # Echo all signals (default)
  python simple_mock.py

  # Random mode with 5 second interval
  python simple_mock.py --mode random

  # Echo only specific signals
  python simple_mock.py --mode echo-specific
  export MOCK_SPECIFIC_SIGNALS="Vehicle.Body.Lights.Beam.Low.IsOn,Vehicle.ADAS.CruiseControl.SpeedSet"

  # Static mode
  python simple_mock.py --mode static
        """
    )

    parser.add_argument(
        '--mode',
        choices=['echo-all', 'echo-specific', 'random', 'static', 'off'],
        default=os.getenv("MOCK_MODE", "echo-all"),
        help='Mock service mode (default: echo-all, or from MOCK_MODE env var)'
    )

    parser.add_argument(
        '--signals',
        type=str,
        help='Comma-separated list of signals to mock (overrides default list)'
    )

    parser.add_argument(
        '--version',
        action='version',
        version='Simple Mock Service v1.0.0'
    )

    return parser.parse_args()


async def main():
    """Main entry point"""
    args = parse_arguments()

    # Parse signals list if provided
    signals = None
    if args.signals:
        signals = [s.strip() for s in args.signals.split(",") if s.strip()]

    log.info("=" * 60)
    log.info("Simple Mock Service - Configurable Mode")
    log.info("=" * 60)
    log.info(f"Kuksa: {KUKSA_HOST}:{KUKSA_PORT}")
    log.info(f"Mode: {args.mode}")
    if signals:
        log.info(f"Signals: {len(signals)} custom signals")
    else:
        log.info(f"Signals: {len(DEFAULT_MOCK_SIGNALS)} default signals")
    log.info("")

    service = SimpleMockService(KUKSA_HOST, KUKSA_PORT, args.mode, signals)

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

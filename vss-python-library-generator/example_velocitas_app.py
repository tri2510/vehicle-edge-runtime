#!/usr/bin/env python3
"""
Velocitas Vehicle App Example
Demonstrates vehicle library with Velocitas SDK

This app automatically controls headlights based on speed.
Works when deployed via vehicle-edge-runtime Python deployment.
"""

from sdv.vehicle_app import VehicleApp
from vehicle import vehicle
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AutoHeadlightApp(VehicleApp):
    """
    Automatic Headlight Control Application

    Rules:
    - Turn on low beam lights when speed > 50 km/h
    - Turn off lights when speed <= 40 km/h (hysteresis)
    """

    def __init__(self, vehicle):
        super().__init__(vehicle)
        self.high_speed_threshold = 50  # km/h
        self.low_speed_threshold = 40   # km/h
        self.headlights_on = False

    async def on_start(self):
        """Called when app starts"""
        logger.info("🚗 Auto Headlight App Starting...")
        logger.info(f"High speed threshold: {self.high_speed_threshold} km/h")
        logger.info(f"Low speed threshold: {self.low_speed_threshold} km/h")

        # Subscribe to speed changes
        await vehicle.Speed.subscribe(self.on_speed_changed)
        logger.info("✅ Subscribed to speed changes")
        logger.info("🎯 App is running. Waiting for speed changes...\n")

    async def on_speed_changed(self, data):
        """Called when vehicle speed changes"""
        try:
            speed = data.value

            if speed is None:
                return

            # Turn on lights if speed exceeds high threshold
            if speed > self.high_speed_threshold and not self.headlights_on:
                await self.set_headlights(True)
                logger.info(f"💡 Headlights ON (speed: {speed} km/h)")

            # Turn off lights if speed drops below low threshold
            elif speed < self.low_speed_threshold and self.headlights_on:
                await self.set_headlights(False)
                logger.info(f"🌙 Headlights OFF (speed: {speed} km/h)")

        except Exception as e:
            logger.error(f"Error handling speed change: {e}")

    async def set_headlights(self, turn_on):
        """Control low beam headlights"""
        try:
            await vehicle.Body.Lights.Beam.Low.IsOn.set(turn_on)
            self.headlights_on = turn_on
        except Exception as e:
            logger.error(f"Failed to set headlights: {e}")

    async def on_stop(self):
        """Called when app stops"""
        logger.info("🛑 Auto Headlight App Stopping...")

        # Turn off headlights when stopping
        if self.headlights_on:
            await self.set_headlights(False)
            logger.info("💡 Headlights turned off")

# Create and run the app
if __name__ == "__main__":
    app = AutoHeadlightApp(vehicle)
    logger.info("Starting Auto Headlight App...")
    app.run()

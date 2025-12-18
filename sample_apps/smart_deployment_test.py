#!/usr/bin/env python3
"""
Smart Deployment Test Application

This app specifically tests all the smart deployment features:
- Auto-dependency detection (pandas, numpy, matplotlib, kuksa-client)
- Multiple vehicle signals
- Data processing and visualization
"""

import asyncio
import json
import time
from datetime import datetime
import logging

# Test auto-detection of various Python packages
try:
    import pandas as pd
    import numpy as np
    import matplotlib.pyplot as plt
    has_visualization = True
except ImportError:
    has_visualization = False
    logging.warning("Visualization packages not available, using fallback")

try:
    from kuksa_client import KuksaClient
    has_kuksa = True
except ImportError:
    has_kuksa = False
    logging.warning("KUKSA client not available, using mock data")

import requests  # Test network capability

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SmartDeploymentTest:
    """Test application for smart deployment features"""

    def __init__(self):
        self.vehicle_data = []
        self.signals = [
            "Vehicle.Speed",
            "Vehicle.Powertrain.TorqueAtTransmission",
            "Vehicle.Powertrain.EngineSpeed"
        ]
        self.running = True

    def test_imports(self):
        """Test that all expected packages are available"""
        logger.info("🧪 Testing package imports...")

        packages = {
            "pandas": pd if has_visualization else None,
            "numpy": np if has_visualization else None,
            "matplotlib": plt if has_visualization else None,
            "kuksa_client": KuksaClient if has_kuksa else None,
            "requests": requests
        }

        for name, pkg in packages.items():
            if pkg:
                logger.info(f"✅ {name} imported successfully")
            else:
                logger.warning(f"❌ {name} not available")

        return len([p for p in packages.values() if p])

    def generate_mock_vehicle_data(self, num_samples=100):
        """Generate mock vehicle data for testing"""
        logger.info(f"📊 Generating {num_samples} mock vehicle data samples...")

        data = []
        base_time = time.time()

        for i in range(num_samples):
            # Simulate realistic vehicle data
            speed = min(120, max(0, 50 + 30 * np.sin(i * 0.1) + np.random.normal(0, 5)))
            torque = min(300, max(-50, 150 + 100 * np.cos(i * 0.15) + np.random.normal(0, 10)))
            engine_speed = min(7000, max(800, 2000 + 2000 * np.sin(i * 0.08) + np.random.normal(0, 200)))

            data.append({
                "timestamp": base_time + i * 0.1,
                "speed": speed,
                "torque": torque,
                "engine_speed": engine_speed
            })

        return data

    def analyze_data(self, data):
        """Analyze vehicle data using pandas if available"""
        if not has_visualization:
            # Simple analysis without pandas
            speeds = [d["speed"] for d in data]
            return {
                "avg_speed": sum(speeds) / len(speeds),
                "max_speed": max(speeds),
                "min_speed": min(speeds),
                "samples": len(speeds)
            }

        # Advanced analysis with pandas
        df = pd.DataFrame(data)
        logger.info("📈 Performing data analysis with pandas...")

        analysis = {
            "avg_speed": df["speed"].mean(),
            "max_speed": df["speed"].max(),
            "min_speed": df["speed"].min(),
            "avg_torque": df["torque"].mean(),
            "max_engine_speed": df["engine_speed"].max(),
            "samples": len(df),
            "speed_std": df["speed"].std(),
            "torque_correlation": df["speed"].corr(df["torque"])
        }

        return analysis

    def create_visualization(self, data):
        """Create visualization if matplotlib is available"""
        if not has_visualization:
            logger.info("📊 Creating text-based data summary...")
            # Simple text summary
            analysis = self.analyze_data(data)
            print(f"""
🚗 Vehicle Data Summary:
   Samples: {analysis['samples']}
   Speed: {analysis['min_speed']:.1f} - {analysis['max_speed']:.1f} km/h (avg: {analysis['avg_speed']:.1f})
   Torque: {analysis.get('avg_torque', 'N/A'):.1f} Nm (avg)
   Engine: {analysis.get('max_engine_speed', 'N/A'):.0f} RPM (max)
            """)
            return

        logger.info("📈 Creating visualization with matplotlib...")

        try:
            df = pd.DataFrame(data)

            # Create subplots
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(12, 8))
            fig.suptitle('Vehicle Edge Runtime - Smart Deployment Test', fontsize=16)

            # Speed over time
            ax1.plot(range(len(data)), df["speed"], 'b-', label='Speed')
            ax1.set_title('Vehicle Speed')
            ax1.set_ylabel('Speed (km/h)')
            ax1.legend()
            ax1.grid(True)

            # Torque over time
            ax2.plot(range(len(data)), df["torque"], 'r-', label='Torque')
            ax2.set_title('Engine Torque')
            ax2.set_ylabel('Torque (Nm)')
            ax2.legend()
            ax2.grid(True)

            # Engine speed over time
            ax3.plot(range(len(data)), df["engine_speed"], 'g-', label='Engine Speed')
            ax3.set_title('Engine Speed')
            ax3.set_ylabel('RPM')
            ax3.set_xlabel('Sample Index')
            ax3.legend()
            ax3.grid(True)

            # Speed vs Torque scatter plot
            ax4.scatter(df["speed"], df["torque"], alpha=0.6)
            ax4.set_title('Speed vs Torque')
            ax4.set_xlabel('Speed (km/h)')
            ax4.set_ylabel('Torque (Nm)')
            ax4.grid(True)

            plt.tight_layout()

            # Save the plot
            plt.savefig('/tmp/vehicle_data_analysis.png', dpi=150, bbox_inches='tight')
            logger.info("📊 Visualization saved to /tmp/vehicle_data_analysis.png")

        except Exception as e:
            logger.error(f"❌ Failed to create visualization: {e}")

    async def test_kuksa_connection(self):
        """Test KUKSA connection if available"""
        if not has_kuksa:
            logger.info("🧪 Skipping KUKSA test - client not available")
            return False

        try:
            logger.info("🔗 Testing KUKSA connection...")
            client = KuksaClient()
            await client.connect()
            logger.info("✅ KUKSA connection successful")
            await client.disconnect()
            return True

        except Exception as e:
            logger.warning(f"❌ KUKSA connection failed: {e}")
            return False

    async def test_network_connectivity(self):
        """Test network connectivity"""
        try:
            logger.info("🌐 Testing network connectivity...")
            response = requests.get("http://httpbin.org/get", timeout=5)
            if response.status_code == 200:
                logger.info("✅ Network connectivity successful")
                return True
        except Exception as e:
            logger.warning(f"❌ Network test failed: {e}")
        return False

    async def run_tests(self):
        """Run all smart deployment tests"""
        logger.info("🚀 Starting Smart Deployment Test Suite")
        print("=" * 60)
        print("Vehicle Edge Runtime - Smart Deployment Test")
        print("=" * 60)

        # Test 1: Package imports
        packages_available = self.test_imports()
        print(f"\n📦 Packages Available: {packages_available}/5")

        # Test 2: Data generation and processing
        print("\n📊 Testing data processing...")
        mock_data = self.generate_mock_vehicle_data(50)
        analysis = self.analyze_data(mock_data)
        print(f"   Data analysis: {json.dumps(analysis, indent=2)}")

        # Test 3: Visualization
        print("\n📈 Testing visualization...")
        self.create_visualization(mock_data)

        # Test 4: KUKSA connection
        print("\n🚗 Testing vehicle connectivity...")
        kuksa_success = await self.test_kuksa_connection()

        # Test 5: Network connectivity
        print("\n🌐 Testing network connectivity...")
        network_success = await self.test_network_connectivity()

        # Summary
        print("\n" + "=" * 60)
        print("📋 Test Summary:")
        print(f"   Package Detection: ✅ ({packages_available}/5 packages)")
        print(f"   Data Processing: ✅ ({analysis['samples']} samples analyzed)")
        print(f"   Visualization: {'✅' if has_visualization else '⚠️'}")
        print(f"   KUKSA Connection: {'✅' if kuksa_success else '⚠️'}")
        print(f"   Network Access: {'✅' if network_success else '⚠️'}")
        print("\n🎉 Smart Deployment Test Complete!")
        print("=" * 60)

        return {
            "packages": packages_available,
            "data_samples": analysis["samples"],
            "visualization": has_visualization,
            "kuksa": kuksa_success,
            "network": network_success
        }


async def main():
    """Main entry point"""
    test = SmartDeploymentTest()
    results = await test.run_tests()

    # Save test results
    try:
        with open("/tmp/smart_deployment_results.json", "w") as f:
            json.dump(results, f, indent=2)
        logger.info("📄 Test results saved to /tmp/smart_deployment_results.json")
    except Exception as e:
        logger.error(f"Failed to save results: {e}")


if __name__ == "__main__":
    asyncio.run(main())
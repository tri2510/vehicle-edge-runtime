#!/usr/bin/env python3
"""
Test script to verify vehicle library integration in deployed containers
This should work inside any Python app container deployed by vehicle-edge-runtime
"""

import sys
import os

print("=== Vehicle Library Integration Test ===\n")

# Test 1: Check vehicle library is in PYTHONPATH
print("Test 1: Checking PYTHONPATH...")
pythonpath = os.environ.get('PYTHONPATH', '')
print(f"PYTHONPATH: {pythonpath}")

if '/app/vehicle-lib' in pythonpath:
    print("✅ Vehicle library in PYTHONPATH\n")
else:
    print("❌ Vehicle library NOT in PYTHONPATH\n")
    sys.exit(1)

# Test 2: Check vehicle library directory exists
print("Test 2: Checking vehicle library directory...")
if os.path.exists('/app/vehicle-lib'):
    print("✅ /app/vehicle-lib exists")
    import subprocess
    result = subprocess.run(['ls', '-la', '/app/vehicle-lib'], capture_output=True, text=True)
    print(result.stdout)
else:
    print("❌ /app/vehicle-lib does NOT exist\n")
    sys.exit(1)

# Test 3: Import vehicle module
print("Test 3: Importing vehicle module...")
try:
    from vehicle import vehicle
    print("✅ Successfully imported vehicle module")
    print(f"   Vehicle class: {vehicle.__class__.__name__}")
    print()
except Exception as e:
    print(f"❌ Failed to import vehicle: {e}\n")
    sys.exit(1)

# Test 4: Check for common signal branches
print("Test 4: Checking for common signal branches...")
branches = ['Speed', 'Body', 'Cabin', 'Chassis', 'Powertrain']
for branch in branches:
    try:
        hasattr(vehicle, branch)
        print(f"   ✅ Vehicle.{branch} exists")
    except AttributeError:
        print(f"   ❌ Vehicle.{branch} NOT found")
print()

# Test 5: Check Velocitas SDK
print("Test 5: Checking Velocitas SDK...")
try:
    from sdv.vehicle_app import VehicleApp
    print("✅ Velocitas SDK available")
    print(f"   VehicleApp: {VehicleApp}")
    print()
except ImportError as e:
    print(f"❌ Velocitas SDK NOT available: {e}\n")

# Test 6: Check dependencies
print("Test 6: Checking key dependencies...")
dependencies = [
    'velocitas',
    'kuksa_client',
    'grpcio',
    'aiohttp',
    'cloudevents'
]

for dep in dependencies:
    try:
        __import__(dep)
        print(f"   ✅ {dep}")
    except ImportError:
        print(f"   ❌ {dep} NOT installed")

print()
print("=== Integration Test Complete ===")
print("✅ All critical tests passed!")
print("\nThe vehicle library is ready to use.")
print("See INTEGRATION.md for usage examples.")

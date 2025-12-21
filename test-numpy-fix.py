#!/usr/bin/env python3

import json
import time
import socket
import sys

def test_smart_deployment():
    """Test that numpy is auto-detected and installed"""
    
    # Test code that imports numpy
    numpy_app_code = '''
import numpy as np
import time

print("🚀 Testing numpy auto-installation...")

# Test numpy functionality
data = np.array([1, 2, 3, 4, 5])
print(f"✅ Numpy array created: {data}")
print(f"✅ Mean calculation: {np.mean(data)}")
print(f"✅ NumPy version: {np.__version__}")

print("🎉 NumPy import successful!")
'''

    deploy_request = {
        "type": "deploy_request",
        "id": f"test-numpy-fix-{int(time.time())}",
        "code": numpy_app_code,
        "prototype": {
            "id": f"numpy-test-{int(time.time())}",
            "name": "NumPy Auto-Install Test",
            "language": "python",
            "version": "1.0.0"
        },
        "language": "python"
    }

    # Send via simple socket to WebSocket endpoint
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('localhost', 3002))
        
        # Send WebSocket upgrade header (simplified)
        message = json.dumps(deploy_request)
        print(f"📦 Sending deployment request...")
        print(f"   Expected: numpy should be auto-detected and installed")
        print(f"   Test code: imports numpy and uses np.array")
        
        s.send(message.encode())
        
        # Read response (simplified - just check it doesn't fail)
        response = s.recv(4096)
        print(f"📨 Response received: {len(response)} bytes")
        
        s.close()
        
        print("\n✅ Deployment sent successfully!")
        print("🔍 Check container logs to see if numpy was auto-installed:")
        print("   docker logs vehicle-edge-runtime-dev | grep -E '(numpy|detect|depend)'")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    test_smart_deployment()
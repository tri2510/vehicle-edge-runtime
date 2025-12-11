#!/usr/bin/env python3
"""
Simple test application for Vehicle Edge Runtime testing.
"""

import asyncio
import time

print("🚀 Mock application started")

async def main():
    print("📋 Processing test data...")

    for i in range(5):
        print(f"🔄 Processing step {i+1}/5")
        await asyncio.sleep(0.5)

    print("✅ Mock application completed")

if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
Error simulation test application.
"""

import sys

print("🚨 Error simulator started")

# Simulate different error scenarios
if len(sys.argv) > 1 and sys.argv[1] == "syntax_error":
    print("This would cause a syntax error in real scenario")
    # invalid syntax here
elif len(sys.argv) > 1 and sys.argv[1] == "runtime_error":
    print("Simulating runtime error...")
    raise Exception("This is a simulated runtime error")
else:
    print("✅ Error simulator completed without errors")

import sys
import os

# Ensure backend module is found
sys.path.append(os.getcwd())

from backend.services.gemini_service import _generate

try:
    print("Testing Gemini API...")
    response = _generate("Say 'Hello, API is working!' and nothing else.", temperature=0.1)
    print(f"SUCCESS. Response: {response}")
except Exception as e:
    print(f"FAILED. Error: {e}")

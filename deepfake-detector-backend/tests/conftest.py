import os
import sys

# Make the package importable when pytest is run from outside the project root.
# This inserts the repository root (deepfake-detector-backend) into sys.path.
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

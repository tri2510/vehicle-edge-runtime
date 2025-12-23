import argparse
import os
import sys
import subprocess
import shutil
from pathlib import Path


class SDVLibraryGenerator:
    """Generator for SDV vehicle Python library"""

    # Supported VSS versions
    SUPPORTED_VSS_VERSIONS = ["3.0", "3.1", "3.1.1", "4.0", "default"]

    # VSS version GitHub URLs
    VSS_VERSION_URLS = {
        "3.0": "https://github.com/COVESA/vehicle_signal_specification/archive/refs/tags/v3.0.tar.gz",
        "3.1": "https://github.com/COVESA/vehicle_signal_specification/archive/refs/tags/v3.1.tar.gz",
        "3.1.1": "https://github.com/COVESA/vehicle_signal_specification/archive/refs/tags/v3.1.1.tar.gz",
        "4.0": "https://github.com/COVESA/vehicle_signal_specification/archive/refs/tags/v4.0.tar.gz",
    }

    # Compatible vss-tools versions for each VSS version
    VSS_TOOLS_COMPATIBILITY = {
        "3.0": "2.0",
        "3.1": "2.0",
        "3.1.1": "2.0",
        "4.0": "4.0",
        "default": "4.0",
    }

    def __init__(self, base_dir: Path, vss_version: str = "default"):
        self.base_dir = base_dir
        self.src_dir = base_dir / "src"
        self.vss_tools_dir = self.src_dir / "vehicle_signal_specification/vss-tools"
        self.model_gen_dir = self.src_dir / "vehicle-model-generator"
        self.vss_version = vss_version

        # Set VSS spec directory based on version
        if vss_version == "default":
            self.vss_spec_dir = self.src_dir / "vehicle_signal_specification/spec"
        else:
            # Use cached version-specific spec directory
            self.vss_spec_dir = base_dir / ".vss_cache" / f"vss-{vss_version}" / "spec"

    def download_vss_version(self, version: str) -> bool:
        """Download and extract VSS specification for a specific version"""
        if version not in self.VSS_VERSION_URLS:
            print(f"❌ Unsupported VSS version: {version}")
            print(f"   Supported versions: {', '.join(self.SUPPORTED_VSS_VERSIONS)}")
            return False

        cache_dir = self.base_dir / ".vss_cache" / f"vss-{version}"
        spec_marker = cache_dir / "spec" / "VehicleSignalSpecification.vspec"

        # Check if already cached
        if spec_marker.exists():
            print(f"✅ Using cached VSS {version}")
            return True

        print(f"📥 Downloading VSS {version} from GitHub...")
        url = self.VSS_VERSION_URLS[version]

        try:
            import tempfile
            import tarfile
            import urllib.request

            # Download to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz") as tmp_file:
                tmp_path = Path(tmp_file.name)

                print(f"   Downloading from {url}...")
                urllib.request.urlretrieve(url, tmp_path)

                # Extract
                print(f"   Extracting to {cache_dir}...")
                cache_dir.mkdir(parents=True, exist_ok=True)

                with tarfile.open(tmp_path, "r:gz") as tar:
                    # Find the spec directory in the archive
                    members = [m for m in tar.getmembers() if "spec/" in m.name]
                    tar.extractall(path=cache_dir, members=members)

                # Move extracted spec to expected location
                extracted_dirs = list(cache_dir.glob("vehicle_signal_specification-*"))
                if extracted_dirs:
                    extracted_root = extracted_dirs[0]
                    spec_source = extracted_root / "spec"
                    if spec_source.exists():
                        spec_target = cache_dir / "spec"
                        shutil.move(str(spec_source), str(spec_target))
                        # Cleanup extracted directory
                        shutil.rmtree(extracted_root)

                # Cleanup temp file
                tmp_path.unlink()

            print(f"✅ VSS {version} downloaded and cached")
            return True

        except Exception as e:
            print(f"❌ Failed to download VSS {version}: {e}")
            return False

    def check_dependencies(self) -> bool:
        """Check if required directories exist"""
        required = [
            self.vss_tools_dir,
            self.model_gen_dir,
        ]

        missing = []
        for path in required:
            if not path.exists():
                missing.append(str(path))

        if missing:
            print("❌ Missing required directories:")
            for m in missing:
                print(f"  - {m}")
            return False

        # For non-default versions, download if needed
        if self.vss_version != "default":
            if not self.vss_spec_dir.exists():
                if not self.download_vss_version(self.vss_version):
                    return False

        # Check VSS spec directory exists
        if not self.vss_spec_dir.exists():
            print(f"❌ VSS specification not found: {self.vss_spec_dir}")
            return False

        return True

    def install_vss_tools(self):
        """Install vss-tools package (cached - skips if already installed)"""
        # Check if already installed
        try:
            import vspec
            print("✅ vss-tools already installed (cached)")
            return
        except ImportError:
            pass

        print("📦 Installing vss-tools...")
        try:
            subprocess.run(
                ["pip3", "install", "-q", str(self.vss_tools_dir)],
                check=True,
                capture_output=True
            )
            print("✅ vss-tools installed")
        except subprocess.CalledProcessError:
            print("⚠️  vss-tools installation failed")

    def install_model_generator(self):
        """Install vehicle-model-generator package (cached - skips if already installed)"""
        # Check if already installed
        try:
            import velocitas
            print("✅ vehicle-model-generator already installed (cached)")
            return
        except ImportError:
            pass

        print("📦 Installing vehicle-model-generator...")
        try:
            subprocess.run(
                ["pip3", "install", "-q", str(self.model_gen_dir)],
                check=True,
                capture_output=True
            )
            print("✅ vehicle-model-generator installed")
        except subprocess.CalledProcessError:
            print("⚠️  vehicle-model-generator installation failed")

    def generate_vss_json(self, output_dir: Path, overlays: list) -> Path:
        """Generate VSS JSON from specification"""
        print(f"🔧 Generating VSS JSON...")

        vss_json_path = output_dir / "vss.json"

        # Build command
        cmd = [
            "python3",
            str(self.vss_tools_dir / "vspec2json.py"),
            "-I", str(self.vss_spec_dir),
            "-u", str(self.vss_spec_dir / "units.yaml")
        ]

        # Add overlay files
        for overlay in overlays:
            cmd.extend(["-o", str(overlay)])

        # Add main VSS file and output
        vss_spec_file = self.vss_spec_dir / "VehicleSignalSpecification.vspec"
        if not vss_spec_file.exists():
            print(f"❌ VSS specification not found: {vss_spec_file}")
            sys.exit(1)

        cmd.extend([str(vss_spec_file), str(vss_json_path)])

        # Run command
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"✅ VSS JSON generated: {vss_json_path}")
            return vss_json_path
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to generate VSS JSON")
            print(f"stdout: {e.stdout}")
            print(f"stderr: {e.stderr}")
            sys.exit(1)

    def generate_vehicle_module(self, vss_json: Path, output_dir: Path):
        """Generate Python vehicle module"""
        print(f"🐍 Generating Python vehicle module...")

        # Set PYTHONPATH to include velocitas package
        env = os.environ.copy()
        python_path = env.get('PYTHONPATH', '')
        velocitas_path = str(self.model_gen_dir / "src")
        env['PYTHONPATH'] = f"{velocitas_path}:{python_path}"

        cmd = [
            "python3", "-m", "velocitas.model_generator.cli",
            str(vss_json),
            "-I", str(self.vss_spec_dir),
            "-u", str(self.vss_spec_dir / "units.yaml"),
            "-N", "vehicle"
        ]

        try:
            result = subprocess.run(
                cmd,
                cwd=str(self.model_gen_dir),
                check=True,
                capture_output=True,
                text=True,
                env=env
            )
            print("✅ Vehicle module generated")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to generate vehicle module")
            print(f"stdout: {e.stdout}")
            print(f"stderr: {e.stderr}")
            sys.exit(1)

        # Copy generated module
        gen_model_dir = self.model_gen_dir / "gen_model" / "vehicle"
        if not gen_model_dir.exists():
            print(f"❌ Generated module not found: {gen_model_dir}")
            sys.exit(1)

        vehicle_output = output_dir / "vehicle"
        shutil.copytree(gen_model_dir, vehicle_output)
        print(f"✅ Vehicle module copied to: {vehicle_output}")

    def create_sdv_alias(self, output_dir: Path):
        """Create sdv package alias"""
        print("🔗 Creating sdv package alias...")

        sdv_dir = output_dir / "sdv"
        vdb_dir = sdv_dir / "vdb"

        sdv_dir.mkdir(parents=True, exist_ok=True)
        vdb_dir.mkdir(parents=True, exist_ok=True)

        # sdv/__init__.py
        (sdv_dir / "__init__.py").write_text("""
# sdv package - alias to velocitas_sdk
from velocitas_sdk import *
from velocitas_sdk.vehicle_app import VehicleApp
from velocitas_sdk.vdb.reply import DataPointReply
""")

        # sdv/vdb/__init__.py
        (vdb_dir / "__init__.py").write_text("""
# sdv.vdb package
from velocitas_sdk.vdb import *
from velocitas_sdk.vdb.reply import DataPointReply
""")

        # sdv/vdb/reply.py
        (vdb_dir / "reply.py").write_text("""
# sdv.vdb.reply module
from velocitas_sdk.vdb.reply import DataPointReply
""")

        print("✅ sdv alias created")

    def create_requirements(self, output_dir: Path):
        """Create requirements.txt"""
        print("📄 Creating requirements.txt...")

        requirements = """# Runtime dependencies for generated vehicle library
velocitas-sdk==0.14.1
cloudevents==1.11.0
kuksa_client==0.4.3
grpcio==1.64.1
grpcio-tools==1.64.1
protobuf==5.27.3
aiohttp==3.9.3
python-socketio==5.11.3
async-timeout==4.0.3
attrs==24.2.0
"""

        (output_dir / "requirements.txt").write_text(requirements)
        print("✅ requirements.txt created")

    def create_setup_py(self, output_dir: Path):
        """Create setup.py"""
        print("📄 Creating setup.py...")

        setup_py = """from setuptools import find_packages, setup

setup(
    name="sdv-vehicle-lib",
    version="1.0.0",
    description="Generated SDV Vehicle Library",
    packages=find_packages(),
    install_requires=[
        'velocitas-sdk==0.14.1',
        'kuksa_client==0.4.3',
        'grpcio==1.64.1',
        'protobuf==5.27.3',
        'aiohttp==3.9.3',
    ],
    zip_safe=False,
)
"""

        (output_dir / "setup.py").write_text(setup_py)
        print("✅ setup.py created")

    def create_readme(self, output_dir: Path):
        """Create README.md"""
        print("📄 Creating README.md...")

        readme = """# SDV Vehicle Library

Generated Python vehicle module from VSS specification.

## Installation

### Option 1: Direct PYTHONPATH
```bash
export PYTHONPATH="/path/to/output:${PYTHONPATH}"
```

### Option 2: Install as package
```bash
cd /path/to/output
pip3 install -r requirements.txt
pip3 install -e .
```

### Option 3: Copy to Docker
```dockerfile
COPY output/ /app/vehicle-lib/
RUN pip3 install -r /app/vehicle-lib/requirements.txt
ENV PYTHONPATH="/app/vehicle-lib:${PYTHONPATH}"
```

## Usage

```python
from sdv.vdb.reply import DataPointReply
from sdv.vehicle_app import VehicleApp
from vehicle import Vehicle, vehicle

class MyApp(VehicleApp):
    def __init__(self, vehicle_client: Vehicle):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        # Read sensor
        value = (await self.Vehicle.Body.Lights.Beam.Low.IsOn.get()).value
        print(f"Light value: {value}")

        # Set actuator
        await self.Vehicle.Body.Lights.Beam.Low.IsOn.set(True)

# Run app
app = MyApp(vehicle)
await app.run()
```

## Environment Variables

- `KUKSA_DATABROKER_ADDR` - Kuksa Data Broker address (default: 127.0.0.1)
- `KUKSA_DATABROKER_PORT` - Kuksa Data Broker port (default: 55555)
"""

        (output_dir / "README.md").write_text(readme)
        print("✅ README.md created")

    def create_example_app(self, output_dir: Path):
        """Create example application"""
        print("📄 Creating example_app.py...")

        example = """#!/usr/bin/env python3
\"\"\"
Example vehicle app using generated vehicle library
\"\"\"
import asyncio
import signal
from sdv.vehicle_app import VehicleApp
from vehicle import Vehicle, vehicle

class ExampleApp(VehicleApp):
    def __init__(self, vehicle_client: Vehicle):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        print("Vehicle app started")
        print("Available vehicle paths:")

        # List some common paths
        paths = [
            "Vehicle.Body.Lights.Beam.Low.IsOn",
            "Vehicle.Speed",
            "Vehicle.Cabin.Door.Row1.LeftSide.IsOpen",
        ]

        for path in paths:
            print(f"  - {path}")

        while True:
            await asyncio.sleep(5)
            print("App running...")

async def main():
    vehicle_app = ExampleApp(vehicle)
    await vehicle_app.run()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGTERM, loop.stop)
    loop.run_until_complete(main())
    loop.close()
"""

        (output_dir / "example_app.py").write_text(example)
        os.chmod(output_dir / "example_app.py", 0o755)
        print("✅ example_app.py created")

    def generate(self, output_dir: Path, overlays: list = None):
        """Generate the complete vehicle library"""
        overlays = overlays or []

        print("=" * 50)
        print("🚗 SDV Vehicle Library Generator")
        print("=" * 50)
        print()

        # Show VSS version being used
        if self.vss_version == "default":
            print(f"📋 VSS Version: default (local copy)")
        else:
            print(f"📋 VSS Version: {self.vss_version}")
            # Show compatibility warning for older versions
            if self.vss_version in ["3.0", "3.1", "3.1.1"]:
                print(f"⚠️  Note: VSS {self.vss_version} may not be fully compatible with vss-tools 4.0")
                print(f"   If errors occur, use 'default' version or VSS 4.0")
        print()

        # Check dependencies
        if not self.check_dependencies():
            sys.exit(1)

        # Create output directory
        output_dir = output_dir.absolute()
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"📁 Output directory: {output_dir}")
        print()

        # Install tools
        self.install_vss_tools()
        self.install_model_generator()
        print()

        # Generate VSS JSON
        vss_json = self.generate_vss_json(output_dir, overlays)

        # Generate vehicle module
        self.generate_vehicle_module(vss_json, output_dir)
        print()

        # Create additional files
        self.create_sdv_alias(output_dir)
        self.create_requirements(output_dir)
        self.create_setup_py(output_dir)
        self.create_readme(output_dir)
        self.create_example_app(output_dir)
        print()

        # Summary
        print("=" * 50)
        print("✅ Generation completed successfully!")
        print("=" * 50)
        print()
        print(f"📦 Output: {output_dir}")
        print()
        print("Generated files:")
        print("  - vehicle/         (Python vehicle module)")
        print("  - sdv/             (velocitas_sdk alias)")
        print("  - requirements.txt (dependencies)")
        print("  - setup.py         (package setup)")
        print("  - README.md        (documentation)")
        print("  - example_app.py   (example application)")
        print()

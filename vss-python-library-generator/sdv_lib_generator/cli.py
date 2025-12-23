#!/usr/bin/env python3
"""
SDV Vehicle Library Generator CLI
Command-line interface to generate Python vehicle modules from VSS specifications
"""

import argparse
import sys
from pathlib import Path

from sdv_lib_generator.generator import SDVLibraryGenerator


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        prog="sdv-gen",
        description="Generate SDV vehicle Python library from VSS specification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate with default VSS (version in included src/)
  sdv-gen

  # Generate with specific VSS version
  sdv-gen --vss-version 4.0

  # Generate with VSS 3.1
  sdv-gen --vss-version 3.1

  # Generate with custom overlay
  sdv-gen --overlay my_signals.vspec

  # Generate with VSS version and overlay
  sdv-gen --vss-version 3.1 --overlay my_signals.vspec

  # Generate to custom output directory
  sdv-gen --output /path/to/output

Supported VSS versions: 3.0, 3.1, 3.1.1, 4.0, default
        """
    )

    parser.add_argument(
        "--overlay", "-o",
        action="append",
        dest="overlays",
        help="Add custom VSS overlay file (can be used multiple times)"
    )

    parser.add_argument(
        "--vss-version",
        choices=SDVLibraryGenerator.SUPPORTED_VSS_VERSIONS,
        default="default",
        help="VSS specification version to use (default: use bundled version)"
    )

    parser.add_argument(
        "--vss-dir",
        type=Path,
        help="Use custom VSS specification directory (overrides --vss-version)"
    )

    parser.add_argument(
        "--output", "-out",
        type=Path,
        default=Path("output"),
        help="Output directory (default: ./output)"
    )

    parser.add_argument(
        "--version", "-v",
        action="version",
        version=f"%(prog)s 1.0.0"
    )

    args = parser.parse_args()

    # Get package base directory
    # When installed, src/ will be in the package directory
    try:
        import sdv_lib_generator
        base_dir = Path(sdv_lib_generator.__file__).parent.parent.absolute()
    except ImportError:
        # Fallback to current directory
        base_dir = Path.cwd()

    # Ensure src directory exists
    src_dir = base_dir / "src"
    if not src_dir.exists():
        # Try alternative locations
        alt_base = Path(__file__).parent.parent.absolute()
        src_dir = alt_base / "src"
        if src_dir.exists():
            base_dir = alt_base
        else:
            print("❌ Cannot find src/ directory with VSS tools and model generator")
            print("   Please run from the package root or ensure package is properly installed")
            sys.exit(1)

    # Determine VSS version
    vss_version = "default"
    if args.vss_dir:
        # Custom VSS dir takes precedence
        vss_version = "default"
    else:
        vss_version = args.vss_version

    # Create generator
    generator = SDVLibraryGenerator(base_dir, vss_version)

    # Override VSS dir if specified
    if args.vss_dir:
        generator.vss_spec_dir = args.vss_dir

    # Validate overlay files
    overlays = []
    if args.overlays:
        for overlay_path in args.overlays:
            overlay = Path(overlay_path)
            if not overlay.exists():
                print(f"❌ Overlay file not found: {overlay}")
                sys.exit(1)
            overlays.append(overlay)

    # Generate
    generator.generate(args.output, overlays)


if __name__ == "__main__":
    main()

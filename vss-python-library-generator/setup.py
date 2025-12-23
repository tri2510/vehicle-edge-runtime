"""Setup configuration for sdv-lib-generator package"""
from setuptools import setup, find_packages
from pathlib import Path

# Read README for long description
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text() if readme_file.exists() else ""

# Read version
version_file = Path(__file__).parent / "sdv_lib_generator" / "VERSION"
version = version_file.read_text().strip() if version_file.exists() else "1.0.0"

setup(
    name="sdv-lib-generator",
    version=version,
    author="SDV Library Generator",
    description="Generate Python vehicle libraries from VSS specifications",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-username/sdv-lib-generator",
    packages=find_packages(exclude=["tests", "tests.*", "src", "output", "*.egg-info"]),
    package_data={
        "sdv_lib_generator": [
            "VERSION",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Code Generators",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.10",
    install_requires=[
        "vss-tools>=4.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "black>=22.0",
            "flake8>=4.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "sdv-gen=sdv_lib_generator.cli:main",
            "sdv-lib-gen=sdv_lib_generator.cli:main",
            "generate-sdv-lib=sdv_lib_generator.cli:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)

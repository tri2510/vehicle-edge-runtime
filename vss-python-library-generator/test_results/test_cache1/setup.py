from setuptools import find_packages, setup

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

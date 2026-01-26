# Dockerfile explained

This section will explain what is happening inside the `Dockerfile`.

## Python builder stage


```Dockerfile
FROM python:3.10-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y git

RUN git clone --recurse-submodules --depth 1 --branch v4.0  https://github.com/COVESA/vehicle_signal_specification.git \
    && git clone --depth 1 --branch v0.7.2 https://github.com/eclipse-velocitas/vehicle-model-generator.git \
    && mkdir python-packages

COPY requirements.txt .

ENV PYTHONPATH="/app/python-packages/:${PYTHONPATH}"

RUN pip install --no-cache-dir --target /app/python-packages/ -r requirements.txt \
    && cd vehicle_signal_specification/ \
    && rm -rf .git \
    && cd vss-tools/ \
    && python vspec2json.py -I ../spec -u ../spec/units.yaml ../spec/VehicleSignalSpecification.vspec vss.json \
    && mv vss.json ../../vehicle-model-generator/ \
    && cd ../../vehicle-model-generator/ \
    && cp -r src/velocitas/ ../python-packages/velocitas/ \
    && python src/velocitas/model_generator/cli.py vss.json  -I ../vehicle_signal_specification/spec -u ../vehicle_signal_specification/spec/units.yaml \
    && mv ./gen_model/vehicle /app/python-packages/
```

Set up Python libs inside `/python-packages`, the needed components are listed in `requirements.txt`. 
It will also clone the following GitHub repos:
- [COVESA/vehicle_signal_specification](https://github.com/COVESA/vehicle_signal_specification.git) - This generates the `VSS.json` file. We use the tag `v4.0` of this repo.
- [eclipse-velocitas/vehicle-model-generator](https://github.com/eclipse-velocitas/vehicle-model-generator.git) - This genereates vehicle model (Python components) from the `VSS.json` file. We use the tag `v0.7.2` of this repo.

## Build target setup stage

```Dockerfile
FROM ubuntu:22.04 AS target-amd64
ENV BUILDTARGET="x86_64-unknown-linux-musl"
COPY ./target/x86_64-unknown-linux-musl/release/databroker /app/databroker

...

FROM ubuntu:22.04 AS target-arm64
ENV BUILDTARGET="aarch64-unknown-linux-musl"
COPY ./target/aarch64-unknown-linux-musl/release/databroker /app/databroker

...
```

We have two build targets currently: AMD64 and ARM64. Each of which will copy the binaries of `/app/databroker` from the corresponding target directory. Usually, we will build both of them anyways.

## Final stage

```Dockerfile
RUN groupadd -r sdvr && useradd -r -g sdvr dev \
    && chown -R dev:sdvr /app/databroker \
    && mkdir /home/dev/ && chown -R dev:sdvr /home/dev/ \
    && apt-get update && apt-get install -y --no-install-recommends python3 mosquitto \
    ca-certificates python-is-python3 nano\
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
```

Create the `dev` user because we want to have a rootless container for security reason. The `dev` directory is also the main working directory of the container during runtime. It has a structure like below:

```
dev/
.
├── /python-packages
├── /vehicle_signal_specification
├── /vehicle-model-generator
└── /ws
    └── /kuksa-syncer
    └── vss.json
```

The following packages are also installed:
- Python3
- python-is-python3
- Mosquitto (for Velocitas SDK)
- ca-certificates (for HTTPS socket.io connection)
- nano (sometimes you want to edit a few files in the containers for testing)

Afterwards, perform cache and other temp files clean up to reduce image size.

```Dockerfile
COPY --from=builder --chown=dev:sdvr --chmod=0755 /app /home/dev/
COPY --chown=dev:sdvr --chmod=0755 kuksa-syncer /home/dev/ws/kuksa-syncer/
COPY mosquitto-no-auth.conf /etc/mosquitto/mosquitto-no-auth.conf
COPY --chown=dev:sdvr --chmod=0755 start_services.sh /start_services.sh

RUN ln -s /home/dev/python-packages/velocitas_sdk /home/dev/python-packages/sdv

USER dev

ENV PYTHONPATH="/home/dev/python-packages/:${PYTHONPATH}"
ENV KUKSA_DATABROKER_ADDR=127.0.0.1
ENV KUKSA_DATABROKER_PORT=55555
ENV KUKSA_DATABROKER_METADATA_FILE=/home/dev/ws/vss.json
EXPOSE $KUKSA_DATABROKER_PORT 1883

WORKDIR /home/dev/

ENTRYPOINT ["/start_services.sh"]
```

Each `COPY` line has `--chown` and `--chmod` to ensure the non-root user `dev` has enough permission to execute them.

Although the package name is `velocitas_sdk`, the playground devs will try to import from `sdv` when they want to use this package. Thereby, we add a soft link between `/home/dev/python-packages/velocitas_sdk` and `/home/dev/python-packages/sdv`.

The rest of is just setting environment paths and ports for the container.

The `start_services.sh` script is added as an entrypoint to run Kuksa datbroker, Kuksa-syncer and Mosquitto when the container starts. It has some arguments as well, for now see [Parse arguments](#parse-arguments)
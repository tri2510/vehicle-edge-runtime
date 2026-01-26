# Start Data broker

## Start with port
```bash
docker run --rm -it -p 55555:55555 ghcr.io/eclipse-kuksa/kuksa-databroker:main --insecure
```

## Start with docker network

```bash
docker network create kuksa
```

```bash
docker run -it --rm --name Server --network kuksa ghcr.io/eclipse-kuksa/kuksa-databroker:main --insecure
```


### Test with docker cli

```bash
docker run -it --rm --network kuksa ghcr.io/eclipse-kuksa/kuksa-databroker-cli:main --server Server:55555
```



# Message from server to RT

```json
{
    "request_from": "omSQcmWWkuqzh2kuAwGc", 
    "cmd": "run_python_app", 
    "to_kit_id": "RunTime-arm64-001", 
    "data": {
        "code": "from sdv_model import Vehicle\nimport plugins\nfrom browser import aio\n\nvehicle = Vehicle()"
    }
}
```


# Support command
List all support cmd below as a list
- deploy_request
- run_python_app
- stop_python_app
- run_bin_app
- subscribe_apis
- unsubscribe_apis
- list_mock_signal
- write_signals_value
- reset_signals_value
- generate_vehicle_model
- revert_vehicle_model
- list_python_packages
- install_python_packages





## CMD: deploy_request
```json
{
    "cmd": "deploy_request",
    "prototype": {},
    "username" : "".
    ...
}
```

## CMD: subscribe_apis
```json
{
    ...
    "cmd": "subscribe_apis",
    "apis": [
        "Vehicle.ABC",
        "Vehicle.X.Y.Z"
    ]
}
```

## CMD: unsubscribe_apis
```json
{
    ...
    "request_from": "client-id",
    "cmd": "unsubscribe_apis"
}
```

## CMD: list_mock_signal
```json
{
    ...
    "request_from": "client-id",
    "cmd": "list_mock_signal"
}
```

## CMD: set_mock_signals
```json
{
    ...
    "request_from": "client-id",
    "cmd": "set_mock_signals",
    "data": {}
}
```

## CMD: write_signals_value

```json
{
    ...
    "request_from": "client-id",
    "cmd": "write_signals_value",
    "data": {}
}
```

## CMD: reset_signals_value
```json
{
    ...
    "request_from": "client-id",
    "cmd": "reset_signals_value"
}
```

## CMD: generate_vehicle_model
```json
{
    ...
    "request_from": "client-id",
    "cmd": "generate_vehicle_model"
}
```

## CMD: revert_vehicle_model
```json
{
    ...
    "request_from": "client-id",
    "cmd": "revert_vehicle_model"
}
```

## CMD: list_python_packages

```json
{
    ...
    "request_from": "client-id",
    "cmd": "list_python_packages"
}
```


## CMD: install_python_packages

```json
{
    ...
    "request_from": "client-id",
    "cmd": "install_python_packages"
}
```


## CMD: run_python_app
```json
{
    ...
    "request_from": "client-id",
    "cmd": "run_python_app",
    "data": {
        "code": "python code",
    },
    "usedAPIs": []
}
```

## CMD: run_bin_app
```json
{
    ...
    "request_from": "client-id",
    "cmd": "run_bin_app",
    "data": "app_name",
    "usedAPIs": []
}
```

## CMD: stop_python_app
```json
{
    ...
    "request_from": "client-id",
    "cmd": "stop_python_app"
}
```

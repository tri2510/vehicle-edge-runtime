# Set up Python guide

The original guide for setting up Python

## VSS and VSS-Tools

```
git clone --recurse-submodules https://github.com/COVESA/vehicle_signal_specification.git 

pip install anytree deprecation graphql-core stringcase setuptools 

python vspec2json.py  -I ../spec -u ../spec/units.yaml ../spec/VehicleSignalSpecification.vspec vss.json 
```

If it runs successfully, it should generate a `vss.json` file to use later on.

## Vehicle Model Generator 

```
pip install pyyaml anytree deprecation graphql-core stringcase setuptools

// install vehicle model generator 

cd mkdir $HOME/ws 

git clone https://github.com/eclipse-velocitas/vehicle-model-generator.git 

cd vehicle-model-generator 

pip install setuptools 

pip install -r requirements.txt 

pip install -r requirements-vss.txt 

python gen_vehicle_model.py -I  /home/dev/ws/vehicle_signal_specification/spec vss.json 

```

## Velocitas SDK 

// install velocitas app sdk - this might take quite a long time. 

// install dependencies 

```
pip install cloudevents

pip install setuptools==59.5.0

pip install wheel // apply this if you have the error "error: invalid command 'bdist_wheel'" 

pip install git+https://github.com/eclipse-velocitas/vehicle-app-python-sdk.git@v0.14.1 

```

- If it runs OK, it should create ~/.local/lib/python3.8/site-packages/sdv 


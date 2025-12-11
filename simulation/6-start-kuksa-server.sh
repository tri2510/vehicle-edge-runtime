#!/bin/bash

# 🚗 Kuksa Databroker Development Server Setup
# This script starts the real Eclipse Kuksa databroker server using Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KUKSA_IMAGE="ghcr.io/eclipse-kuksa/kuksa-databroker:main"
KUKSA_CONTAINER_NAME="kuksa-databroker"
KUKSA_NETWORK="kuksa"
KUKSA_HOST="localhost"
KUKSA_GRPC_PORT=55555
KUKSA_HTTP_PORT=8090
VSS_CONFIG_DIR="./data/configs"
VSS_FILE="$VSS_CONFIG_DIR/vss.json"
PID_FILE="./kuksa-server.pid"

echo -e "${BLUE}🚗 Kuksa Databroker Development Server Setup${NC}"
echo "======================================="

# Function to check if Docker is available
check_docker() {
    if ! command -v docker > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not installed or not accessible${NC}"
        echo "Please install Docker and try again"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is available: $(docker --version)${NC}"
}

# Function to create Docker network if it doesn't exist
create_docker_network() {
    echo -e "${YELLOW}📋 Setting up Docker network...${NC}"

    if ! docker network inspect "$KUKSA_NETWORK" > /dev/null 2>&1; then
        docker network create "$KUKSA_NETWORK"
        echo -e "${GREEN}✅ Created Docker network: $KUKSA_NETWORK${NC}"
    else
        echo -e "${GREEN}✅ Docker network already exists: $KUKSA_NETWORK${NC}"
    fi
}

# Function to create VSS configuration
create_vss_config() {
    echo -e "${YELLOW}📋 Creating VSS configuration...${NC}"

    mkdir -p "$VSS_CONFIG_DIR"

    # Create comprehensive VSS tree for development
    cat > "$VSS_FILE" << 'EOF'
{
  "Vehicle": {
    "description": "Root branch for vehicle signals",
    "type": "branch",
    "children": {
      "Speed": {
        "description": "Vehicle speed",
        "type": "sensor",
        "datatype": "float",
        "unit": "km/h",
        "min": 0,
        "max": 500,
        "uuid": "7e6b3d74-9c8a-4d8e-8b8a-1c8b5d4e1f2a"
      },
      "Acceleration": {
        "description": "Vehicle longitudinal acceleration",
        "type": "sensor",
        "datatype": "float",
        "unit": "m/s^2",
        "min": -10,
        "max": 10,
        "uuid": "8f7c4e85-ad9b-5e9f-9c9b-2d9c6e5f2g3b"
      },
      "SteeringWheel": {
        "description": "Steering wheel branch",
        "type": "branch",
        "children": {
          "Angle": {
            "description": "Steering wheel angle",
            "type": "sensor",
            "datatype": "float",
            "unit": "deg",
            "min": -720,
            "max": 720,
            "uuid": "9g8d5f96-be9c-6f0g-ad0c-3e0d7f6g3h4c"
          }
        }
      },
      "Powertrain": {
        "description": "Powertrain branch",
        "type": "branch",
        "children": {
          "CombustionEngine": {
            "description": "Combustion engine branch",
            "type": "branch",
            "children": {
              "Speed": {
                "description": "Engine speed (RPM)",
                "type": "sensor",
                "datatype": "float",
                "unit": "rpm",
                "min": 0,
                "max": 8000,
                "uuid": "ah9e6g07-cf9d-7g1h-be1d-4f1e8g7h4i5d"
              },
              "IsRunning": {
                "description": "Engine running status",
                "type": "actuator",
                "datatype": "boolean",
                "uuid": "bi0f7h18-dg9e-8h2i-cf2e-5g2f9h8i5j6e"
              }
            }
          },
          "Transmission": {
            "description": "Transmission branch",
            "type": "branch",
            "children": {
              "Gear": {
                "description": "Current gear",
                "type": "sensor",
                "datatype": "int8",
                "min": -1,
                "max": 8,
                "uuid": "cj1g8i29-eh9f-9i3j-dg3f-6h3g0i9j6k7f"
              }
            }
          }
        }
      },
      "Body": {
        "description": "Vehicle body branch",
        "type": "branch",
        "children": {
          "Lights": {
            "description": "Lights branch",
            "type": "branch",
            "children": {
              "IsLowBeamOn": {
                "description": "Low beam headlights status",
                "type": "actuator",
                "datatype": "boolean",
                "uuid": "dk2h9j30-fi9g-aj4k-eh4g-7h4h1j0k7l8g"
              },
              "IsHighBeamOn": {
                "description": "High beam headlights status",
                "type": "actuator",
                "datatype": "boolean",
                "uuid": "el3i0k41-gj9h-bk5l-fi5h-8i5i2k0l8m9h"
              },
              "BrakeLight": {
                "description": "Brake lights status",
                "type": "actuator",
                "datatype": "boolean",
                "uuid": "fm4j1l52-hk9i-cl6m-gj6i-9j6j3l1m9n0i"
              },
              "TurnSignal": {
                "description": "Turn signal status",
                "type": "branch",
                "children": {
                  "IsLeftOn": {
                    "description": "Left turn signal status",
                    "type": "actuator",
                    "datatype": "boolean",
                    "uuid": "gn5k2m63-il9j-dm7n-hk7j-0k7k4m2n0o1j"
                  },
                  "IsRightOn": {
                    "description": "Right turn signal status",
                    "type": "actuator",
                    "datatype": "boolean",
                    "uuid": "ho6l3n74-jm9k-en8o-il8k-1l8l5n3o1p2k"
                  }
                }
              }
            }
          },
          "Hood": {
            "description": "Hood status",
            "type": "actuator",
            "datatype": "boolean",
            "uuid": "ip7m4o85-kn9l-fo9p-jm9l-2m9m6o4p1q3l"
          },
          "Trunk": {
            "description": "Trunk status",
            "type": "actuator",
            "datatype": "boolean",
            "uuid": "jq8n5p96-lo9m-gp0q-kn9m-3n0n7p5q2r4m"
          }
        }
      },
      "Cabin": {
        "description": "Vehicle cabin branch",
        "type": "branch",
        "children": {
          "HVAC": {
            "description": "HVAC branch",
            "type": "branch",
            "children": {
              "Temperature": {
                "description": "Cabin temperature setpoint",
                "type": "actuator",
                "datatype": "float",
                "unit": "°C",
                "min": 16,
                "max": 32,
                "uuid": "kr9o6q07-mp9n-hq1r-lo9n-4o1o8q6r3s5n"
              },
              "AmbientTemperature": {
                "description": "Ambient temperature",
                "type": "sensor",
                "datatype": "float",
                "unit": "°C",
                "min": -40,
                "max": 85,
                "uuid": "ls0p7r18-nq9o-ir2s-mp9o-5p2p9q7s4t6o"
              }
            }
          },
          "Door": {
            "description": "Door status array",
            "type": "branch",
            "children": {
              "IsOpen": {
                "description": "Door open status array",
                "type": "sensor",
                "datatype": "boolean",
                "array": "true",
                "min_size": "1",
                "max_size": "5",
                "uuid": "mt1q8s29-or9p-js3t-nq9p-6q3q0s8t5u7p"
              },
              "IsLocked": {
                "description": "Door lock status array",
                "type": "actuator",
                "datatype": "boolean",
                "array": "true",
                "min_size": "1",
                "max_size": "5",
                "uuid": "nu2r9t30-ps9q-kt4u-or9q-7r4r1t9u6v8q"
              }
            }
          },
          "Seat": {
            "description": "Seat status array",
            "type": "branch",
            "children": {
              "Occupant": {
                "description": "Seat occupant status array",
                "type": "sensor",
                "datatype": "string",
                "array": "true",
                "min_size": "1",
                "max_size": "8",
                "allowed": ["empty", "adult", "child", "object"],
                "uuid": "ov3s0u41-qt9r-lu5v-ps9r-8s5s2u0v7w9r"
              },
              "PosCount": {
                "description": "Seat position count",
                "type": "sensor",
                "datatype": "uint8",
                "min": 1,
                "max": 8,
                "uuid": "pw4t1v52-ru9s-mv6w-qt9s-9t6t3v1w8x0s"
              }
            }
          }
        }
      },
      "ADAS": {
        "description": "ADAS branch",
        "type": "branch",
        "children": {
          "ABS": {
            "description": "ABS status",
            "type": "actuator",
            "datatype": "boolean",
            "uuid": "qx5u2w63-sv9t-nw7x-ru9t-0u7u4w2x9y1t"
          },
          "ESC": {
            "description": "ESC status",
            "type": "actuator",
            "datatype": "boolean",
            "uuid": "ry6v3x74-tw9u-ox8y-sv9u-1v8v5x3y0z2u"
          },
          "TCS": {
            "description": "Traction control status",
            "type": "actuator",
            "datatype": "boolean",
            "uuid": "sz7w4y85-uw9v-py9z-tw9u-2w9w6y4z1a3v"
          }
        }
      }
    }
  }
}
EOF

    echo -e "${GREEN}✅ VSS configuration created at $VSS_FILE${NC}"
}

# Function to stop existing Kuksa container
stop_kuksa_container() {
    if [ -n "$(docker ps -q -f name="$KUKSA_CONTAINER_NAME")" ]; then
        echo -e "${YELLOW}   Stopping existing Kuksa container...${NC}"
        docker stop "$KUKSA_CONTAINER_NAME" || true
    fi

    if docker ps -aq -f name="$KUKSA_CONTAINER_NAME" > /dev/null 2>&1; then
        docker rm "$KUKSA_CONTAINER_NAME" || true
    fi
}

# Function to start Kuksa container
start_kuksa_container() {
    echo -e "${YELLOW}🚀 Starting Kuksa Databroker...${NC}"

    # Stop any existing container
    stop_kuksa_container

    # Create Docker volume for VSS config if it doesn't exist
    VSS_VOLUME_NAME="kuksa-vss-config"
    if ! docker volume inspect "$VSS_VOLUME_NAME" > /dev/null 2>&1; then
        docker volume create "$VSS_VOLUME_NAME"
    fi

    # Copy VSS config to the container volume
    docker run --rm \
        -v "$VSS_VOLUME_NAME:/target" \
        -v "$(realpath "$VSS_CONFIG_DIR"):/source:ro" \
        alpine sh -c "cp /source/vss.json /target/" 2>/dev/null || true

    # Start Kuksa databroker container
    docker run -d \
        --name "$KUKSA_CONTAINER_NAME" \
        --network "$KUKSA_NETWORK" \
        -p "$KUKSA_GRPC_PORT:55555" \
        -p "$KUKSA_HTTP_PORT:8090" \
        -v "$VSS_VOLUME_NAME:/config" \
        "$KUKSA_IMAGE" \
        --insecure \
        --vss /config/vss.json \
        --enable-viss \
        --viss-port 8090

    # Store container information for later use
    echo "$KUKSA_CONTAINER_NAME" > "$PID_FILE"

    echo -e "${GREEN}✅ Kuksa Databroker started successfully!${NC}"
    echo -e "   Container: $KUKSA_CONTAINER_NAME"
}

# Function to wait for Kuksa to be ready
wait_for_kuksa() {
    echo -e "${YELLOW}⏳ Waiting for Kuksa Databroker to be ready...${NC}"

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        # Check if container is running and gRPC port is accessible
        if docker ps -q -f name="$KUKSA_CONTAINER_NAME" | grep -q . > /dev/null 2>&1; then
            # Check if gRPC port is open by testing with timeout
            if timeout 2 bash -c "</dev/tcp/localhost/${KUKSA_GRPC_PORT}" 2>/dev/null; then
                echo -e "${GREEN}✅ Kuksa Databroker is ready!${NC}"
                return 0
            fi
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo -e "\n${RED}❌ Kuksa Databroker failed to start within expected time${NC}"
    echo "Container logs:"
    docker logs "$KUKSA_CONTAINER_NAME"
    return 1
}

# Function to show status and connection info
show_status() {
    echo ""
    echo -e "${BLUE}📊 Kuksa Databroker Status${NC}"
    echo "============================="

    # Container status
    if [ -n "$(docker ps -q -f name="$KUKSA_CONTAINER_NAME")" ]; then
        echo -e "${GREEN}Container Status:${NC}"
        echo "  Name: $KUKSA_CONTAINER_NAME (Running)"
        echo "  Image: $KUKSA_IMAGE"
        echo "  Network: $KUKSA_NETWORK"
    else
        echo -e "${RED}Container Status:${NC}"
        echo "  Not running"
    fi

    # Port status
    echo ""
    echo -e "${GREEN}Port Mappings:${NC}"
    echo "  gRPC:    localhost:${KUKSA_GRPC_PORT} (Kuksa gRPC API)"

    # Environment variables for Vehicle Edge Runtime
    echo ""
    echo -e "${GREEN}Vehicle Edge Runtime Environment Variables:${NC}"
    echo "  export KUKSA_ENABLED=true"
    echo "  export KUKSA_HOST=localhost"
    echo "  export KUKSA_GRPC_PORT=${KUKSA_GRPC_PORT}"
    echo "  export KUKSA_CONNECTION_TYPE=grpc"

    # Test commands
    echo ""
    echo -e "${GREEN}Test Commands:${NC}"
    echo "  # Test VSS tree"
    echo "  curl http://localhost:${KUKSA_HTTP_PORT}/vss"
    echo ""
    echo "  # Test gRPC (requires grpcurl or similar tool)"
    echo "  grpcurl -plaintext localhost:${KUKSA_GRPC_PATH} list"
    echo ""
    echo "  # Start Vehicle Edge Runtime with Kuksa"
    echo "  KUKSA_ENABLED=true KUKSA_HOST=localhost KUKSA_GRPC_PORT=${KUKSA_GRPC_PORT} PORT=3002 node src/index.js"

    echo ""
    echo -e "${GREEN}🎉 Kuksa Databroker is ready for Vehicle Edge Runtime!${NC}"
}

# Function to stop Kuksa
stop_kuksa() {
    echo -e "${YELLOW}🛑 Stopping Kuksa Databroker...${NC}"

    if [ -n "$(docker ps -q -f name="$KUKSA_CONTAINER_NAME")" ]; then
        docker stop "$KUKSA_CONTAINER_NAME"
        echo -e "${GREEN}✅ Kuksa Databroker stopped${NC}"
    else
        echo -e "${YELLOW}⚠️ Kuksa Databroker container not running${NC}"
    fi

    if docker ps -aq -f name="$KUKSA_CONTAINER_NAME" > /dev/null 2>&1; then
        docker rm "$KUKSA_CONTAINER_NAME"
    fi

    rm -f "$PID_FILE"
}

# Main execution
main() {
    case "${1:-start}" in
        "start"|"")
            check_docker
            create_docker_network
            create_vss_config
            start_kuksa_container
            if wait_for_kuksa; then
                show_status
            else
                echo -e "${RED}❌ Failed to start Kuksa Databroker${NC}"
                stop_kuksa
                exit 1
            fi
            ;;
        "stop")
            stop_kuksa
            ;;
        "status")
            if [ -n "$(docker ps -q -f name="$KUKSA_CONTAINER_NAME")" ]; then
                show_status
            else
                echo -e "${RED}❌ Kuksa Databroker is not running${NC}"
                echo "Run '$0 start' to start the development server"
            fi
            ;;
        "restart")
            stop_kuksa
            sleep 2
            main start
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start    Start Kuksa Databroker (default)"
            echo "  stop     Stop Kuksa Databroker"
            echo "  status   Show Kuksa Databroker status"
            echo "  restart  Restart Kuksa Databroker"
            echo "  help     Show this help message"
            echo ""
            echo "This script starts the real Eclipse Kuksa databroker using Docker."
            echo "It provides gRPC and HTTP APIs for vehicle data access."
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo "Use '$0 help' for available commands"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}⚠️ Script interrupted${NC}"; stop_kuksa; exit 1' INT

# Run main function
main "$@"
#!/bin/sh

if [[ $# -lt 2 ]] ; then
    echo
    echo "Usage: $0 <vchain> <listen_port> [config_url]"
    echo "Example: $0 2001 3020 https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json 3020"
    echo "Example 2: $0 2001 3020"
    echo
    echo "If last parameter is not provided, takes config from config/prod-topology.json"
    echo
    exit 1
fi

VCHAIN=$1
PROM_CLIENT_PORT=$2
NET_CONFIG_URL=$3

DATE=$(date +%Y-%m-%d-%H%M%S)
mkdir -p logs
LOG_FILE="logs/prom_client.log"

echo
echo "===== STARTING TO RUN PROMETHEUS CLIENT VCHAIN=${VCHAIN} PORT=${PROM_CLIENT_PORT} NET_CONFIG=${NET_CONFIG_URL} ====="
echo
echo "Network config: ${NET_CONFIG_URL}"
echo
touch ${LOG_FILE}
echo "===START=== vchain=${VCHAIN} port=${PROM_CLIENT_PORT} net_config=${NET_CONFIG_URL}" >> ${LOG_FILE}
CMD="node dist/prometheus-client.js ${VCHAIN} ${PROM_CLIENT_PORT} ${NET_CONFIG_URL}"
echo "Running command: ${CMD}"
echo
node prometheus-client.js ${VCHAIN} ${PROM_CLIENT_PORT} ${NET_CONFIG_URL} >> ${LOG_FILE} & CMDPID=$!
echo
echo "Started process ID $CMDPID. To stop it, run:"
echo "kill $CMDPID"
echo
echo "To follow progress, run:"
echo
echo "tail -100f ${LOG_FILE}"
echo
echo "To test, run:"
echo
echo "curl http://localhost:${PROM_CLIENT_PORT}/metrics"
echo


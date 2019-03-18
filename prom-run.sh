#!/bin/sh

if [[ $# -lt 3 ]] ; then
    echo
    echo "Usage: $0 <vchain> <config_url> <listen_port>"
    echo "Example: $0 2001 https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json 3020"
    echo
    exit 1
fi

if [[ -n "$1" ]] ; then
    export VCHAIN=$1
fi

if [[ -n "$2" ]] ; then
    export NET_CONFIG_URL=$2
fi

if [[ -n "$1" ]] ; then
    export PROM_CLIENT_PORT=$3
fi


DATE=$(date +%Y-%m-%d-%H%M%S)
mkdir -p logs
LOG_FILE="logs/prom_client_${DATE}.log"

echo
echo "===== STARTING TO RUN PROMETHEUS CLIENT VCHAIN=${VCHAIN} PORT=${PROM_CLIENT_PORT} ====="
echo
echo "Network config: ${NET_CONFIG_URL}"
echo
touch ${LOG_FILE}
echo "===START=== vchain=${VCHAIN} port=${PROM_CLIENT_PORT} config=${NET_CONFIG_URL}" > ${LOG_FILE}
node prometheus-client.js ${VCHAIN} ${NET_CONFIG_URL} ${PROM_CLIENT_PORT} ${DATE} >> ${LOG_FILE} & CMDPID=$!
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
tail -100f ${LOG_FILE}

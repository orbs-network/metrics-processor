#!/bin/sh

if [[ $# -lt 2 ]] ; then
    echo
    echo "Usage: $0 <vchain> <config_url>"
    echo "Example: $0 2001 https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json"
    echo
    exit 1
fi

if [[ -n "$1" ]] ; then
    export VCHAIN=$1
fi

if [[ -n "$2" ]] ; then
    export NET_CONFIG_URL=$2
fi

DATE=$(date +%Y-%m-%d-%H%M%S)
mkdir -p logs
LOG_FILE="logs/prom_client_${DATE}.log"

echo
echo "===== STARTING TO RUN PROMETHEUS CLIENT VCHAIN=${VCHAIN} ====="
echo
touch ${LOG_FILE}
node prometheus-client.js metrics_prometheus ${DATE} > ${LOG_FILE} & CMDPID=$!
echo
echo "Started process ID $CMDPID. To stop it, run:"
echo "kill $CMDPID"
echo
echo "To follow progress, run:  tail -100f ${LOG_FILE}"
echo

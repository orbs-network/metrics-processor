#!/bin/sh

if [[ -z ${VCHAIN} ]] ; then
    echo "VCHAIN is undefined"
    exit 1
fi

if [[ -z ${NODE_IPS} ]] ; then
    echo "NODE_IPS is undefined, it needs to contain comma-separated list of Nodes' IP addresses"
    exit 1
fi

DATE=$(date +%Y-%m-%d-%H%M%S)
mkdir -p logs
LOG_FILE="logs/prom_client_${DATE}.log"

echo
echo "===== STARTING TO RUN PROMETHEUS CLIENT ====="
echo
touch ${LOG_FILE}
node prometheus-client.js metrics_prometheus ${DATE} > ${LOG_FILE} & CMDPID=$!
echo
echo "Started process ID $CMDPID. To stop it, run:"
echo "kill $CMDPID"
echo
echo "To follow progress, run:  tail -f ${LOG_FILE}"
echo

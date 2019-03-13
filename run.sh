#!/bin/sh -xe

if [[ -z ${GECKO_API_KEY} ]] ; then
    echo "GECKO_API_KEY is undefined"
    exit 1
fi

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
LOG_FILE="logs/metric_processor_${DATE}.log"

echo
echo "===== STARTING TO RUN METRICS_PROCESSOR ====="
echo
touch ${LOG_FILE}
node index.js metrics_processor ${DATE} > ${LOG_FILE} & CMDPID=$!
echo
echo "Started process ID $CMDPID. To stop it, run:"
echo "kill $CMDPID"
echo
echo "To follow progress, run:  tail -f ${LOG_FILE}"
echo

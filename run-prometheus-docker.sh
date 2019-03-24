#!/bin/sh

if [[ -z ${GRAFANA_HOSTED_PROMETHEUS_API_KEY} ]] ; then
    echo "GRAFANA_HOSTED_PROMETHEUS_API_KEY is undefined!"
    exit 1
fi

./env_vars_resolver.sh
echo "Created resolved config file"
# Could also use --network=host instead of "-p 9090:9090" to open all ports (depends on security)

sudo docker run -d --restart=always -p 9090:9090 -v /home/ec2-user/metrics-processor/prometheus/prometheus-resolved.yml:/etc/prometheus/prometheus.yml prom/prometheus
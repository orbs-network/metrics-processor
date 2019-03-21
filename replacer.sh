#!/bin/sh

sed -e "s/\${GRAFANA_HOSTED_PROMETHEUS_API_KEY}/${GRAFANA_HOSTED_PROMETHEUS_API_KEY}/" prometheus/prometheus.yml > prometheus/prometheus-resolved.yml
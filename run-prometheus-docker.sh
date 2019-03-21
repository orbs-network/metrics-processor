#!/bin/sh

sudo docker run -d --restart=always -p 9090:9090 -v /home/ec2-user/metrics-processor/prometheus/prometheus-resolved.yml:/etc/prometheus/prometheus.yml prom/prometheus
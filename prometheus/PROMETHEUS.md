# Prometheus server

This is the doc for the Prometheus server that runs on AWS.
The metrics-processor read metrics from the `/metrics` endpoint of every node, converts to Prometheus format and sends to the Prometheus server.
The prometheus server is configured to push the metrics to Hosted Prometheus on a Grafana Cloud.

Current dashboard is here: https://orbsnetwork.grafana.net/d/-elfNIjmz/orbs-stabilitynet?tab=queries&orgId=1

## Configuration
See the file prometheus.yml in this folder.
* remote_write --> basic_auth --> password: paste a Hosted Grafana API key with `metrics_pusher` authorization.

### Docker
See Prometheus documentation on how to install with a docker container

### AWS machine
* ec2-user@34.216.213.19


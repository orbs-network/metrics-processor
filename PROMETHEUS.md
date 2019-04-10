# General

This doc describes the architecture for collection and display of Orbs Nodes' metrics.


# Architecture
The following components are used together to collect and display metrics:
* `Grafana Dashboards` 
* `Prometheus Bridge Server` 
* `Metrics Processor`

## Grafana Dashboards

Dashboards are served from Grafana Cloud.
Grafana Cloud is a Hosted 3rd-party solution. It has a builtin Prometheus database.
The `Prometheus bridge server` pushes data to the Prometheus database using [remote_write](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#remote_write).

* [Orbs Production](https://orbsnetwork.grafana.net/d/a-3pW-3mk/orbs-production?orgId=1&refresh=10s&from=now-3h&to=now&refresh=10s)
* [Orbs DevOps](https://orbsnetwork.grafana.net/d/Eqvddt3iz/orbs-devops?tab=queries&orgId=1&from=now-3h&to=now&refresh=10s)

## Prometheus Bridge Server
Runs on AWS in a *Docker* container (see below). It is configured to periodically pull from `Metrics Processor`, then immediately push the same data to Grafana Cloud. 
It is just a bridge, and is necessary because the Prometheus database of the Grafana Cloud cannot *pull* data, it can only receive *pushed* data.

### Configuration

Docker configuration in file `prometheus/prometheus.yml`

### Network topology
Network topology is read from a URL in JSON format once when the process starts. If network topology changes, this process needs to be restarted.

### Starting docker container 
See Prometheus documentation on how to install it as a docker container.
Define the environment variable `GRAFANA_HOSTED_PROMETHEUS_API_KEY` according to Grafana cloud configuration
* Edit the copied prometheus.yml:
  * Set scrape_configs-->static_configs-->targets to 172.17.0.1:3020
  172.17.0.1 is the IP address of the Docker host machine, 3020 is the metrics_processor listener port
* Starting Prometheus docker container for the first time:

    > sudo ./run-prometheus-docker.sh

* After modifying configuration in `prometheus/prometheus.yml` you need to restart the docker container:

    > ./env_var_resolver.sh    (this creates the resolved yml config file that docker reads)    
    > sudo docker restart $(sudo docker ps -a -q)
    
* Verify it runs successfully by printing logs:

    > sudo docker logs $(sudo docker ps -a -q)

## Metrics Processor
Node.js process that runs on AWS. Reads metrics from `/metrics` endpoint of every node, converts to Prometheus format and sends to `Prometheus bridge server`.

    > This is subject to change once Orbs node switches to publishing metrics directly in Prometheus format. 

## Troubleshooting
In case you cannot stop a container, retsart the Docker service:

    > sudo service docker restart
    
### AWS machine
* ec2-user@34.216.213.19


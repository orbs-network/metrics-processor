# General

** UNDER CONSTRUCTION **
** Needs to merge with README.md **

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

### Installation
* [Docker installation on Amazon EC2](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/docker-basics.html#install_docker)
* *Check relevant Docker docs for other platforms*
* Make sure you enable your user to run Docker commands without sudo:

    > sudo usermod -a -G docker <your_username>

### Network topology
Network topology is read from a URL in JSON format once when the process starts. If network topology changes, this process needs to be restarted.

### Running inside docker container 
We run Prometheus Bridge Server as a [Docker container](https://prometheus.io/docs/prometheus/latest/installation/#using-docker).

* You **must** define the environment variable `GRAFANA_HOSTED_PROMETHEUS_API_KEY` according to `Grafana Cloud` configuration
* Edit `prometheus/prometheus.yml`:
  * Set scrape_configs-->static_configs-->targets to 172.17.0.1:3020
  172.17.0.1 is the IP address of the Docker host machine, 3020 is the metrics_processor listener port

* To start Prometheus Docker container for the first time:

    > ./run-prometheus-docker.sh

* After modifying configuration in `prometheus/prometheus.yml` you need to restart the docker container:

    > ./env_var_resolver.sh    (this creates the resolved yml config file that docker reads)    
    > docker restart $(sudo docker ps -q)
    
* Verify it runs successfully by printing logs:

    > docker logs $(sudo docker ps -q)

## Metrics Processor
Node.js process that runs on AWS. Reads metrics from `/metrics` endpoint of every node, converts to Prometheus format and sends to `Prometheus bridge server`.

    > This is subject to change once Orbs node switches to publishing metrics directly in Prometheus format. 

## Troubleshooting

### Metrics stop showing on Grafana
* Run `ssh ec2-user@34.216.213.19`
* Run `pm2 list all` and verify processes are running
* Run `sudo docker container ls` and verify Prometheus docker is running
* Run `sudo docker logs $(sudo docker ps -q)` to see Prometheus Docker logs
* Contact [Grafana support](mailto:support@grafana.com)

### Prometheus Docker container
* To restart the Docker container:
    > docker restart $(sudo docker ps -q)
* To stop the Docker container:
    > docker stop $(sudo docker ps -q)
* In case you cannot stop the Docker container, restart the Docker service:

    > service docker restart 
    
### AWS machine
* ec2-user@34.216.213.19


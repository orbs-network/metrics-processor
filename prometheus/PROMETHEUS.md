# Prometheus server

This is the doc for the Prometheus server that runs on AWS.

## Architecture
* metrics-processor - Node.js process that runs on AWS. It reads metrics from the `/metrics` endpoint of every node, converts to Prometheus format and sends to the Prometheus server.
* Prometheus bridge server - Runs on AWS in a Docker container (see below). It is configured to pull from `metrics-processor` and immediately push the same data to Grafana Cloud. Essentially it is just a bridge.
* Grafana Cloud - Hosted Grafana solution (3rd-party), has a builtin Prometheus server that receives its data from `Prometheus bridge server` by [remote_write](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#remote_write) (this is how Prometheus pushes data)

Current dashboard is here: https://orbsnetwork.grafana.net/d/-elfNIjmz/orbs-stabilitynet?tab=queries&orgId=1

## Configuration

See the file prometheus.yml in this folder.

## Network topology
Network topology is read from a URL in JSON format once when the process starts. If network topology changes, this process needs to be restarted.

### Docker
See Prometheus documentation on how to install with a docker container.
* Copy prometheus/prometheus.yml to another location such as the home directory `/home/ec2-user`
* Edit the copied prometheus.yml:
  * Replace the password under remote_write/basic_auth with an actual API key
  * Set scrape_configs-->static_configs-->targets to 172.17.0.1:3020
  172.17.0.1 is the IP address of the Docker host machine, 3020 is the metrics_processor listener port
* Start Prometheus docker container - you may need to prefix the command with `sudo`:

    docker run -d --restart=always -p 9090:9090 -v /home/ec2-user/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
    -- or --
    docker run -d --restart=always --network=host -v /home/ec2-user/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus

### AWS machine
* ec2-user@34.216.213.19


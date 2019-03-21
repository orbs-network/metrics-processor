# Prometheus server

This is the doc for the Prometheus server that runs on AWS.
The Prometheus server acts as a bridge - it pull metrics from `metrics-processor` and pushes it to Hosted Grafana's Prometheus using `remote_write`.

## Architecture
* metrics-processor - Node.js process that runs on AWS. It reads metrics from the `/metrics` endpoint of every node, converts to Prometheus format and sends to the Prometheus server.
* Prometheus bridge server - Runs on AWS in a Docker container (see below). It is configured to pull from `metrics-processor` and immediately push the same data to Grafana Cloud. Essentially it is just a bridge.
* Grafana Cloud - Hosted Grafana solution (3rd-party), has a builtin Prometheus server that receives its data from `Prometheus bridge server` by [remote_write](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#remote_write) (this is how Prometheus pushes data)

Current dashboard is here: https://orbsnetwork.grafana.net/d/-elfNIjmz/orbs-stabilitynet?tab=queries&orgId=1

## Configuration

See the file prometheus.yml in this folder.
After modifying configuration

## Network topology
Network topology is read from a URL in JSON format once when the process starts. If network topology changes, this process needs to be restarted.

### Docker
See Prometheus documentation on how to install with a docker container.
Define the environment variable `GRAFANA_HOSTED_PROMETHEUS_API_KEY` according to Grafana cloud configuration.
* Copy prometheus/prometheus.yml to another location such as the home directory `/home/ec2-user`
* Edit the copied prometheus.yml:
  * Replace the password under remote_write/basic_auth with an actual API key
  * Set scrape_configs-->static_configs-->targets to 172.17.0.1:3020
  172.17.0.1 is the IP address of the Docker host machine, 3020 is the metrics_processor listener port
* Start Prometheus docker container - you may need to prefix the command with `sudo`:

    > sudo docker run -d --restart=always -p 9090:9090 -v /home/ec2-user/metrics-processor/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus

Instead of `-p 9090:9090` you may also use  `--network=host`

* After modifying configuration in `prometeus.yml` you need to restart the docker container:
    
    > sudo docker restart $(sudo docker ps -a -q)
    
* Verify it runs successfully by printing logs:

    > sudo docker logs $(sudo docker ps -a -q)

### AWS machine
* ec2-user@34.216.213.19


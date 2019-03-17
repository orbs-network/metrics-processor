# metrics-processor
Metrics processor for Orbs Network

# Setup
* Clone the repo
* Run `npm install`
* Export environment variables: GECKO_API_KEY, NODE_IPS (comma-separated list of IPs), VCHAIN
* Run `node gecko-client.js`

# PM2 setup
To make sure the process is not stopped due to system restarts, we protect it with [pm2](http://pm2.keymetrics.io/).
* Run: `pm2 start prometheus-client.js --name prometheus-client`
* Run: `pm2 startup`
* Make sure to have the following env variables defined:
  * VCHAIN (for example 2001)
  * NET_CONFIG_URL (for example "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json")
  * PROM_CLIENT_PORT (for example 3020)
  

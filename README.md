# metrics-processor
Metrics processor for Orbs Network

# Setup
* Clone the repo
* Run `npm install`
* Export environment variables: GECKO_API_KEY, NODE_IPS (comma-separated list of IPs), VCHAIN
* Run `node gecko-client.js`

# PM2 setup
To make sure the process is not stopped due to system restarts, we protect it with [pm2](http://pm2.keymetrics.io/).
* Edit the file `pm2/ecosystem.config.js` - presently has 3 instances, one per production vchain.
* Run: `pm2 start pm2/ecosystem.config.js`
* Run: `pm2 startup`
* Make sure to have the following env variables defined:
  * VCHAIN (for example 2001)
  * NET_CONFIG_URL (for example "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json")
  * PROM_CLIENT_PORT (for example 3020)
  
# Updating Production nodes
* Edit the file `config/prod-topology.json`
* Commit the file
* Go to client machine: `ssh ec2-user@34.216.213.19`
* `cd metrics-processor`
* `git pull`
* Restart with pm2: `pm2 restart pm2/ecosystem.config.js`
  * To restart a specific instance, use: `pm2 list all` and then `pm2 stop 0 (for example)`
  * To tail the logs, run: `pm2 logs`
* Otherwise stop the running node process (find it with `ps -fe | grep "node prom"`)
# metrics-processor
Metrics processor for Orbs Network

# Setup
* Clone the repo `https://github.com/orbs-network/metrics-processor`
* Run `npm install`
* Run `npm run build`

# PM2 setup
To make sure the process is not stopped due to system restarts, we protect it with [pm2](http://pm2.keymetrics.io/).
* Edit the file `pm2/ecosystem.config.js` - presently has 3 instances, one per production vchain.
* Run: `pm2 start pm2/ecosystem.config.js`
    > If you get `not found: dist/prometheus-client.js` you probably forgot to run `npm run build`
* Run: `pm2 startup`
* Make sure to have the following env variables defined:
  * VCHAIN (for example 2001)
  * NET_CONFIG_URL (for example "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json")
  * PROM_CLIENT_PORT (for example 3020)
  
# Updating Production nodes

* Edit the file `config/prod-topology.json` (or another relevant file, see ecosystem.config.js)`
* Commit/push the file to `master`
* Go to client machine: `ssh ec2-user@34.216.213.19`
* Run `./update.sh`, - or - perform these steps manually:
    * `cd metrics-processor`
    * `git pull`
    * `npm run build` (this rebuilds js files from Typescript - required!)
    * `pm2 restart all` or `pm2 restart pm2/ecosystem.config.js` (this restart scraper processes with pm2 node manager)
        * To restart a specific instance, use: `pm2 list all` and then `pm2 stop 0 (for example)`
        * To tail the logs, run: `pm2 logs`
    * If pm2 config file `ecosystem.config.js` has changed, you must run: `pm2 reload pm2/ecosystem.config.js --update-env`
    * Otherwise stop the running node process (find it with `ps -fe | grep "node prom"`)
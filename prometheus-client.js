const express = require('express');
const rp = require('request-promise-native');
const _ = require('lodash');
const client = require('prom-client'); // https://github.com/siimon/prom-client
const Gauge = client.Gauge;
const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;
const promGauges = require('./prometheus/prom-gauges');
const info = require('./util').info;
const debug = require('./util').debug;
const lookup = require('./prometheus/lookup_reader');

// Stability net: NET_CONFIG_URL = "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json";
// Integrative net: NET_CONFIG_URL = "https://s3.us-east-2.amazonaws.com/boyar-integrative-e2e/boyar/config.json";
// Validators net: NET_CONFIG_URL = "https://s3.amazonaws.com/boyar-bootstrap-test/boyar/config.json";

const IGNORED_IPS = [];
const myArgs = process.argv.slice(2);
const app = express();
let vchain, net_config, listen_port;

const defaultMetricsStopper = collectDefaultMetrics({timeout: 5000});
// clearInterval(defaultMetricsStopper);
// client.register.clear();

async function main() {
    const { machines, gauges, aggregatedGauges } = await init();
    app.get('/metrics', _.partial(getMetrics, machines, gauges, aggregatedGauges));
    // app.get('/metrics/counter', _.partial(getCounter, machines, gauges));
    app.listen(listen_port, () => info(`Prometheus client listening on port ${listen_port}!`));
}

// basically returns God object
async function init() {
    assertEnvVars();

    let machines;
    try {
        machines = await loadNetworkConfig(net_config);
    } catch (err) {
        info(`Failed to load config from ${net_config}, exiting.`);
        process.exit(1);
    }

    lookup.read('config/lookup.json');

    const gauges = promGauges.initGauges();
    const aggregatedGauges = {
        totalNodes: new Gauge({
            name: 'total_node_count', help: 'Total Node Count', labelNames: ['vchain']
        })
    };

    await refreshMetrics(machines, gauges, aggregatedGauges);
    console.log(machines);
    return { machines, gauges, aggregatedGauges };
}

async function refreshMetrics(machines, gauges, aggregatedGauges) {
    const now = new Date();
    return collectAllMetrics(machines)
        .then(() => {
            aggregatedGauges.totalNodes.set({vchain: vchain}, _.keys(machines).length, now);
            // FIXME does not actually wait for anything
            _.forEach(machines, ({ ip, lastMetrics}) => {
                updateMetrics({ gauges, now, ip, lastMetrics });
            });
        })
        .catch(err => {
            info(`Error collecting metrics: ${err}`);
        });
}

function updateMetrics({ gauges, now, ip, lastMetrics }) {
    const machineName = lookup.ipToNodeName(ip);
    const regionName = lookup.ipToRegion(ip);

    _.forEach(gauges, g => {
        if (!lastMetrics[g.metricName]) {
            info(`Metric ${g.metricName} is undefined!`);
            return;
        }

        const value = lastMetrics[g.metricName]["Value"];
        if (value === "") {
            return;
        }
        try {            
            debug(`Set ip=${ip} machineName=${machineName} region=${regionName} ${g.metricName}=${value}`);
            g.gauge.set({
                machine: machineName,
                region: regionName,
                vchain: vchain
            }, value, now);
        } catch (err) {
            info(`Failed to set value of ${g.metricName} of machine ${machineName} vchain ${vchain}: ${err}`);
            return;
        }
    });
}


async function collectMetricsFromSingleMachine(machine) {
    const url = `http://${machine["ip"]}/vchains/${vchain}/metrics`;
    const options = {
        uri: url,
        timeout: 10000,
        json: true
    };
    // machine["lastMetrics"][promGauges.META_NODE_LAST_SEEN_TIME_NANO] = machine["lastMetrics"][promGauges.META_NODE_LAST_SEEN_TIME_NANO] || {};
    return rp(options)
        .then(res => {
            // machine["lastMetrics"][promGauges.META_NODE_LAST_SEEN_TIME_NANO]["Value"] = new Date().getTime();
            machine["lastMetrics"] = res;
            return machine;
        })
        .catch(err => {
            info(`Failed to receive metrics from ${url}: ${err}`);
            machine["lastMetrics"] = null;
            return machine;
        });
}

function collectAllMetrics(machines) {
    const promises = [];
    info(`Collecting metrics from ${_.keys(machines).length} machines on vchain ${vchain} ...`);
    _.map(machines, machine => {
        promises.push(collectMetricsFromSingleMachine(machine));
    });
    // info(`Wait for all ${_.keys(machines).length} machines to return metrics`);
    return Promise.all(promises);
}

async function getMetrics(machines, gauges, aggregatedGauges, req, res) {
    // info("Called /metrics");
    await refreshMetrics(machines, gauges, aggregatedGauges);
    res.set('Content-Type', register.contentType);
    info("Return from /metrics");
    res.end(register.metrics());
};

// FIXME not used anywhere
async function getCounter(machines, req, res) {
    // info("Called /metrics/counter");
    await refreshMetrics(machines);
    res.set('Content-Type', register.contentType);
    res.end(register.getSingleMetricAsString('block_height'));
};

async function loadNetworkConfig(configUrl) {
    info("Loading network config from " + configUrl);

    const options = {
        uri: configUrl,
        timeout: 10000,
        json: true
    };
    return rp(options)
        .then(res => {
            const machines = {};

            _.map(res["network"], machine => {
                info(`FOUND machine ${machine["ip"]}`);
                if (_.findIndex(IGNORED_IPS, el => el === machine["ip"]) > -1) {
                    info(`IGNORED machine ${machine["ip"]}`);
                    return;
                }
                machines[machine["ip"]] = {
                    ip: machine["ip"],
                    address: machine["address"]
                };
                info(`ADDED machine ${JSON.stringify(machines[machine["ip"]])}`);
            });

            return machines;
        })
        .catch(err => {
            info("Failed to load network config: ", err);
            throw err
        })
}

function assertEnvVars() {

    if (myArgs.length < 3) {
        info("Usage {VCHAIN} {NET_CONFIG_URL} {PROM_CLIENT_PORT}");
        info("For example: ./prom-run.sh 2001 https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json 3020");
        process.exit(1);
    }

    vchain = myArgs[0];
    if (!vchain || vchain === "") {
        info("Error: one or more of the following environment variables is undefined: VCHAIN");
        process.exit(1);
    }

    net_config = myArgs[1];
    if (!net_config || net_config === "") {
        info("Error: one or more of the following environment variables is undefined: NET_CONFIG_URL", net_config);
        process.exit(1);
    }
    info(net_config);

    listen_port = myArgs[2];
    if (!listen_port || listen_port === "") {
        info("Error: one or more of the following environment variables is undefined: PROM_CLIENT_PORT");
        process.exit(1);
    }
}

if (!module.parent) {
    main();
} else {
    module.exports = {
        collectAllMetrics,
    }
}

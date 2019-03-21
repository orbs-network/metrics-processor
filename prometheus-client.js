const express = require('express');
const rp = require('request-promise-native');
const _ = require('lodash');
const client = require('prom-client'); // https://github.com/siimon/prom-client
const Gauge = client.Gauge;
const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;
const promGauges = require('./prometheus/prom-gauges');
const info = require('./util').info;

// Stability net
// const NET_CONFIG_URL = "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json";

// Integrative net
// const NET_CONFIG_URL = "https://s3.us-east-2.amazonaws.com/boyar-integrative-e2e/boyar/config.json";

// const IGNORED_IPS = ['52.9.19.13'];
const IGNORED_IPS = [];


const myArgs = process.argv.slice(2);

const app = express();

let vchain, net_config, listen_port;
const machines = {};



let gTotalNodes;

const defaultMetricsStopper = collectDefaultMetrics({timeout: 5000});
let gauges = [];

// clearInterval(defaultMetricsStopper);
// client.register.clear();

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

async function init() {

    assertEnvVars();

    try {
        await loadNetworkConfig(net_config);
    } catch (err) {
        info(`Failed to load config from ${net_config}, exiting.`);
        process.exit(1);
    }

    gauges = promGauges.initGauges();

    gTotalNodes = new Gauge({name: 'total_node_count', help: 'Total Node Count', labelNames: ['vchain']});

    await refreshMetrics();
}

async function refreshMetrics() {
    const now = new Date();
    return collectAllMetrics(now)
        .then(() => {
            gTotalNodes.set({vchain: vchain}, _.keys(machines).length, now);
            _.forEach(machines, machine => {
                updateMetrics(machine, now);
            });
        })
        .catch(err => {
            info(`Error collecting metrics: ${err}`);
        });
}


function updateMetrics(machine, now) {

    _.forEach(gauges, g => {
        if (!machine["lastMetrics"][g.metricName]) {
            info(`Metric ${g.metricName} is undefined!`);
            return;
        }
        if (machine["lastMetrics"][g.metricName]["Value"]==="") {
            return;
        }
        try {
            g.gauge.set({
                machine: machine["ip"],
                vchain: vchain
            }, machine["lastMetrics"][g.metricName]["Value"], now);
        } catch(err) {
            info(`Failed to set value of ${g.metricName} of machine ${machine["ip"]} vchain ${vchain}: ${err}`);
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


function collectAllMetrics() {
    const promises = [];
    info(`Collecting metrics from ${_.keys(machines).length} machines on vchain ${vchain} ...`);
    _.map(machines, machine => {
        promises.push(collectMetricsFromSingleMachine(machine));
    });
    // info(`Wait for all ${_.keys(machines).length} machines to return metrics`);
    return Promise.all(promises);
}


app.get('/metrics', async (req, res) => {
    // info("Called /metrics");
    await refreshMetrics();
    res.set('Content-Type', register.contentType);
    info("Return from /metrics");
    res.end(register.metrics());
});

app.get('/metrics/counter', async (req, res) => {
    // info("Called /metrics/counter");
    await refreshMetrics();
    res.set('Content-Type', register.contentType);
    res.end(register.getSingleMetricAsString('block_height'));
});

async function loadNetworkConfig(configUrl) {
    info("Loading network config from " + configUrl);
    const options = {
        uri: configUrl,
        timeout: 10000,
        json: true
    };
    return rp(options)
        .then(res => {
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
            })
        })
        .catch(err => {
            info("Failed to load network config: ", err);
            throw err
        })
}

async function main() {
    await init();
    app.listen(listen_port, () => info(`Prometheus client listening on port ${listen_port}!`));
}

main();

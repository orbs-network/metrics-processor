const Promise = require("bluebird");
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
    const processor = await init();
    app.get('/metrics', _.partial(getMetrics, processor));
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

    const lookup = require('./prometheus/lookup_reader');
    lookup.read('./config/lookup.json');

    const gauges = promGauges.initGauges();
    const aggregatedGauges = {
        totalNodes: new Gauge({
            name: 'total_node_count', help: 'Total Node Count', labelNames: ['vchain']
        })
    };

    const processor = {
        data: {
            metrics: {},
            prometheus: {
                gauges,
                aggregatedGauges,
            }
        },
        config: {
            machines,
            lookup,
        }
    };

    await refreshMetrics(processor);
    return processor;
}

async function refreshMetrics(processor) {
    const now = new Date();
    return collectAllMetrics(processor.config.machines)
        .then((metrics) => {
            _.merge(processor.data.metrics, metrics);

            processor.data.prometheus.aggregatedGauges.totalNodes.set({vchain: vchain}, _.keys(processor.config.machines).length, now);
            // FIXME does not actually wait for anything
            _.forEach(processor.config.machines, ({ ip }) => {
                const lastMetrics = processor.data.metrics[ip];
                updateMetrics({
                    gauges: processor.data.prometheus.gauges,
                    lookup: processor.config.lookup,
                    now, ip, lastMetrics
                });
            });
        })
        .catch(err => {
            info(`Error collecting metrics: ${err}`);
        });
}

function updateMetrics({ gauges, lookup, now, ip, lastMetrics }) {
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


async function collectMetricsFromSingleMachine(ip) {
    const url = `http://${ip}/vchains/${vchain}/metrics`;
    const options = {
        uri: url,
        timeout: 10000,
        json: true
    };
    return rp(options)
        .catch(err => {
            info(`Failed to receive metrics from ${url}: ${err}`);
            return null;
        });
}

async function collectAllMetrics(machines) {
    const metrics = {};
    info(`Collecting metrics from ${_.keys(machines).length} machines on vchain ${vchain} ...`);

    _.forEach(machines, ({ ip }) => {
        metrics[ip] = collectMetricsFromSingleMachine(ip);
    });

    return Promise.props(metrics);
}

async function getMetrics(processor, req, res) {
    // info("Called /metrics");
    await refreshMetrics(processor);
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

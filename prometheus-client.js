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

const defaultMetricsStopper = collectDefaultMetrics({timeout: 5000});
// clearInterval(defaultMetricsStopper);
// client.register.clear();

async function main({ vchain, ignoredIPs, boyarConfigURL, port }) {
    const processor = await init({ vchain, ignoredIPs, boyarConfigURL });

    const app = express();
    app.get('/metrics', _.partial(getMetrics, processor));
    app.listen(port, () => info(`Prometheus client listening on port ${port}!`));
}

// basically returns God object
async function init({ vchain, ignoredIPs, boyarConfigURL }) {
    let machines;
    try {
        machines = await loadNetworkConfig({ boyarConfigURL, ignoredIPs });
    } catch (err) {
        info(`Failed to load config from ${boyarConfigURL}, exiting.`);
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
            vchain,
            ignoredIPs,
            boyarConfigURL
        }
    };

    await refreshMetrics(processor);
    return processor;
}

async function refreshMetrics(processor) {
    const now = new Date();
    return collectAllMetrics(processor.config.machines, processor.config.vchain)
        .then((metrics) => {
            _.merge(processor.data.metrics, metrics);

            processor.data.prometheus.aggregatedGauges.totalNodes.set({vchain: processor.config.vchain}, _.keys(processor.config.machines).length, now);
            // FIXME does not actually wait for anything
            _.forEach(processor.config.machines, ({ ip }) => {
                const lastMetrics = processor.data.metrics[ip];
                updateMetrics({
                    gauges: processor.data.prometheus.gauges,
                    config: processor.config,
                    now, ip, lastMetrics
                });
            });
        })
        .catch(err => {
            info(`Error collecting metrics: ${err}`);
        });
}

function updateMetrics({ gauges, config: { lookup, vchain }, now, ip, lastMetrics }) {
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


async function collectMetricsFromSingleMachine(ip, vchain) {
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

async function collectAllMetrics(machines, vchain) {
    const metrics = {};
    info(`Collecting metrics from ${_.keys(machines).length} machines on vchain ${vchain} ...`);

    _.forEach(machines, ({ ip }) => {
        metrics[ip] = collectMetricsFromSingleMachine(ip, vchain);
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

async function loadNetworkConfig({ boyarConfigURL, ignoredIPs }) {
    info("Loading network config from " + boyarConfigURL);

    const options = {
        uri: boyarConfigURL,
        timeout: 10000,
        json: true
    };
    return rp(options)
        .then(res => {
            const machines = {};

            _.map(res["network"], machine => {
                info(`FOUND machine ${machine["ip"]}`);
                if (_.findIndex(ignoredIPs, el => el === machine["ip"]) > -1) {
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
    const myArgs = process.argv.slice(2);

    if (myArgs.length < 3) {
        info("Usage {VCHAIN} {NET_CONFIG_URL} {PROM_CLIENT_PORT}");
        info("For example: ./prom-run.sh 2001 https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json 3020");
        process.exit(1);
    }

    const vchain = myArgs[0];
    if (!vchain || vchain === "") {
        info("Error: one or more of the following environment variables is undefined: VCHAIN");
        process.exit(1);
    }

    const boyarConfigURL = myArgs[1];
    if (!boyarConfigURL || boyarConfigURL === "") {
        info("Error: one or more of the following environment variables is undefined: NET_CONFIG_URL", boyarConfigURL);
        process.exit(1);
    }
    info(boyarConfigURL);

    const port = myArgs[2];
    if (!port || port === "") {
        info("Error: one or more of the following environment variables is undefined: PROM_CLIENT_PORT");
        process.exit(1);
    }

    return {
        vchain,
        port,
        boyarConfigURL
    }
}

if (!module.parent) {
    main(assertEnvVars());
} else {
    module.exports = {
        collectAllMetrics,
    }
}

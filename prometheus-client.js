const Promise = require("bluebird");
const express = require('express');
const rp = require('request-promise-native');
const _ = require('lodash');
const client = require('prom-client'); // https://github.com/siimon/prom-client
const { Registry, collectDefaultMetrics } = client;
const promGauges = require('./prometheus/prom-gauges');
const info = require('./util').info;
const debug = require('./util').debug;
const fs = require('fs');

// Stability net: NET_CONFIG_URL = "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json";
// Integrative net: NET_CONFIG_URL = "https://s3.us-east-2.amazonaws.com/boyar-integrative-e2e/boyar/config.json";
// Validators net: NET_CONFIG_URL = "https://s3.amazonaws.com/boyar-bootstrap-test/boyar/config.json";


const LOCAL_CONFIG = "./config/prod-topology.json";

async function main({ vchain, ignoredIPs, boyarConfigURL, port }) {
    const processor = await init({ vchain, ignoredIPs, boyarConfigURL });
    await refreshMetrics(processor);

    const app = express();
    app.use('/metrics', _.partial(getMetrics, processor));
    app.listen(port, () => info(`Prometheus client listening on port ${port}!`));
}

// basically returns God object
async function init({ vchain, ignoredIPs, boyarConfigURL }) {
    let machines;
    try {
        if (!boyarConfigURL || boyarConfigURL.length === 0) {
            machines = await loadLocalConfig();
        } else {
            machines = await loadNetworkConfig({boyarConfigURL, ignoredIPs});
        }
    } catch (err) {
        info(`Failed to load config from ${boyarConfigURL} or ${LOCAL_CONFIG}: ${err}`);
        info("Exiting.");
        process.exit(1);
    }

    const register = new Registry();
    const gauges = promGauges.initGauges(register);
    const aggregatedGauges = promGauges.initAggregatedGauges(register);

    const collectionInterval = collectDefaultMetrics({ register, timeout: 5000 });

    return {
        data: {
            metrics: {},
            prometheus: {
                gauges,
                aggregatedGauges,
                register,
                collectionInterval,
            }
        },
        config: {
            machines,
            vchain,
            ignoredIPs,
            boyarConfigURL
        }
    };
}

async function refreshMetrics(processor) {
    const now = new Date();
    return collectAllMetrics(processor.config.machines, processor.config.vchain)
        .then((metrics) => {
            _.merge(processor.data.metrics, metrics);

            processor.data.prometheus.aggregatedGauges.totalNodes.set({vchain: processor.config.vchain}, processor.config.machines.length, now);
            // FIXME does not actually wait for anything
            _.forEach(processor.config.machines, (machine) => {
                const lastMetrics = processor.data.metrics[machine.ip];
                if (!lastMetrics) {
                    return;
                }
                try {
                    updateMetrics({
                        gauges: processor.data.prometheus.gauges,
                        config: processor.config,
                        now, machine, lastMetrics
                    });
                } catch(err) {
                    info(`Error in updateMetrics() IP=${JSON.stringify(machine)}: ${err}`);
                }

            });
        })
        .catch(err => {
            info(`Error collecting metrics: ${err}`);
        });
}

function updateMetrics({ gauges, config: { lookup, vchain }, now, machine, lastMetrics }) {
    const machineName = machine.node_name || machine.ip;
    const regionName = machine.region || "";

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
            // debug(`Set ip=${machine.ip} machineName=${machineName} region=${regionName} ${g.metricName}=${value}`);
            g.gauge.set({
                machine: machineName,
                region: regionName,
                vchain: vchain
            }, value, now);
        } catch (err) {
            info(`Failed to set value of ${g.metricName} of machine ${machineName} vchain ${vchain}: ${err}`);
        }
    });
}


async function collectMetricsFromSingleMachine(machine, vchain) {
    const url = `http://${machine.ip}/vchains/${vchain}/metrics`;
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
    // Collect from machine unless it has explicit active="false" value (so collect even if no active property)
    info(`Collecting metrics from ${machines.length} active machines on vchain ${vchain} ...`);

    _.forEach(machines, machine => {
        metrics[machine.ip] = collectMetricsFromSingleMachine(machine, vchain);
    });

    return Promise.props(metrics);
}

async function getMetrics(processor, req, res) {
    // info("Called /metrics");
    await refreshMetrics(processor);
    const register = processor.data.prometheus.register;
    res.set('Content-Type', register.contentType);
    info("Return from /metrics");
    res.end(register.metrics());
}

async function loadLocalConfig() {
    info(`Loading local config from ${LOCAL_CONFIG}`);
    let jsonData = JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf-8'));
    info(JSON.stringify(jsonData));

    return _.filter(jsonData.network, m => m.active !== "false");
}

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
            info(`Failed to load network config: ${err}`);
            throw err
        })
}

function assertCommandLine() {
    const myArgs = process.argv.slice(2);

    if (myArgs.length < 2) {
        info("Usage {VCHAIN} {PROM_CLIENT_PORT} [NET_CONFIG_URL]");
        info("For example: ./prom-run.sh 2001 3020 https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json");
        info("or:  ./prom-run.sh 2001 3020");
        info(`If NET_CONFIG_URL is not provided, will use local config from ${LOCAL_CONFIG}`);
        info("Exiting.");
        process.exit(1);
    }

    const vchain = myArgs[0];
    if (!vchain || vchain === "") {
        info("Error: one or more of the following environment variables is undefined: VCHAIN");
        info("Exiting.");
        process.exit(1);
    }

    const port = myArgs[1];
    if (!port || port === "") {
        info("Error: one or more of the following environment variables is undefined: PROM_CLIENT_PORT");
        info("Exiting.");
        process.exit(1);
    }

    const boyarConfigURL = myArgs[2];
    if (!boyarConfigURL || boyarConfigURL === "") {
        info(`NET_CONFIG_URL not provided, will use local config from ${LOCAL_CONFIG}`);
    }

    return {
        vchain,
        port,
        boyarConfigURL
    }
}

if (!module.parent) {
    main(assertCommandLine());
} else {
    module.exports = {
        init,
        collectAllMetrics,
        refreshMetrics,
    }
}

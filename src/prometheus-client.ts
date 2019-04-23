import express = require('express');
import rp = require('request-promise-native');
import promGauges = require('./prometheus/prom-gauges');
import fs = require('fs');
import * as _ from 'lodash';
import {collectDefaultMetrics, Registry} from "prom-client";
import {getBlock, RawBlock} from "./orbs-client/get-block";
import {MetricToGaugeMap} from "./prometheus/prom-gauges"; // https://github.com/siimon/prom-client
const {info, debug} = require('./util');

// Stability net: NET_CONFIG_URL = "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json";
// Integrative net: NET_CONFIG_URL = "https://s3.us-east-2.amazonaws.com/boyar-integrative-e2e/boyar/config.json";
// Validators net: NET_CONFIG_URL = "https://s3.amazonaws.com/boyar-bootstrap-test/boyar/config.json";


const LOCAL_CONFIG = "./config/prod-topology.json";
const TIMEOUT_MS = 2000;

type Processor = {
    data: Data;
    config: Config;
}


type Data = {
    metrics: IpToMetrics;
    prometheus: {
        gauges: MetricToGaugeMap
        // aggregatedGauges: MetricToGaugeMap,
        register: Registry,
        collectionInterval: number
    };
}

type Config = {
    machines: Machine[];
    vchain: number;
    ignoredIPs: String[];
    boyarConfigURL: string;
}

type Machine = {
    orbs_address: string;
    ethereum_address: string;
    ip: string;
    node_name: string;
    company_name: string;
    region: string;
    active: string;
}

// Example: {ip: "18.197.127.2", metrics: {"BlockStorage.BlockHeight":{"Name":"BlockStorage.BlockHeight","Value":89344}}}
type SingleMachineMetrics = {
    ip: string,
    metrics: any
};

type SingleMachineMeta = {
    ip: string,
    lastBlockTime: Date,
    lastSeenTime: Date
}

// Map IP => SingleMachineMetrics
type IpToMetrics = {
    [ip: string]: {
        metrics: SingleMachineMetrics,
        meta: SingleMachineMeta
    }
}

async function main({vchain, ignoredIPs, boyarConfigURL, port}: any) {
    const processor: Processor = await init({vchain, ignoredIPs, boyarConfigURL});
    await refreshMetrics(processor);

    const app = express();
    app.use('/metrics', _.partial(getMetrics, processor));
    app.listen(port, () => info(`Prometheus client listening on port ${port}!`));
}

async function init({vchain, ignoredIPs, boyarConfigURL}): Promise<Processor> {
    let machines: Machine[];
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
    const gauges: MetricToGaugeMap = promGauges.initApplicativeGauges(register);

    const collectionInterval = collectDefaultMetrics({register, timeout: 5000});

    const config: Config = {
        machines,
        vchain,
        ignoredIPs,
        boyarConfigURL
    };

    return {
        data: {
            metrics: {},
            prometheus: {
                gauges,
                register,
                collectionInterval,
            }
        },
        config
    };
}

async function refreshMetrics(processor: Processor) {
    const now = new Date();
    let ipToMetrics: IpToMetrics;
    ipToMetrics = await collectMetricsFromMachines(processor.config.machines, processor.config.vchain);
    _.merge(processor.data.metrics, ipToMetrics);

    for (const machine of processor.config.machines) {
        const lastMetrics: SingleMachineMetrics = processor.data.metrics[machine.ip].metrics;
        const lastMeta: SingleMachineMeta = processor.data.metrics[machine.ip].meta;
        try {
            updateMachineMetrics(processor.data.prometheus.gauges, processor.config.vchain, now, machine, lastMetrics, lastMeta);
        } catch (err) {
            info(err);
            continue;
        }
    }
}

function updateMetaMetrics(now: Date, latestSingleMachineMetrics: SingleMachineMetrics, latestSingleMachineMeta: SingleMachineMeta) {
    // Meta gauges
    const lastBlockTime = (latestSingleMachineMeta && latestSingleMachineMeta.lastBlockTime) ? latestSingleMachineMeta.lastBlockTime.getTime() : 0;
    const lastSeen = (latestSingleMachineMeta && latestSingleMachineMeta.lastSeenTime) ? latestSingleMachineMeta.lastSeenTime.getTime() : 0;

    if(!latestSingleMachineMetrics) {
        return;
    }

    latestSingleMachineMetrics["Meta.TimeSinceLastBlock.Millis"] = {
        Name: "Meta.TimeSinceLastBlock.Millis",
        Value: now.getTime()-lastBlockTime
    };

    latestSingleMachineMetrics["Meta.TimeSinceLastSeen.Millis"] = {
        Name: "Meta.TimeSinceLastSeen.Millis",
        Value: now.getTime()-lastSeen
    }
}

function updateMachineMetrics(gauges: MetricToGaugeMap, vchain: number, now: Date, machine: Machine, latestSingleMachineMetrics: SingleMachineMetrics, latestSingleMachineMeta: SingleMachineMeta) {
    const machineName = machine.node_name || machine.ip;
    const regionName = machine.region || "";

    updateMetaMetrics(now, latestSingleMachineMetrics, latestSingleMachineMeta);

    if (!latestSingleMachineMetrics) {
        return;
    }

    for (const metricName of _.keys(gauges)) {
        // debug(`updateMetrics: ${JSON.stringify(latestSingleMachineMetrics)}`);
        if (!latestSingleMachineMetrics[metricName]) {
            debug(`IP ${machine.ip}: Metric ${metricName} is undefined!`);
            continue;
        }

        const value: string = latestSingleMachineMetrics[metricName]["Value"];
        if (value === "") {
            continue;
        }
        try {
            const valueNum: number = parseFloat(value);
            // debug(`Set ip=${machine.ip} machineName=${machineName} region=${regionName} ${g.metricName}=${value}`);
            gauges[metricName].set({
                machine: machineName,
                region: regionName,
                vchain: vchain
            }, valueNum, now);
        } catch (err) {
            info(`Failed to set value of ${metricName} of machine ${machineName} vchain ${vchain}: ${err.stack}`);
            throw err;
        }
    }
}


async function collectMetricsFromMachines(machines: Machine[], vchain: number): Promise<IpToMetrics> {
    const ipToMetrics: IpToMetrics = {};
    // Collect from machine unless it has explicit active="false" value (so collect even if no active property)
    // info(`Collecting metrics from ${machines.length} active machines on vchain ${vchain}`);

    const metricsFromMachines: SingleMachineMetrics[] = await Promise.all(
        _.map(machines,
            machine => collectMetricsFromSingleMachine(machine, vchain)));

    let successfulMachines = 0;
    // debug(`Finished collecting metrics, now collecting meta`);
    for (const metricsFromMachine of metricsFromMachines) {
        ipToMetrics[metricsFromMachine.ip] = ipToMetrics[metricsFromMachine.ip] || {metrics: null, meta: null};
        if (!metricsFromMachine.metrics) {
            debug(`No metrics from ${metricsFromMachine.ip} so skipping getting its last block`);
            continue;
        }
        ipToMetrics[metricsFromMachine.ip] = ipToMetrics[metricsFromMachine.ip] || {
            metrics: null,
            meta: null
        };
        const blockHeight = metricsFromMachine.metrics["BlockStorage.BlockHeight"]["Value"] || 0;
        const metaPerMachine = await collectMetaFromSingleMachine(metricsFromMachine.ip, vchain, blockHeight);
        // debug(`Meta from ${metricsFromMachine.ip} H=${blockHeight}: ${JSON.stringify(metaPerMachine)}`);
        ipToMetrics[metricsFromMachine.ip].metrics = metricsFromMachine.metrics;
        ipToMetrics[metricsFromMachine.ip].meta = metaPerMachine;
        if (metaPerMachine.lastSeenTime) {
            successfulMachines++;
        } else {
            info(`Failed to get meta from machine ${metricsFromMachine.ip}`);
        }

    }
    const machineNodeNames = _.map(machines, 'node_name');
    info(`Finished collecting metrics and meta from ${successfulMachines} out of ${machines.length} active machines on vchain ${vchain}: ${machineNodeNames.join(",")}`);
    return ipToMetrics;
}

async function collectMetricsFromSingleMachine(machine, vchain): Promise<SingleMachineMetrics> {
    const url = `http://${machine.ip}/vchains/${vchain}/metrics`;
    const options = {
        uri: url,
        timeout: TIMEOUT_MS,
        json: true
    };
    return rp(options)
        .then(res => {
            // debug(`Received metrics from [${machine.node_name}] ${url}`);
            return <SingleMachineMetrics>{
                ip: machine.ip,
                metrics: res
            };
        })
        .catch(err => {
            info(`Failed to receive metrics from [${machine.node_name}] ${url}: ${err}`);
            return <SingleMachineMetrics>{
                ip: machine.ip,
                metrics: null
            };
        });
}

async function collectMetaFromSingleMachine(ip: string, vchain: number, height: bigint): Promise<SingleMachineMeta> {

    if (!height) {
        return <SingleMachineMeta>{
            ip,
            lastBlockTime: null,
            lastSeenTime: null
        }
    }

    try {
        const block: RawBlock = await getBlock(ip, vchain, height);
        // debug(`Block: ${JSON.stringify(block)}`);
        return <SingleMachineMeta>{
            ip,
            lastBlockTime: block.timeStamp,
            lastSeenTime: new Date()
        }
    } catch (err) {
        info(`Error in collectMetaFromSingleMachine(): ${err.stack}`);
        return <SingleMachineMeta>{
            ip,
            lastBlockTime: null,
            lastSeenTime: null
        }
    }
}

async function getMetrics(processor: Processor, req, res) {
    // info("Called /metrics");
    await refreshMetrics(processor);
    const register = processor.data.prometheus.register;
    res.set('Content-Type', register.contentType);
    // info("Return from /metrics");
    res.end(register.metrics());
}

async function loadLocalConfig(): Promise<Machine[]> {
    info(`Loading local config from ${LOCAL_CONFIG}`);
    let jsonData = JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf-8'));
    info(JSON.stringify(jsonData));

    return _.filter(jsonData.network, m => m.active !== "false");
}

async function loadNetworkConfig({boyarConfigURL, ignoredIPs}): Promise<Machine[]> {
    info("Loading network config from " + boyarConfigURL);

    const options = {
        uri: boyarConfigURL,
        timeout: TIMEOUT_MS,
        json: true
    };
    return rp(options)
        .then(res => {
            const machines: Machine[] = [];

            _.map(res["network"], machine => {
                info(`FOUND machine ${machine["ip"]}`);
                if (_.findIndex(ignoredIPs, el => el === machine["ip"]) > -1) {
                    info(`IGNORED machine ${machine["ip"]}`);
                    return;
                }
                machines.push(<Machine>{
                    ip: machine["ip"],
                    orbs_address: machine["address"]
                });
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
        collectMetricsFromMachines,
        refreshMetrics,
    }
}

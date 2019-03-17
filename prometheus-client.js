const express = require('express');
const rp = require('request-promise-native');
const _ = require('lodash');
const client = require('prom-client'); // https://github.com/siimon/prom-client
const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;

// Stability net
// const NET_CONFIG_URL = "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json";

// Integrative net
// const NET_CONFIG_URL = "https://s3.us-east-2.amazonaws.com/boyar-integrative-e2e/boyar/config.json";

const IGNORED_IPS = ['52.9.19.13'];

const Gauge = client.Gauge;


const app = express();
const port = 3020;

let vchain, net_config;
const machines = {};

// Block Height gauge
let gBlockHeight, gHeapAlloc, gRSS, gUpTime, gStateKeys, gVersionCommit, gCurrentView, gPublicApiTotalTransactionsFromClients, gTxPoolTotalCommits;

function info() {
    console.log(new Date().toISOString(), arguments)
}

const defaultMetricsStopper = collectDefaultMetrics({timeout: 5000});

// clearInterval(defaultMetricsStopper);
// client.register.clear();

async function init() {
    vchain = process.env.VCHAIN || "";

    if (vchain === "") {
        console.log("Error: one or more of the following environment variables is undefined: VCHAIN");
        process.exit(1);
    }

    net_config = process.env["NET_CONFIG_URL"];
    if (net_config === "") {
        console.log("Error: one or more of the following environment variables is undefined: NET_CONFIG_URL");
        process.exit(1);
    }

    try {
        await loadNetworkConfig(net_config);
    } catch (err) {
        info(`Failed to load config from ${net_config}, exiting.`);
        process.exit(1);
    }

    gBlockHeight = new Gauge({name: 'block_height', help: 'Block Height', labelNames: ['machine', 'vchain']});
    gHeapAlloc = new Gauge({name: 'heap_alloc_bytes', help: 'Heap Allocated in bytes', labelNames: ['machine', 'vchain']});
    gRSS = new Gauge({name: 'rss_memory_bytes', help: 'Process RSS Memory', labelNames: ['machine', 'vchain']});
    gUpTime = new Gauge({name: 'uptime_seconds', help: 'Uptime', labelNames: ['machine', 'vchain']});
    gStateKeys = new Gauge({name: 'state_keys', help: 'Number of state keys', labelNames: ['machine', 'vchain']});
    // gVersionCommit = new Gauge({name: 'version_commit', help: 'Version Commit Hash', labelNames: ['machine', 'vchain']});
    gCurrentView = new Gauge({name: 'lh_current_view', help: 'Lean Helix Current View', labelNames: ['machine', 'vchain']});
    gPublicApiTotalTransactionsFromClients = new Gauge({name: 'papi_total_tx_from_clients', help: 'Public API Total transactions from clients', labelNames: ['machine', 'vchain']});
    gTxPoolTotalCommits = new Gauge({name: 'txpool_commits_total', help: 'Transaction Pool total transaction commits', labelNames: ['machine', 'vchain']});


    await refreshMetrics();



}

async function refreshMetrics() {
    const now = new Date();
    return collectAllMetrics(now)
        .then(() => {
            // info("Collected metrics from all machines");
            _.forEach(machines, machine => {
                updateMetrics(machine, now);
            });
        })
        .catch(err => {
            info("Error collecting metrics", err);
        });
}

function updateMetrics(machine, now) {
    // info(`IP: ${machine["ip"]} LastSeen: ${machine["lastSeen"]}}`);
    gBlockHeight.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["BlockStorage.BlockHeight"]["Value"], now);
    gHeapAlloc.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["Runtime.HeapAlloc.Bytes"]["Value"], now);
    gRSS.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["OS.Process.Memory.Bytes"]["Value"], now);
    gUpTime.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["Runtime.Uptime.Seconds"]["Value"], now);
    gStateKeys.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["StateStoragePersistence.TotalNumberOfKeys.Count"]["Value"], now);
    // gVersionCommit.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["Version.Commit"]["Value"], now);
    gCurrentView.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["ConsensusAlgo.LeanHelix.CurrentElection.Value"]["Value"], now);
    gPublicApiTotalTransactionsFromClients.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["PublicApi.TotalTransactionsFromClients.Count"]["Value"], now);
    gTxPoolTotalCommits.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["TransactionPool.TotalCommits.Count"]["Value"], now);
}

async function collectMetricsFromSingleMachine(machine) {
    const url = `http://${machine["ip"]}/vchains/${vchain}/metrics`;
    const options = {
        url: url,
        timeout: 5000,
        json: true
    };
    // info(`Requesting metrics from ${url}`);
    machine["lastSeen"] = machine["lastSeen"] || {};
    return rp(options)
        .then(res => {
            // info(`Received metrics from ${url}`);
            machine["lastSeen"] = new Date().getTime();
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
    info("Collecting metrics for vchain " + vchain + " ...");
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
    console.log("Loading network config from " + configUrl);
    const options = {
        url: configUrl,
        timeout: 5000,
        json: true
    };
    return rp(options)
        .then(res => {
            _.map(res["network"], machine => {
                info(`FOUND machine ${machine["ip"]}`);
                if(_.findIndex(IGNORED_IPS, el => el===machine["ip"]) > -1) {
                    info(`IGNORED machine ${machine["ip"]}`);
                    return;
                }
                machines[machine["ip"]] = {
                    ip: machine["ip"],
                    address: machine["address"]
                };
                info(`ADDED machine ${machines[machine["ip"]]}`);
            })
        })
        .catch(err => {
            console.log("Failed to load network config: ", err);
            throw err
        })
}

async function main() {
    await init();
    app.listen(port, () => info(`Prometheus client listening on port ${port}!`));
}

main();

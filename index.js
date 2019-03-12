const express = require('express');
const os = require('os');
const rp = require('request-promise-native');
const gecko = require("geckoboard");
const _ = require('lodash');
const DS_OS = require('./dataset-config').DATASET_OS_CONFIG;
const DS_OS_NAME = require('./dataset-config').DATASET_OS_CONFIG_NAME;
const DS_TX = require('./dataset-config').DATASET_TX_CONFIG;
const DS_TX_NAME = require('./dataset-config').DATASET_TX_CONFIG_NAME;
const DS_BLOCKS = require('./dataset-config').DATASET_BLOCKS_CONFIG;
const DS_BLOCKS_NAME = require('./dataset-config').DATASET_BLOCKS_CONFIG_NAME;

const app = express();
const port = 3010;
const intervalMillis = 20000;

var vchain;
var gb;
var ips;

const meta = {};

async function main() {
    try {
        res = await init();
        console.log("Authentication successful, contacting " + ips.length + " IP addresses");
        setInterval(run, intervalMillis);
        run();
    } catch (err) {
        console.log("Auth failed", err);
        process.exit(1);
    }
}

async function init() {
    console.log("Initializing, running with interval=" + intervalMillis + " ms");
    apiKey = process.env.GECKO_API_KEY || "";
    const ipsStr = process.env.NODE_IPS || "";
    vchain = process.env.VCHAIN || "";

    if (apiKey === "" || ipsStr === "" || vchain === "") {
        console.log("Error: one or more of the following environment variables is undefined: GECKO_API_KEY, NODE_IPS, VCHAIN")
        process.exit(1);
    }
    ips = ipsStr.split(",");
    if (ips.length === 0) {
        console.log("Error: environment variable NODE_IPS does not contain a comma-separated list of IP addresses");
        process.exit(1);
    }
    if (ips[0].length > 16) {
        console.log("Error: Invalid IP address (forgot to comma-separate?)", ips[0])
        process.exit(1)
    }
    gb = gecko(apiKey)

    return promisePing()
}

async function promisePing() {
    return new Promise((resolve, reject) => {
        gb.ping(err => {
            if (err) {
                return reject(err);
            } else {
                return resolve();
            }
        })
    })
}

function run() {

    // Uncomment to delete dataset with all its data (required when changing its properties)
    // deleteDataset(DS_OS_NAME);
    // deleteDataset(DS_TX_NAME);
    // deleteDataset(DS_BLOCKS_NAME);

    // Uncomment to read metrics and update Gecko
    updateDatasets()
}

function deleteDataset(dsName) {
    gb.datasets.delete(dsName, err => {
        if (err) {
            console.log("Error deleting Dataset " + dsName, err);
            return
        }
        console.log("Dataset " + dsName + " deleted successfully")
    });
}

// Wrapper because geckoboard lib uses callbacks
async function promiseFindOrCreate(datasetToCreate) {
    return new Promise((resolve, reject) => {
        gb.datasets.findOrCreate(datasetToCreate, function (err, dataset) {
            if (err) {
                console.log("promiseFindOrCreate error", datasetToCreate.id, err);
                return reject(err);
            } else {
                console.log("Connected to dataset " + datasetToCreate.id);
                return resolve(dataset);
            }
        });
    });
}

function updateDatasets() {

    const promises = [
        promiseFindOrCreate(DS_OS),
        promiseFindOrCreate(DS_TX),
        promiseFindOrCreate(DS_BLOCKS)
    ];

    var datasets = [];

    Promise.all(promises)
        .then(_datasets => {
            datasets = _datasets;
            return collectAllMetrics()
        })
        .then(metrics => {
            console.log('Finished reading metrics from ' + metrics.length + ' nodes' + ' vchain ' + vchain);
            _.map(datasets, d => {
                updateDataset(d, metrics);
            });

        })
        .catch(err => {
            console.log("Error in this round, skipping.", err);
        });
}

async function collectMetricsFromSingleMachine(ip, now) {
    const options = {
        url: 'http://' + ip + '/vchains/' + vchain + '/metrics',
        json: true
    };
    meta[ip] = meta[ip] || {};
    meta[ip].lastSuccessTime = meta[ip].lastSuccessTime || now;
    return rp(options)
        .then(res => {
            res.meta = res.meta || {};
            res.meta.time = now;
            res.meta.ip = ip;
            res.meta.active = true;
            console.log("Finished reading data from node " + ip + ", last seen: " + (now - (meta[ip].lastSuccessTime)) + " ms ago");
            meta[ip].lastSuccessTime = now;
            meta[ip].lastBlockHeight = blockHeight(res);
            meta[ip].lastErr = null;
            return res;
        })
        .catch(err => {
            console.log("Cannot read data from node " + ip + ", last seen: " + (now - (meta[ip].lastSuccessTime)) + " ms ago");
            meta[ip].lastErr = err;
            return {
                meta: {
                    time: now,
                    ip: ip,
                    active: false
                }
            }
        })
}

function collectAllMetrics() {
    const promises = [];
    now = new Date();
    console.log("Collecting metrics...");
    _.map(ips, ip => {
        promises.push(collectMetricsFromSingleMachine(ip, now));
    });
    return Promise.all(promises);
}

function updateDataset(dataset, metrics) {
    console.log('Converting metrics for dataset ' + dataset.id);
    const data = toGeckoDataset(metrics, dataset.id);
    dataset.post(data, {}, err => {
        if (err) {
            console.log("Error pushing data to Gecko", err);
            return;
        }
        console.log("Data pushed to Gecko dataset " + dataset.id);
    })
}

function toGeckoDataset(unfilteredMetrics, datasetName) {

    const data = [];
    const now = new Date().toISOString();
    const metrics = [];

    for (let i = 0; i < unfilteredMetrics.length; i++) {
        if (unfilteredMetrics[i] === null || !unfilteredMetrics[i].meta.active) {
            continue
        }
        metrics.push(unfilteredMetrics[i]);
    }

    for (let i = 0; i < metrics.length; i++) {
        const nodeAddr = calcNodeAddr(metrics[i]['Node.Address']['Value']);
        switch (datasetName) {
            case DS_BLOCKS_NAME:
                data.push({
                    time: now,
                    node_addr: nodeAddr,
                    block_height: blockHeight(metrics[i]),
                    kpi_block_height_diff: diffBlockHeight(metrics),
                    state_keys: metrics[i]['StateStoragePersistence.TotalNumberOfKeys.Count']['Value'] || 0,
                });
                break;
            case DS_OS_NAME:
                data.push({
                    time: now,
                    node_addr: nodeAddr,
                    heap_alloc: metrics[i]['Runtime.HeapAlloc.Bytes']['Value'] || 0,
                    rss: metrics[i]['OS.Process.Memory.Bytes']['Value'] || 0,
                    uptime: calcUptime(metrics[i]['Runtime.Uptime.Seconds']['Value']),
                    ver_commit: calcVersionCommit(metrics[i]['Version.Commit']['Value']),
                    node_count: metrics.length
                });
                break;
            case DS_TX_NAME:
                data.push({
                    time: now,
                    node_addr: nodeAddr,
                    total_tx_from_clients: metrics[i]['PublicApi.TotalTransactionsFromClients.Count']['Value'] || 0,
                    total_tx_into_committed_pool: metrics[i]['TransactionPool.TotalCommits.Count']['Value'] || 0,
                    tps_from_clients: metrics[i]['TransactionPool.CommitRate.PerSecond']['Rate'] || 0,
                    tps_into_committed_pool: metrics[i]['TransactionPool.CommitRate.PerSecond']['Rate'] || 0,
                    tx_time_in_pending_max: calcTxTime(metrics[i]['TransactionPool.PendingPool.TimeSpentInQueue.Millis']['Max']),
                    tx_time_in_pending_p99: calcTxTime(metrics[i]['TransactionPool.PendingPool.TimeSpentInQueue.Millis']['P99']),
                });
                break;
        }
    }
    return data;
}

function blockHeight(metric) {
    if (!metric || !metric['BlockStorage.BlockHeight']) {
        return 0;
    }
    return (metric['BlockStorage.BlockHeight']['Value'] || 0)
}

function calcNodeAddr(rawNodeAddr) {
    rawNodeAddr = rawNodeAddr || '';
    return rawNodeAddr.substring(0, 6);
}

function calcTxTime(txTime) {
    return (txTime || 0) / 60.0
}

function calcUptime(uptime) {
    return (uptime || 0) / 60.0
}

function calcVersionCommit(verCommit) {
    return (verCommit || '').substring(0, 8)
}

function diffBlockHeight() {
    const blockHeights = [];
    _.forEach(meta, (metaPerIP, ip) => {
        blockHeights.push(metaPerIP.lastBlockHeight || 0)
    });
    const max = _.max(blockHeights);
    const min = _.min(blockHeights);
    return max - min;
}

function info() {
    console.log(arguments)
}

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/p', (req, res) => res.send('Prometheus?'));
app.listen(port, () => info(`Example app listening on port ${port}!`));

main();
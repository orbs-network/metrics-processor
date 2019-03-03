const express = require('express')
const os = require('os')
const rp = require('request-promise-native')
const gecko = require("geckoboard")
const _ = require('lodash')
const DS_OS = require('./dataset-config').DATASET_OS_CONFIG
const DS_OS_NAME = require('./dataset-config').DATASET_OS_CONFIG_NAME
const DS_TX = require('./dataset-config').DATASET_TX_CONFIG
const DS_TX_NAME = require('./dataset-config').DATASET_TX_CONFIG_NAME
const DS_BLOCKS = require('./dataset-config').DATASET_BLOCKS_CONFIG
const DS_BLOCKS_NAME = require('./dataset-config').DATASET_BLOCKS_CONFIG_NAME

const app = express()
const port = 3000
const intervalMillis = 20000

var vchain;
var gb;
var ips;


async function main() {
    try {
        res = await init()
        console.log("Authentication successful, contacting " + ips.length + " IP addresses");
        setInterval(run, intervalMillis);
        run();
    } catch (err) {
        console.log("Auth failed", err)
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
    // deleteDataset(DS_OS_NAME)
    // deleteDataset(DS_TX_NAME)
    // deleteDataset(DS_BLOCKS_NAME)
    // deleteDataset("orbs.stability.metrics")

    // Uncomment to read metrics and update Gecko
    updateDatasets()
}

function deleteDataset(dsName) {
    gb.datasets.delete(dsName, err => {
        if (err) {
            console.log("Error deleting Dataset " + dsName, err)
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
    ]

    var datasets = []

    Promise.all(promises)
        .then(_datasets => {
            datasets = _datasets;
            return collectMetrics()
        })
        .then(metrics => {
            console.log('Finished reading metrics from ' + metrics.length + ' nodes');
            _.map(datasets, d => {
                updateDataset(d, metrics);
            });

        })
        .catch(err => {
            console.log("Error in this round, skipping", err);
            return
        });
}

function collectMetrics() {
    const promises = []
    console.log("Collecting metrics...")
    _.map(ips, ip => {
        const options = {
            url: 'http://' + ip + '/vchains/' + vchain + '/metrics',
            json: true
        }
        promises.push(rp(options));
    })
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

function toGeckoDataset(values, datasetName) {

    const data = []
    const now = new Date().toISOString();
    for (i = 0; i < values.length; i++) {
        switch (datasetName) {
            case DS_BLOCKS_NAME:
                data.push({
                    time: now,
                    node_addr: calcNodeAddr(values[i]['Node.Address']['Value']),
                    block_height: values[i]['BlockStorage.BlockHeight']['Value'] || 0,
                    kpi_block_height_diff: diffBlockHeight(values),
                    state_keys: values[i]['StateStoragePersistence.TotalNumberOfKeys.Count']['Value'] || 0,
                })
                break;
            case DS_OS_NAME:
                data.push({
                    time: now,
                    node_addr: calcNodeAddr(values[i]['Node.Address']['Value']),
                    heap_alloc: values[i]['Runtime.HeapAlloc.Bytes']['Value'] || 0,
                    uptime: calcUptime(values[i]['Runtime.Uptime.Seconds']['Value']),
                    ver_commit: calcVersionCommit(values[i]['Version.Commit']['Value']),
                    node_count: values.length
                })
                break;
            case DS_TX_NAME:
                data.push({
                    time: now,
                    node_addr: calcNodeAddr(values[i]['Node.Address']['Value']),
                    tps_entering_pool: values[i]['TransactionPool.TransactionsEnteringPool.PerSecond']['Rate'] || 0,
                    tx_time_in_pending_max: calcTxTime(values[i]['TransactionPool.PendingPool.TimeSpentInQueue.Millis']['Max']),
                    tx_time_in_pending_p99: calcTxTime(values[i]['TransactionPool.PendingPool.TimeSpentInQueue.Millis']['P99']),
                })
                break;
        }
    }
    return data;
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

function diffBlockHeight(values) {
    const blockHeights = _.map(values, v => v['BlockStorage.BlockHeight']['Value']);
    const max = _.max(blockHeights);
    const min = _.min(blockHeights);

    return max - min;
}

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => {
    main()
});
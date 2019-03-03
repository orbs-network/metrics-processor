const express = require('express')
const os = require('os')
const rp = require('request-promise-native')
const gb = require("geckoboard")(process.env.GECKO_API_KEY)
const _ = require('lodash')
const DS_OS = require('./dataset-config').DATASET_OS_CONFIG
const DS_OS_NAME = require('./dataset-config').DATASET_OS_CONFIG_NAME
const DS_TX = require('./dataset-config').DATASET_TX_CONFIG
const DS_TX_NAME = require('./dataset-config').DATASET_TX_CONFIG_NAME
const DS_BLOCKS = require('./dataset-config').DATASET_BLOCKS_CONFIG
const DS_BLOCKS_NAME = require('./dataset-config').DATASET_BLOCKS_CONFIG_NAME

const app = express()
const port = 3000
const vchain = 1000

const ips = ['54.194.120.89', '35.177.173.249', '52.47.211.186', '35.174.231.96', '18.191.62.179', '52.60.152.22', '18.195.172.240'];


run();

function run() {
    console.log('Hello');
    gb.ping(err => {
        if (err) {
            console.error(err);
            process.exit(1)
        }
        console.log("Authentication successful");
        responses = [];
        promises = []

        // deleteDataset(DS_OS_NAME)
        // deleteDataset(DS_TX_NAME)
        // deleteDataset(DS_BLOCKS_NAME)
        // deleteDataset("orbs.stability.metrics")
        initDatasets()

    });
}

function deleteDataset(dsName) {
    gb.datasets.delete(dsName, err => {
        if (err) {
            console.log("Dataset " + dsName + " error: " + err)
            return
        }
        console.log("Dataset " + dsName + " deleted successfully")
    });
}

// Wrapper because geckoboard lib uses callbacks
function promiseFindOrCreate(datasetToCreate) {
    return new Promise((resolve, reject) => {
        console.log("Finding dataset " + datasetToCreate.id);
        gb.datasets.findOrCreate(datasetToCreate, function (err, dataset) {
            if (err) {
                console.log("promiseFindOrCreate error", datasetToCreate.id, err);
                reject(err);
                return;
            } else {
                console.log("promiseFindOrCreate success", datasetToCreate.id);
                resolve(dataset);
                return;
            }
        });
    });
}

function initDatasets() {

    promises = []
    promises.push(promiseFindOrCreate(DS_OS));
    promises.push(promiseFindOrCreate(DS_TX));
    promises.push(promiseFindOrCreate(DS_BLOCKS));

    var datasets = []
    var metrics = []

    Promise.all(promises)
        .then(_datasets => {
            datasets = _datasets;
            return collectMetrics()
        })
        .then(metrics => {
            console.log("METRICS: ", metrics)
            _.map(datasets, d => {
                updateDataset(d, metrics);
            });

        })
}

function collectMetrics() {
    promises = []
    console.log("Collecting metrics...")
    _.map(ips, ip => {
        options = {
            url: 'http://' + ip + '/vchains/' + vchain + '/metrics',
            json: true
        }
        promises.push(rp(options));
    })
    return Promise.all(promises);
}

function updateDataset(dataset, metrics) {
    console.log('Processing ' + dataset.id);
    data = toGeckoDataset(metrics, dataset.id);
    console.log('Finised processing ' + metrics.length + ' metrics, pushing...');
    dataset.post(data, {}, err => {
        if (err) {
            console.log(err)
            return;
        }
        console.log("Data pushed to Gecko");
    })
}

function toGeckoDataset(values, datasetName) {

    data = []
    now = new Date().toISOString();
    console.log(">>> ", values.length, values[1])
    for (i = 0; i < values.length; i++) {

        switch (datasetName) {
            case DS_BLOCKS_NAME:
                data.push({
                    time: now,
                    node_addr: values[i]['Node.Address']['Value'],
                    block_height: values[i]['BlockStorage.BlockHeight']['Value'],
                    kpi_block_height_diff: diffBlockHeight(values),
                    state_keys: values[i]['StateStoragePersistence.TotalNumberOfKeys.Count']['Value'],
                })
                break;
            case DS_OS_NAME:
                data.push({
                    time: now,
                    node_addr: values[i]['Node.Address']['Value'],
                    heap_alloc: values[i]['Runtime.HeapAlloc.Bytes']['Value'],
                    uptime: values[i]['Runtime.Uptime.Seconds']['Value']
                })
                break;
            case DS_TX_NAME:
                data.push({
                    time: now,
                    node_addr: values[i]['Node.Address']['Value'],
                    tps_entering_pool: values[i]['TransactionPool.TransactionsEnteringPool.PerSecond']['Rate'],
                    tx_time_in_pending_max: values[i]['TransactionPool.PendingPool.TimeSpentInQueue.Millis']['Max'],
                    tx_time_in_pending_p99: values[i]['TransactionPool.PendingPool.TimeSpentInQueue.Millis']['P99'],
                })
                break;
        }
    }
    console.log(data);
    return data;
}

function diffBlockHeight(values) {
    blockHeights = _.map(values, v => v['BlockStorage.BlockHeight']['Value']);
    max = _.max(blockHeights);
    min = _.min(blockHeights);

    return max - min;
}

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
const express = require('express');
const rp = require('request-promise-native');
const _ = require('lodash');
const client = require('prom-client');
const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;

const NET_CONFIG_URL = "https://s3.eu-central-1.amazonaws.com/boyar-stability/boyar/config.json";

const Gauge = client.Gauge;


const app = express();
const port = 3020;
const intervalMillis = 20000;

let vchain;
const machines = {};

// Block Height gauge
let gBlockHeight;

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

    try {
        await loadNetworkConfig(NET_CONFIG_URL);
    } catch (err) {
        info(`Failed to load config from ${NET_CONFIG_URL}, exiting.`);
        process.exit(1);
    }

    refreshMetrics();


    gBlockHeight = new Gauge({name: 'block_height', help: 'block height', labelNames: ['machine', 'vchain']});
}

async function refreshMetrics() {
    const now = new Date();
    return collectAllMetrics(now)
        .then(allMetrics => {
            _.forEach(allMetrics, metrics => {
                updateMetrics(metrics);
            });
        })
        .catch(err => {
            info("Error collecting metrics", err);
        });
}

function updateMetrics(metrics) {
    info(metrics);
    // _.forEach(machines, machine => {
    //     gBlockHeight.set({machine: 'eu-west-1-sta01', vchain: 2001}, 123, now)
    // });
}

async function collectMetricsFromSingleMachine(ip) {
    const url = `http://${ip}/vchains/${vchain}/metrics`;
    const options = {
        url: url,
        json: true
    };
    info(`Requesting metrics from ${url}`);
    return rp(options);
}


function collectAllMetrics(now) {
    const promises = [];
    console.log("Collecting metrics for vchain " + vchain + " ...");
    _.map(machines, machine => {
        promises.push(collectMetricsFromSingleMachine(machine["ip"]));
    });
    return Promise.all(promises);
}


app.get('/metrics', async (req, res) => {
    info("Called /metrics");
    await refreshMetrics();
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
});

app.get('/metrics/counter', async (req, res) => {
    info("Called /metrics/counter");
    await refreshMetrics();
    res.set('Content-Type', register.contentType);
    res.end(register.getSingleMetricAsString('block_height'));
});

async function loadNetworkConfig(configUrl) {
    console.log("Loading network config from " + configUrl);
    const options = {
        url: configUrl,
        json: true
    };
    return rp(options)
        .then(res => {
            _.map(res["network"], machine => {
                machines[machine["ip"]] = {
                    ip: machine["ip"],
                    address: machine["address"]
                };
                console.log(machines[machine["ip"]]);
            })
        })
        .catch(err => {
            console.log("Failed to load network config: ", err);
            throw err
        })
}


init();

app.listen(port, () => info(`Prometheus client listening on port ${port}!`));
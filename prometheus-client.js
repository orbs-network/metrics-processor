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

// const IGNORED_IPS = ['52.9.19.13'];
const IGNORED_IPS = [];

const Gauge = client.Gauge;
const myArgs = process.argv.slice(2);

const app = express();

let vchain, net_config, listen_port;
const machines = {};

let gTotalNodes;

function info(str) {
    console.log(`${new Date().toISOString()} ${str}`);
}

const defaultMetricsStopper = collectDefaultMetrics({timeout: 5000});
let gauges = [];

// clearInterval(defaultMetricsStopper);
// client.register.clear();

function assertEnvVars() {

    if (myArgs.length < 3) {
        console.log("Usage <VCHAIN> <NET_CONFIG_URL> <PROM_CLIENT_PORT>");
        process.exit(1);
    }

    vchain = myArgs[0];
    if (!vchain || vchain === "") {
        console.log("Error: one or more of the following environment variables is undefined: VCHAIN");
        process.exit(1);
    }

    net_config = myArgs[1];
    if (!net_config || net_config === "") {
        console.log("Error: one or more of the following environment variables is undefined: NET_CONFIG_URL", net_config);
        process.exit(1);
    }
    console.log(net_config);

    listen_port = myArgs[2];
    if (!listen_port || listen_port === "") {
        console.log("Error: one or more of the following environment variables is undefined: PROM_CLIENT_PORT");
        process.exit(1);
    }
}

function initGauges() {
    gauges = [
        {
            gauge: new Gauge({name: 'block_height', help: 'Block Height', labelNames: ['machine', 'vchain']}),
            metricName: "BlockStorage.BlockHeight"
        },
        {
            gauge: new Gauge({
                name: 'heap_alloc_bytes',
                help: 'Heap Allocated in bytes',
                labelNames: ['machine', 'vchain']
            }), metricName: "Runtime.HeapAlloc.Bytes"
        },
        {
            gauge: new Gauge({name: 'os_rss_memory_bytes', help: 'Process RSS Memory', labelNames: ['machine', 'vchain']}),
            metricName: "OS.Process.Memory.Bytes"
        },
        {
            gauge: new Gauge({name: 'os_cpu_percent', help: 'Process CPU', labelNames: ['machine', 'vchain']}),
            metricName: "OS.Process.CPU.PerCent"
        },
        {
            gauge: new Gauge({name: 'os_uptime_seconds', help: 'Process Uptime', labelNames: ['machine', 'vchain']}),
            metricName: "Runtime.Uptime.Seconds"
        },
        {
            gauge: new Gauge({name: 'os_goroutines', help: 'Number of goroutines', labelNames: ['machine', 'vchain']}),
            metricName: "Runtime.NumGoroutine.Value"
        },
        {
            gauge: new Gauge({name: 'state_keys', help: 'Number of state keys', labelNames: ['machine', 'vchain']}),
            metricName: "StateStoragePersistence.TotalNumberOfKeys.Count"
        },
        {
            gauge: new Gauge({
                name: 'lh_current_view',
                help: 'Lean Helix Current View',
                labelNames: ['machine', 'vchain']
            }), metricName: "ConsensusAlgo.LeanHelix.CurrentElection.Value"
        },
        {
            gauge: new Gauge({
                name: 'papi_total_tx_from_clients',
                help: 'Public API Total transactions from clients',
                labelNames: ['machine', 'vchain']
            }), metricName: "PublicApi.TotalTransactionsFromClients.Count"
        },
        {
            gauge: new Gauge({
                name: 'papi_err_total_requests_nil',
                help: 'Public API Error nil requests',
                labelNames: ['machine', 'vchain']
            }), metricName: "PublicApi.TotalTransactionsErrNilRequest.Count"
        },
        {
            gauge: new Gauge({
                name: 'papi_err_total_requests_invalid',
                help: 'Public API Error invalid requests',
                labelNames: ['machine', 'vchain']
            }), metricName: "PublicApi.TotalTransactionsErrInvalidRequest.Count"
        },
        {
            gauge: new Gauge({
                name: 'papi_err_cannot_add_to_txpool',
                help: 'Public API Error cannot add to transaction pool',
                labelNames: ['machine', 'vchain']
            }), metricName: "PublicApi.TotalTransactionsErrAddingToTxPool.Count"
        },
        {
            gauge: new Gauge({
                name: 'papi_err_duplicate_tx',
                help: 'Public API Error duplicate transactions',
                labelNames: ['machine', 'vchain']
            }), metricName: "PublicApi.TotalTransactionsErrDuplicate.Count"
        },
        {
            gauge: new Gauge({
                name: 'txpool_commits_total',
                help: 'Transaction Pool total transaction commits',
                labelNames: ['machine', 'vchain']
            }), metricName: "TransactionPool.TotalCommits.Count"
        },
        {
            gauge: new Gauge({
                name: 'blocksync_commited_blocks_total',
                help: 'Block Sync total committed blocks',
                labelNames: ['machine', 'vchain']
            }), metricName: "BlockSync.ProcessingBlocksState.CommittedBlocks.Count"
        },
        {
            gauge: new Gauge({
                name: 'gossip_incoming_connections_active',
                help: 'Gossip active incoming connections',
                labelNames: ['machine', 'vchain']
            }), metricName: "Gossip.IncomingConnection.Active.Count"
        },
        {
            gauge: new Gauge({
                name: 'gossip_incoming_connections_listening_errors',
                help: 'Gossip errors listening on incoming connections',
                labelNames: ['machine', 'vchain']
            }), metricName: "Gossip.IncomingConnection.ListeningOnTCPPortErrors.Count"
        },
        {
            gauge: new Gauge({
                name: 'gossip_incoming_connections_transport_errors',
                help: 'Gossip transport errors on incoming connections',
                labelNames: ['machine', 'vchain']
            }), metricName: "Gossip.IncomingConnection.TransportErrors.Count"
        },
        {
            gauge: new Gauge({
                name: 'gossip_outgoing_connections_active',
                help: 'Gossip active outgoing connections',
                labelNames: ['machine', 'vchain']
            }), metricName: "Gossip.OutgoingConnection.Active.Count"
        },
        {
            gauge: new Gauge({
                name: 'gossip_outgoing_connections_send_errors',
                help: 'Gossip send errors in outgoing connections',
                labelNames: ['machine', 'vchain']
            }), metricName: "Gossip.OutgoingConnection.SendErrors.Count"
        },
        {
            gauge: new Gauge({
                name: 'gossip_outgoing_connections_keepalive_errors',
                help: 'Gossip keepalive errors in outgoing connections',
                labelNames: ['machine', 'vchain']
            }), metricName: "Gossip.OutgoingConnection.KeepaliveErrors.Count"
        },
        {
            gauge: new Gauge({
                name: 'ethereum_last_block',
                help: 'Ethereum Last Block',
                labelNames: ['machine', 'vchain']
            }), metricName: "Ethereum.Node.LastBlock"
        },





    ];


    gTotalNodes = new Gauge({name: 'total_node_count', help: 'Total Node Count', labelNames: ['vchain']});
}

async function init() {

    assertEnvVars();

    try {
        await loadNetworkConfig(net_config);
    } catch (err) {
        info(`Failed to load config from ${net_config}, exiting.`);
        process.exit(1);
    }

    initGauges();

    await refreshMetrics();
}

async function refreshMetrics() {
    const now = new Date();
    return collectAllMetrics(now)
        .then(() => {
            // info("Collected metrics from all machines");
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
        if (!machine["lastMetrics"][g.metricName]["Value"]) {
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

    // // info(`IP: ${machine["ip"]} LastSeen: ${machine["lastSeen"]}}`);
    // gBlockHeight.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["BlockStorage.BlockHeight"]["Value"], now);
    // gHeapAlloc.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["Runtime.HeapAlloc.Bytes"]["Value"], now);
    // gRSS.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["OS.Process.Memory.Bytes"]["Value"], now);
    // gUpTime.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["Runtime.Uptime.Seconds"]["Value"], now);
    // gStateKeys.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["StateStoragePersistence.TotalNumberOfKeys.Count"]["Value"], now);
    // // gVersionCommit.set({machine: machine["ip"], vchain: vchain}, machine["lastMetrics"]["Version.Commit"]["Value"], now);
    // gCurrentView.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["ConsensusAlgo.LeanHelix.CurrentElection.Value"]["Value"], now);
    // gPublicApiTotalTransactionsFromClients.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["PublicApi.TotalTransactionsFromClients.Count"]["Value"], now);
    // gTxPoolTotalCommits.set({
    //     machine: machine["ip"],
    //     vchain: vchain
    // }, machine["lastMetrics"]["TransactionPool.TotalCommits.Count"]["Value"], now);
    //

}

async function collectMetricsFromSingleMachine(machine) {
    const url = `http://${machine["ip"]}/vchains/${vchain}/metrics`;
    const options = {
        uri: url,
        timeout: 10000,
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
    console.log("Loading network config from " + configUrl);
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
            console.log("Failed to load network config: ", err);
            throw err
        })
}

async function main() {
    await init();
    app.listen(listen_port, () => info(`Prometheus client listening on port ${listen_port}!`));
}

main();

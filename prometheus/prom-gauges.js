const _ = require('lodash');
const client = require('prom-client'); // https://github.com/siimon/prom-client
const Gauge = client.Gauge;
const info = require('../util').info;

const META_NODE_LAST_SEEN_TIME_NANO = "Meta_NodeLastSeen_TimeNano";

function initGauges() {

    const gaugeNames = [
        "BlockStorage.BlockHeight",
        "BlockSync.ProcessingBlocksState.CommittedBlocks.Count",
        "BlockSync.ProcessingBlocksState.FailedToCommitBlocks.Count",
        "BlockSync.ProcessingBlocksState.FailedToValidateBlocks.Count",
        "ConsensusAlgo.LeanHelix.CurrentElection.Number",
        "Ethereum.Node.LastBlock",
        "Ethereum.TimestampBlockFinder.CacheHits.Count",
        "Ethereum.TimestampBlockFinder.LastBlockFound.Number",
        "Ethereum.TimestampBlockFinder.LastBlockFound.TimeStamp.UnixEpoch",
        "Ethereum.TimestampBlockFinder.LastBlockInEthereum.Number",
        "Ethereum.TimestampBlockFinder.TotalTimesCalled.Count",
        "Gossip.IncomingConnection.Active.Count",
        "Gossip.IncomingConnection.ListeningOnTCPPortErrors.Count",
        "Gossip.IncomingConnection.TransportErrors.Count",
        "Gossip.OutgoingConnection.Active.Count",
        "Gossip.OutgoingConnection.KeepaliveErrors.Count",
        "Gossip.OutgoingConnection.SendErrors.Count",
        "OS.Process.CPU.PerCent",
        "OS.Process.Memory.Bytes",
        "PublicApi.TotalTransactionsErrAddingToTxPool.Count",
        "PublicApi.TotalTransactionsErrDuplicate.Count",
        "PublicApi.TotalTransactionsErrInvalidRequest.Count",
        "PublicApi.TotalTransactionsErrNilRequest.Count",
        "PublicApi.TotalTransactionsFromClients.Count",
        "Runtime.HeapAlloc.Bytes",
        "Runtime.NumGoroutine.Number",
        "Runtime.Uptime.Seconds",
        "StateStorage.BlockHeight",
        "StateStoragePersistence.TotalNumberOfKeys.Count",
        "TransactionPool.BlockHeight",
        "TransactionPool.TotalCommits.Count",


        // META_NODE_LAST_SEEN_TIME_NANO

    ];

    const gauges = [];

    _.forEach(gaugeNames, gaugeName => {
        const gaugeNameUnderscores = _.replace(gaugeName, /\./g, "_");
        info(`Adding Prometheus gauge: ${gaugeNameUnderscores}`);
        gauges.push({
            gauge: new Gauge({name: gaugeNameUnderscores, help: gaugeNameUnderscores, labelNames: ['machine', 'vchain']}),
            metricName: gaugeName
        });
    });

    return gauges;


    // Remove this section after dahsboard is fixed with new names

    // const gauges = [
    //     {
    //         gauge: new Gauge({name: 'block_height', help: 'Block Height', labelNames: ['machine', 'vchain']}),
    //         metricName: "BlockStorage.BlockHeight"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'heap_alloc_bytes',
    //             help: 'Heap Allocated in bytes',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Runtime.HeapAlloc.Bytes"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'os_rss_memory_bytes',
    //             help: 'Process RSS Memory',
    //             labelNames: ['machine', 'vchain']
    //         }),
    //         metricName: "OS.Process.Memory.Bytes"
    //     },
    //     {
    //         gauge: new Gauge({name: 'os_cpu_percent', help: 'Process CPU', labelNames: ['machine', 'vchain']}),
    //         metricName: "OS.Process.CPU.PerCent"
    //     },
    //     {
    //         gauge: new Gauge({name: 'os_uptime_seconds', help: 'Process Uptime', labelNames: ['machine', 'vchain']}),
    //         metricName: "Runtime.Uptime.Seconds"
    //     },
    //     {
    //         gauge: new Gauge({name: 'os_goroutines', help: 'Number of goroutines', labelNames: ['machine', 'vchain']}),
    //         metricName: "Runtime.NumGoroutine.Value"
    //     },
    //     {
    //         gauge: new Gauge({name: 'state_keys', help: 'Number of state keys', labelNames: ['machine', 'vchain']}),
    //         metricName: "StateStoragePersistence.TotalNumberOfKeys.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'lh_current_view',
    //             help: 'Lean Helix Current View',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "ConsensusAlgo.LeanHelix.CurrentElection.Value"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'papi_total_tx_from_clients',
    //             help: 'Public API Total transactions from clients',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "PublicApi.TotalTransactionsFromClients.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'papi_err_total_requests_nil',
    //             help: 'Public API Error nil requests',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "PublicApi.TotalTransactionsErrNilRequest.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'papi_err_total_requests_invalid',
    //             help: 'Public API Error invalid requests',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "PublicApi.TotalTransactionsErrInvalidRequest.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'papi_err_cannot_add_to_txpool',
    //             help: 'Public API Error cannot add to transaction pool',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "PublicApi.TotalTransactionsErrAddingToTxPool.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'papi_err_duplicate_tx',
    //             help: 'Public API Error duplicate transactions',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "PublicApi.TotalTransactionsErrDuplicate.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'txpool_commits_total',
    //             help: 'Transaction Pool total transaction commits',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "TransactionPool.TotalCommits.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'blocksync_commited_blocks_total',
    //             help: 'Block Sync total committed blocks',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "BlockSync.ProcessingBlocksState.CommittedBlocks.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'gossip_incoming_connections_active',
    //             help: 'Gossip active incoming connections',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Gossip.IncomingConnection.Active.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'gossip_incoming_connections_listening_errors',
    //             help: 'Gossip errors listening on incoming connections',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Gossip.IncomingConnection.ListeningOnTCPPortErrors.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'gossip_incoming_connections_transport_errors',
    //             help: 'Gossip transport errors on incoming connections',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Gossip.IncomingConnection.TransportErrors.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'gossip_outgoing_connections_active',
    //             help: 'Gossip active outgoing connections',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Gossip.OutgoingConnection.Active.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'gossip_outgoing_connections_send_errors',
    //             help: 'Gossip send errors in outgoing connections',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Gossip.OutgoingConnection.SendErrors.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'gossip_outgoing_connections_keepalive_errors',
    //             help: 'Gossip keepalive errors in outgoing connections',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Gossip.OutgoingConnection.KeepaliveErrors.Count"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'ethereum_last_block',
    //             help: 'Ethereum Last Block',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: "Ethereum.Node.LastBlock"
    //     },
    //     {
    //         gauge: new Gauge({
    //             name: 'meta_last_seen',
    //             help: 'Metadata: time node was last seen',
    //             labelNames: ['machine', 'vchain']
    //         }), metricName: META_NODE_LAST_SEEN_TIME_NANO
    //     }
    // ];

    // return gauges;
}


module.exports = {
    initGauges: initGauges,
    META_NODE_LAST_SEEN_TIME_NANO: META_NODE_LAST_SEEN_TIME_NANO
};
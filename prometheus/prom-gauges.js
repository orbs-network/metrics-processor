const _ = require('lodash');
const client = require('prom-client'); // https://github.com/siimon/prom-client
const Gauge = client.Gauge;
const info = require('../util').info;

const META_NODE_LAST_SEEN_TIME_NANO = "Meta_NodeLastSeen_TimeNano";

function initApplicativeGauges(register) {

    const gaugeNames = [
        "BlockStorage.BlockHeight",
        "BlockStorage.FileSystemSize.Bytes",
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
        "TransactionPool.CommittedPool.PoolSize.Bytes",
        "TransactionPool.CommittedPool.Transactions.Count",
        "TransactionPool.PendingPool.PoolSize.Bytes",
        "TransactionPool.PendingPool.Transactions.Count",
        "TransactionPool.TotalCommits.Count",
        // META_NODE_LAST_SEEN_TIME_NANO
    ];

    const gauges = [];

    _.forEach(gaugeNames, gaugeName => {
        const gaugeNameUnderscores = _.replace(gaugeName, /\./g, "_");
        info(`Adding Prometheus gauge: ${gaugeNameUnderscores}`);
        gauges.push({
            gauge: new Gauge({
                name: gaugeNameUnderscores,
                help: gaugeNameUnderscores,
                labelNames: ['machine', 'region', 'vchain'],
                registers: [register],
            }),
            metricName: gaugeName
        });
    });

    return gauges;
}

function initAggregatedGauges(register) {
    return {
        totalNodes: new Gauge({
            name: 'total_node_count',
            help: 'Total Node Count',
            labelNames: ['vchain'],
            registers: [register],
        }),
    };
}

function initMetaGauges(register) {
    const gaugeNames = [
        "Meta.TimeLastSeen"
        ];

    const gauges = [];

    _.forEach(gaugeNames, gaugeName => {
        const gaugeNameUnderscores = _.replace(gaugeName, /\./g, "_");
        info(`Adding Prometheus gauge: ${gaugeNameUnderscores}`);
        gauges.push({
            gauge: new Gauge({
                name: gaugeNameUnderscores,
                help: gaugeNameUnderscores,
                labelNames: ['machine', 'region', 'vchain'],
                registers: [register],
            }),
            metricName: gaugeName,
        });
    });

    return gauges;

}

function initHistograms() {
    const histogramNames = [
        "BlockSync.CollectingAvailabilityResponsesState.Duration.Millis",

    ];

}


module.exports = {
    initGauges: initApplicativeGauges,
    initAggregatedGauges: initAggregatedGauges,
    META_NODE_LAST_SEEN_TIME_NANO: META_NODE_LAST_SEEN_TIME_NANO
};

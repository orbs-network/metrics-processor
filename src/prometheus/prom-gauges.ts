import {Gauge} from "prom-client"; // https://github.com/siimon/prom-client
import _ = require('lodash');
import promClient = require('prom-client');

const info = require('../util').info;

export type MetricToGaugeMap = { [metricName: string]: Gauge }

export function initApplicativeGauges(register: promClient.Registry): MetricToGaugeMap {

    const metricNames = [
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
        "OS.Time.Drift.Millis",
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
        "TransactionPool.CommitRate.PerSecond",
        "TransactionPool.PendingPool.PoolSize.Bytes",
        "TransactionPool.PendingPool.Transactions.Count",
        "TransactionPool.TotalCommits.Count",

        "Meta.TimeSinceLastSeen.Millis",
        "Meta.TimeSinceLastBlock.Millis"
        // META_NODE_LAST_SEEN_TIME_NANO
    ];

    const gauges: MetricToGaugeMap = {};

    for (const metricName of metricNames) {
        const gaugeNameUnderscores = _.replace(metricName, /\./g, "_");
        info(`Adding Prometheus gauge: ${gaugeNameUnderscores}`);
        gauges[metricName] = new Gauge({
            name: gaugeNameUnderscores,
            help: gaugeNameUnderscores,
            labelNames: ['machine', 'region', 'vchain'],
            registers: [register],
        })
    }

    return gauges;
}
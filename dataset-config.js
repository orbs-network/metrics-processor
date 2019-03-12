const DATASET_TX_CONFIG_NAME = "orbs.stability.metrics.tx";
const DATASET_OS_CONFIG_NAME = "orbs.stability.metrics.os";
const DATASET_BLOCKS_CONFIG_NAME = "orbs.stability.metrics.blocks";

const DATASET_TX_CONFIG = {
    id: DATASET_TX_CONFIG_NAME,
    fields: {
        time: {
            type: "datetime",
            name: "Time"
        },
        node_addr: {
            type: "string",
            name: "Address"
        },
        total_tx_from_clients: {
            type: "number",
            name: "Total TX from clients since uptime"
        },
        total_tx_into_committed_pool: {
            type: "number",
            name: "Total TX to committed pool"
        },
        tps_from_clients: {
            type: "number",
            name: "TX/s from clients"
        },
        tps_into_committed_pool: {
            type: "number",
            name: "TX/s to committed pool"
        },
        tx_time_in_pending_max: {
            type: "number",
            name: "TX minutes in pending pool MAX"
        },
        tx_time_in_pending_p99: {
            type: "number",
            name: "TX minutes in pending pool P99"
        }
    }
};

const DATASET_OS_CONFIG = {
    id: DATASET_OS_CONFIG_NAME,
    fields: {
        time: {
            type: "datetime",
            name: "Time"
        },
        node_addr: {
            type: "string",
            name: "Address"
        },
        heap_alloc: {
            type: "number",
            name: "Allocated Heap (bytes)"
        },
        rss: {
            type: "number",
            name: "RSS Memory (bytes)"
        },
        uptime: {
            type: "number",
            name: "Uptime (minutes)"
        },
        last_seen: {
            type: "number",
            type: "Last seen (millis)"
        },
        ver_commit: {
            type: "string",
            name: "Version Commit"
        },
        node_count: {
            type: "number",
            name: "Node count"
        }
    }
};

const DATASET_BLOCKS_CONFIG = {
    id: DATASET_BLOCKS_CONFIG_NAME,
    fields: {
        time: {
            type: "datetime",
            name: "Time"
        },
        node_addr: {
            type: "string",
            name: "Address"
        },
        block_height: {
            type: "number",
            name: "Block Height"
        },
        kpi_block_height_diff: {
            type: "number",
            name: "MAX Block Height diff between nodes"
        },
        state_keys: {
            type: "number",
            name: "State Keys"
        }
    }
};

module.exports = {
    DATASET_BLOCKS_CONFIG_NAME: DATASET_BLOCKS_CONFIG_NAME,
    DATASET_OS_CONFIG_NAME: DATASET_OS_CONFIG_NAME,
    DATASET_TX_CONFIG_NAME: DATASET_TX_CONFIG_NAME,
    DATASET_TX_CONFIG: DATASET_TX_CONFIG,
    DATASET_BLOCKS_CONFIG: DATASET_BLOCKS_CONFIG,
    DATASET_OS_CONFIG: DATASET_OS_CONFIG
};
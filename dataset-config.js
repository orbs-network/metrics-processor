const DATASET_TX_CONFIG_NAME = "orbs.stability.metrics.tx"
const DATASET_OS_CONFIG_NAME = "orbs.stability.metrics.os"
const DATASET_BLOCKS_CONFIG_NAME = "orbs.stability.metrics.blocks"

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
        tps_entering_pool: {
            type: "number",
            name: "TX/s entering pool"
        },
        tx_time_in_pending_max: {
            type: "number",
            name: "TX time in pending pool MAX"
        },
        tx_time_in_pending_p99: {
            type: "number",
            name: "TX time in pending pool P99"
        }
    }
}

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
        uptime: {
            type: "number",
            name: "Uptime (seconds)"
        }
    }
}

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
}

module.exports = {
    DATASET_BLOCKS_CONFIG_NAME: DATASET_BLOCKS_CONFIG_NAME,
    DATASET_OS_CONFIG_NAME: DATASET_OS_CONFIG_NAME,
    DATASET_TX_CONFIG_NAME: DATASET_TX_CONFIG_NAME,
    DATASET_TX_CONFIG: DATASET_TX_CONFIG,
    DATASET_BLOCKS_CONFIG: DATASET_BLOCKS_CONFIG,
    DATASET_OS_CONFIG: DATASET_OS_CONFIG
}
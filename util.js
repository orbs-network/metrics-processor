

function info(str) {
    console.log(`INFO  ${new Date().toISOString()} ${process.pid} ${str}`);
}

function debug(str) {
    if (process.env.METRICS_DEBUG === "") {
        return
    }
    console.log(`DEBUG ${new Date().toISOString()} ${process.pid} ${str}`);
}


module.exports = {
    info: info,
    debug: debug
};
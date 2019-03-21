function info(str) {
    console.log(`${new Date().toISOString()} ${process.pid} ${str}`);
}

module.exports = {
    info: info
};
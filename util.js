function info(str) {
    console.log(`${new Date().toISOString()} ${str}`);
}

module.exports = {
    info: info
};
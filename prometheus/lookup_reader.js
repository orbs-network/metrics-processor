const fs = require('fs');

let lookup = {};

function read(path) {

    let rawdata = fs.readFileSync(path);
    lookup = JSON.parse(rawdata);
}

function ipToNodeName(ip) {
    if (lookup[ip]) {
        return lookup[ip].nodeName;
    }
    return ip;
}

function ipToRegion(ip) {
    if (lookup[ip]) {
        return lookup[ip].region;
    }
    return ip;
}


module.exports = {
    read: read,
    ipToNodeName: ipToNodeName,
    ipToRegion: ipToRegion
};
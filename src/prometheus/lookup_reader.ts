const fs = require('fs');

let lookup = {};

export function read(path) {

    let rawdata = fs.readFileSync(path);
    lookup = JSON.parse(rawdata);
}

export function ipToNodeName(ip) {
    if (lookup[ip]) {
        return lookup[ip].nodeName;
    }
    return ip;
}

export function ipToRegion(ip) {
    if (lookup[ip]) {
        return lookup[ip].region;
    }
    return ip;
}
const _ = require("lodash");
const nock = require("nock");
const {
    describe,
    it
} = require("mocha");
const chai = require("chai");
const asserttype = require("chai-asserttype");
chai.use(asserttype);

const {
    expect
} = chai;

const {
    init,
    collectAllMetrics,
    refreshMetrics,
} = require("../prometheus-client");

const metricsScope = nock('http://example.com')
  .persist()
  .get('/vchains/40000/metrics')
  .reply(200, require("./fixtures/metrics"));

const boyarScope = nock('http://s3.example.com')
  .persist()
  .get('/boyar/config.json')
  .reply(200, require("./fixtures/boyar.config.json"));

describe("#collectAllMetrics", () => {
    it("collects the metrics", async () => {
        const result = await collectAllMetrics({
            "node1": {
                ip: "example.com",
            }
        }, 40000);

        expect(result).not.to.be.empty;
        expect(result["example.com"]["BlockStorage.BlockHeight"].Value).to.be.eql(7801);
        expect(result["example.com"]["Version.Commit"].Value).to.be.eql("bf37451bad4ac01994c47b61e386eb85bdbe0aaf");
    });
});

describe("#init", () => {
    it("returns a processor with a set of prometheus metrics", async () => {
        const processor = await init({
            vchain: 40000,
            gnoredIPs: [],
            boyarConfigURL: "http://s3.example.com/boyar/config.json"
        });

        expect(processor).not.to.be.empty;
        expect(processor.data.metrics).to.be.empty;
    });
});

describe("#refreshMetrics", () => {
    it("updates processor with a set of prometheus metrics", async () => {
        const processor = await init({
            vchain: 40000,
            gnoredIPs: [],
            boyarConfigURL: "http://s3.example.com/boyar/config.json"
        });

        expect(processor).not.to.be.empty;

        await refreshMetrics(processor);
        expect(processor.data.metrics["example.com"]).not.to.be.empty;

        const blockHeightGaugeValue = processor.data.prometheus.gauges[0].gauge.get();
        expect(blockHeightGaugeValue.name).to.be.equal("BlockStorage_BlockHeight");
        expect(blockHeightGaugeValue.values[0].value).to.be.equal(7801);
    });
})

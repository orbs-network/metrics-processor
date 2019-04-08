import {Client, NetworkType} from 'orbs-client-sdk';
import {GetBlockResponse} from 'orbs-client-sdk/dist/codec/OpGetBlock';
import {info} from '../util';

export type RawBlock = {
    blockHeight: string;
    blockHash: string;
    timeStamp: Date;
}

export async function getBlock(ip: string, vchain: number, height: bigint): Promise<RawBlock> {
    const url = `http://${ip}/vchains/${vchain}`;
    const orbsClient = new Client(url, vchain, NetworkType.NETWORK_TYPE_MAIN_NET);
    // info(`Calling ${url}`);
    return blockResponseToRawBlock(await orbsClient.getBlock(BigInt(height)));
}

function uint8ArrayToHexString(arr: Uint8Array): string {
    return '0x' + Buffer.from(arr).toString('hex');
}

function hexStringToUint8Array(str: string): Uint8Array {
    return new Uint8Array(Buffer.from(str, 'hex'));
}

function blockResponseToRawBlock(getBlockResponse: GetBlockResponse): RawBlock {
    const blockHash = uint8ArrayToHexString(getBlockResponse.resultsBlockHash);
    const blockHeight = getBlockResponse.resultsBlockHeader.blockHeight.toString();
    return {
        blockHeight,
        blockHash,
        timeStamp: getBlockResponse.blockTimestamp
    };
}
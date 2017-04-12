/// <reference types="node" />
import * as net from 'net';
import AbstractFs from './fs/abstract';
import EventEmitter = require('events');
export declare type Socket = net.Socket;
/**
 * Options for FtpServer
 */
export declare type FtpServerOptions = {};
export default class FtpServer extends EventEmitter {
    options: FtpServerOptions;
    closing: boolean;
    constructor(options: FtpServerOptions);
    listen(host?: string, port?: number): void;
}
export declare type FtpServerConnectionOptions = {
    socket: Socket;
    server: FtpServer;
    fs: AbstractFs;
};
export declare class FtpServerConnection {
    socket: Socket;
    fs: AbstractFs;
    server: FtpServer;
    constructor(options: FtpServerConnectionOptions);
    reply(code: number, message?: string): Promise<{}>;
    write(msg: string | Buffer, encoding?: string): Promise<{}>;
    handleError(err: any): void;
    formatError(err: any): string;
}
/**
 * Standard messages for status (RFC 959)
 */
export declare const messages: {
    "200": string;
    "500": string;
    "501": string;
    "202": string;
    "502": string;
    "503": string;
    "504": string;
    "110": string;
    "211": string;
    "212": string;
    "213": string;
    "214": string;
    "215": string;
    "120": string;
    "220": string;
    "221": string;
    "421": string;
    "125": string;
    "225": string;
    "425": string;
    "226": string;
    "426": string;
    "227": string;
    "230": string;
    "530": string;
    "331": string;
    "332": string;
    "532": string;
    "150": string;
    "250": string;
    "257": string;
    "350": string;
    "450": string;
    "550": string;
    "451": string;
    "551": string;
    "452": string;
    "552": string;
    "553": string;
};
/**
 * Commands implemented by the FTP server
 */
export declare const commands: {
    "ABOR": () => void;
    "ACCT": () => void;
    "ADAT": () => void;
    "ALLO": () => void;
    "APPE": () => void;
    "AUTH": () => void;
    "CCC": () => void;
    "CONF": () => void;
    "ENC": () => void;
    "EPRT": () => void;
    "EPSV": () => void;
    "HELP": () => void;
    "LANG": () => void;
    "LPRT": () => void;
    "LPSV": () => void;
    "MDTM": () => void;
    "MIC": () => void;
    "MKD": () => void;
    "MLSD": () => void;
    "MLST": () => void;
    "MODE": () => void;
    "NOOP": () => void;
    "OPTS": () => void;
    "REIN": () => void;
    "STOU": () => void;
    "STRU": () => void;
    "PBSZ": () => void;
    "SITE": () => void;
    "SMNT": () => void;
    "RMD": () => void;
    "STAT": () => void;
    "FEAT": () => void;
    "SYST": () => void;
    "CDUP": () => void;
    "CWD": (dir: any) => void;
    "PWD": () => void;
    "XPWD": () => void;
    "TYPE": (dataEncoding: any) => void;
    "USER": (username: any) => void;
    "PASS": (password: any) => void;
    "PASV": () => void;
    "PORT": (info: any) => void;
    "LIST": (target: any) => void;
    "NLST": (target: any) => void;
    "RETR": (file: any) => void;
    "STOR": (file: any) => void;
    "DELE": (file: any) => void;
    "RNFR": (name: any) => void;
    "RNTO": (name: any) => void;
    "REST": (start: any) => void;
    "QUIT": () => void;
};

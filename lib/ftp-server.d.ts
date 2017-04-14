/// <reference types="node" />
import * as EventEmitter from 'events';
import * as ftpd from 'ftpd';
export declare type FtpUser = {
    name: string;
    password: string;
};
export declare type FtpServerOptions = {
    rootPath?: string;
    initialCwd?: string;
    users?: FtpUser[];
    allowAnonymous?: boolean;
    dockerExecPath?: string;
    host?: string;
    port?: number;
};
export declare type ClientConnectedEvent = {
    connection: any;
    preventDefault: () => void;
};
export default class FtpServer extends EventEmitter {
    options: FtpServerOptions;
    ftpd: ftpd.FtpServer;
    constructor(options?: FtpServerOptions);
    listen(host?: string, port?: number): void;
    stop(): void;
}

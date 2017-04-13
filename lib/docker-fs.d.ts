/// <reference types="node" />
import * as fs from 'fs';
import { ShellExecResult } from './shell';
import * as stream from 'stream';
export declare class DockerFsError extends Error {
    code: string | number;
    constructor(msg: string, code: string | number);
}
/**
 * Asynchronous stat - get the file stats of {path}
 *
 * @param path
 * @param callback
 */
export declare function stat(path: string | Buffer, callback?: (err: Error, stats: fs.Stats) => any): void;
/**
 * Asynchronous unlink - deletes the file specified in {path}
 *
 * @param path
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
export declare function unlink(path: string | Buffer, callback?: (err?: NodeJS.ErrnoException) => void): void;
/**
 * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
 *
 * @param path
 * @param mode
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
export declare function mkdir(path: string | Buffer, mode?: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
export declare function open(path: string | Buffer, flags: string | number, callback: (err: NodeJS.ErrnoException, fd: number) => void): void;
export declare type CreateReadStreamOptions = {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
    end?: number;
};
export declare class DockerFsReadStream extends stream.Readable implements fs.ReadStream {
    bytesRead: number;
    path: string | Buffer;
    innerStream: fs.ReadStream;
    constructor(init: (cb: (err: Error, innerStream: fs.ReadStream) => void) => void);
    close(): void;
    destroy(): void;
}
export declare function createReadStream(path: string | Buffer, options?: CreateReadStreamOptions): fs.ReadStream;
export declare type CreateWriteStreamOptions = {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
};
export declare function createWriteStream(path: string | Buffer, options?: CreateWriteStreamOptions): fs.WriteStream;
export declare function readFile(filename: string, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;
export declare type WriteFileOptions = {
    encoding?: string;
    mode?: number;
    flag?: string;
};
export declare function writeFile(filename: string, data: any, options: WriteFileOptions, callback?: (err: NodeJS.ErrnoException) => void): void;
/**
 * Asynchronous rmdir - removes the directory specified in {path}
 *
 * @param path
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
export declare function rmdir(path: string | Buffer, callback?: (err?: NodeJS.ErrnoException) => void): void;
/**
 * Asynchronous rename.
 * @param oldPath
 * @param newPath
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
export declare function rename(oldPath: string, newPath: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
export declare function readdir(path: string | Buffer, callback?: (err: NodeJS.ErrnoException, files: string[]) => void): void;
export declare function isRoot(path: string | Buffer): boolean;
export declare class DockerContainer {
    name: string;
    manager: DockerContainerManager;
    constructor(options: {
        name: string;
        manager: DockerContainerManager;
    });
    shellExec(cmd: string | string[]): Promise<ShellExecResult>;
    download(containerFilePath: any, localFilePath: any): Promise<ShellExecResult>;
    upload(localFilePath: any, containerFilePath: any): Promise<ShellExecResult>;
    dispose(): Promise<void>;
    _initShell(): Promise<void>;
    _execInShell(shell: any, cmd: any): Promise<ShellExecResult>;
}
/**
 * docker容器的管理器
 */
export declare class DockerContainerManager {
    readonly containers: {
        [name: string]: DockerContainer;
    };
    parseDockerFsPath(path: string | Buffer): [DockerContainer, string];
    getContainerByName(containerName: string): DockerContainer;
    unregister(containerName: string): void;
}
export declare const dockerContainerManager: DockerContainerManager;
export declare function parseShellStatOutputToFsStats(shellStatOutput: string): fs.Stats;

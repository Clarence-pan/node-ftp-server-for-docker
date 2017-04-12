/// <reference types="node" />
export declare type FileStat = {};
export declare type FsOptions = {
    hideDotFiles: boolean;
};
/**
 * Abstract FileSystem(fs)
 */
export default class AbstractFs {
    _cwd: string;
    _options: FsOptions;
    constructor(options: FsOptions);
    cwd(): string;
    chdir(dir: string): Promise<void>;
    ls(dir?: string): Promise<string[]>;
    stat(fileOrDir: string): Promise<FileStat>;
    getContents(file: string): Promise<Buffer>;
    putContents(file: string, contents: Buffer): Promise<void>;
    rename(srcFile: string, destFile: string): Promise<void>;
    remove(file: string): Promise<void>;
    isDir(dir: string): Promise<boolean>;
    isFile(file: string): Promise<boolean>;
    exists(file: string): Promise<boolean>;
}
export declare class FsError extends Error {
    constructor(msg?: string);
    static readonly defaultMessage: string;
}
export declare class InvalidOperationError extends FsError {
    static readonly defaultMessage: string;
}
export declare class NotImplementedError extends FsError {
    static readonly defaultMessage: string;
}

import * as child_process from 'child_process';
export interface ShellExecResult {
    retCode: number | void;
    stdout: string;
    stderr: string;
    error?: Error;
}
export interface ShellExecOptions extends child_process.ExecOptions {
    noThrown: boolean;
}
export declare class ShellExecError extends Error {
    constructor(msg: string, detail?: any);
}
export declare function shellExec(cmd: string | string[], options?: ShellExecOptions): Promise<ShellExecResult>;
/**
 * escape a shell's argument
 * @param arg
 * @param allowValAndEval
 */
export declare function shellEscape(arg: string, allowValAndEval?: boolean): string;

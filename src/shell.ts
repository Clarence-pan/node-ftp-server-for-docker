import * as child_process from 'child_process'

const debug = require('debug')('shell')

export interface ShellExecResult {
    retCode: number|void;
    stdout: string;
    stderr: string;
    error?: Error;
}

export interface ShellExecOptions extends child_process.ExecOptions {
    noThrown: boolean;
}

export class ShellExecError extends Error{
    constructor(msg: string, detail?: any){
        super(msg)

        if (detail){
            for (let k in detail){
                if (detail.hasOwnProperty(k)){
                    this[k] = detail[k]
                }
            }
        }
    }
}

export async function shellExec(cmd: string|string[], options?: ShellExecOptions): Promise < ShellExecResult > {
    let args: string[] = []
    if (Array.isArray(cmd)){
        args = cmd
        cmd = shellEscape(args[0])
        args = args.slice(1).map(x => shellEscape(x))
    }

    let execCmd = cmd + ' ' + args.join(' ')

    debug(`ShellExec: ${execCmd}`)

    return new Promise<ShellExecResult>(function(resolve, reject){
        let retCode: number|void = null
        let shellProc = child_process.exec(execCmd, options, function(err, stdout, stderr){
            debug(`[${execCmd}]: end: `, {err, stdout, stderr, retCode})

            if (err){
                reject(err)
                return
            }

            if (retCode !== 0){
                err = new ShellExecError(`Process ${cmd} exit with code: ${retCode}`, {stdout, stderr, retCode})
            }

            if (retCode === 0 || options.noThrown){
                let res: ShellExecResult = {retCode, stdout,stderr}
                if (err){
                    res.error = err
                }

                resolve(res)
            } else {
                reject(err)
            }
        })

        shellProc.on('exit', function(code, signal){
            debug(`[${execCmd}]: exit with code: `, code)
            retCode = code
        })
    })
}


/**
 * escape a shell's argument
 * @param arg 
 * @param allowValAndEval 
 */
export function shellEscape(arg: string, allowValAndEval:boolean=true){
    arg = arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

    if (!allowValAndEval){
        arg = arg.replace(/`/g, '\\`').replace(/\$/g, '\\$')
    }

    return '"' + arg + '"'
}

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const path = require("path");
const debug = require('debug')('shell');
class ShellExecError extends Error {
    constructor(msg, detail) {
        super(msg);
        if (detail) {
            for (let k in detail) {
                if (detail.hasOwnProperty(k)) {
                    this[k] = detail[k];
                }
            }
        }
    }
}
exports.ShellExecError = ShellExecError;
function shellExec(cmd, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let args = [];
        if (Array.isArray(cmd)) {
            args = cmd;
            cmd = shellEscape(args[0]);
            args = args.slice(1).map(x => shellEscape(x));
        }
        let execCmd = cmd + ' ' + args.join(' ');
        debug(`ShellExec: %s`, execCmd);
        return new Promise(function (resolve, reject) {
            let retCode = null;
            let shellProc = child_process.exec(execCmd, options, function (err, stdout, stderr) {
                debug(`[%s]: end:\nSTDOUT:\n%s\nSTDERR:\n%s\n   => `, execCmd, stdout, stderr, { err, retCode });
                if (err) {
                    reject(err);
                    return;
                }
                if (retCode !== 0) {
                    err = new ShellExecError(`Process ${cmd} exit with code: ${retCode}`, { stdout, stderr, retCode });
                }
                if (retCode === 0 || options.noThrown) {
                    let res = { retCode, stdout, stderr };
                    if (err) {
                        res.error = err;
                    }
                    resolve(res);
                }
                else {
                    reject(err);
                }
            });
            shellProc.on('exit', function (code, signal) {
                debug(`[%s]: exit with code: %s`, execCmd, code);
                retCode = code;
            });
        });
    });
}
exports.shellExec = shellExec;
/**
 * escape a shell's argument
 * @param arg
 * @param allowValAndEval
 */
function shellEscape(arg, allowValAndEval = false) {
    if (path.sep === '/') {
        arg = arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        if (!allowValAndEval) {
            arg = arg.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        }
        return '"' + arg + '"';
    }
    else {
        return '"' + arg + '"';
    }
}
exports.shellEscape = shellEscape;

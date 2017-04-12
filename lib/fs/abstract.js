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
const path = require("path");
/**
 * Abstract FileSystem(fs)
 */
class AbstractFs {
    constructor(options) {
        this._cwd = '~';
        this._options = options;
    }
    cwd() {
        return this._cwd;
    }
    chdir(dir) {
        return __awaiter(this, void 0, void 0, function* () {
            let switchToDir = path.isAbsolute(dir)
                ? dir
                : path.join(this._cwd, dir);
            if (!(yield this.isDir(switchToDir))) {
                throw new InvalidOperationError(`${dir} not exists or is not a direc`);
            }
        });
    }
    ls(dir = '') {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    stat(fileOrDir) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    getContents(file) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    putContents(file, contents) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    rename(srcFile, destFile) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    remove(file) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    isDir(dir) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    isFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
    exists(file) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new NotImplementedError();
        });
    }
}
exports.default = AbstractFs;
class FsError extends Error {
    constructor(msg) {
        super(msg || new.target.defaultMessage);
    }
    static get defaultMessage() {
        return "FileSystem Error!";
    }
}
exports.FsError = FsError;
class InvalidOperationError extends FsError {
    static get defaultMessage() {
        return "Invalid Operation!";
    }
}
exports.InvalidOperationError = InvalidOperationError;
class NotImplementedError extends FsError {
    static get defaultMessage() {
        return 'Not implemented yet.';
    }
}
exports.NotImplementedError = NotImplementedError;

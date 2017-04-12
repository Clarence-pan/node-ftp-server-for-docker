import * as path from 'path'

export type FileStat = {
    // todo...
}

export type FsOptions = {
    hideDotFiles: boolean,
}

/**
 * Abstract FileSystem(fs)
 */
export default class AbstractFs
{
    _cwd : string = '~'
    _options: FsOptions

    constructor(options: FsOptions){
        this._options = options
    }

    cwd() {
        return this._cwd
    }

    async chdir(dir : string) {
        let switchToDir = path.isAbsolute(dir)
            ? dir
            : path.join(this._cwd, dir)
        if (!await this.isDir(switchToDir)) {
            throw new InvalidOperationError(`${dir} not exists or is not a direc`)
        }
    }

    async ls(dir : string = '') : Promise < string[] > {
        throw new NotImplementedError()
    }

    async stat(fileOrDir : string) : Promise < FileStat > {
        throw new NotImplementedError()
    }

    async getContents(file : string) : Promise < Buffer > {
        throw new NotImplementedError()
    }

    async putContents(file : string, contents : Buffer) {
        throw new NotImplementedError()
    }

    async rename(srcFile : string, destFile : string) {
        throw new NotImplementedError()
    }

    async remove(file : string) {
        throw new NotImplementedError()
    }

    async isDir(dir : string) : Promise < boolean > {
        throw new NotImplementedError()
    }

    async isFile(file: string): Promise < boolean > {
        throw new NotImplementedError()
    }

    async exists(file: string): Promise < boolean > {
        throw new NotImplementedError()
    }
}

export class FsError extends Error {
    constructor(msg?: string)
    {
        super(msg || new.target.defaultMessage)
    }

    static get defaultMessage() {
        return "FileSystem Error!"
    }
}

export class InvalidOperationError extends FsError {
    static get defaultMessage() {
        return "Invalid Operation!"
    }

}

export class NotImplementedError extends FsError
{
    static get defaultMessage() {
        return 'Not implemented yet.'
    }
}
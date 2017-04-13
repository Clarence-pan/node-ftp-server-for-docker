import * as fs from 'fs'
import * as cb2p from 'cb2p'
import * as tmp from 'tmp'
import {shellExec, ShellExecOptions, ShellExecResult, shellEscape} from './shell'
import * as stream from 'stream'

const debug = require('debug')('docker-fs')
const child_proces = require('child_process')
const writeFileAsync = cb2p(fs.writeFile.bind(fs))

export class DockerFsError extends Error{
    code: string|number

    constructor(msg: string, code: string|number){
        super(msg)
        this.code = code
    }
}

/**
 * Asynchronous stat - get the file stats of {path}
 *
 * @param path
 * @param callback
 */
export function stat(path : string | Buffer, callback?: (err : Error, stats : fs.Stats) => any) : void
{
    debug('stat ', path)

    if (isRoot(path)){
        callback(null, {
            isFile: () => false,
            isDirectory: () => true,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isSymbolicLink: () => false,
            isFIFO: () => false,
            isSocket: () => false,
            dev: 0,
            ino: 0,
            mode: 0,
            nlink: 0,
            uid: 0,
            gid: 0,
            rdev: 0,
            size: 0,
            blksize: 0,
            blocks: 0,
            atime: new Date('1970-01-01'),
            mtime: new Date('1970-01-01'),
            ctime: new Date('1970-01-01'),
            birthtime: new Date('1970-01-01')
        })
        return
    }
    
    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)

        // 2. 通过sh运行 stat
        let res = await container.shellExec(['stat', pathInContainer])

        // 3. 解析结果
        let stats = parseShellStatOutputToFsStats(res.stdout)

        callback(null, stats)
    })().catch(err => callback(err as Error, null))
}

/**
 * Asynchronous unlink - deletes the file specified in {path}
 *
 * @param path
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */

export function unlink(path : string | Buffer, callback?: (err?: NodeJS.ErrnoException) => void) : void
{
    debug('unlink ', path)
    
    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)
        if (pathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 通过sh运行 rm
        let res = await container.shellExec(['rm', '-f', pathInContainer])

        callback(null)
    })().catch(err => callback(err as Error))
}

/**
 * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
 *
 * @param path
 * @param mode
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */

export function mkdir(path : string | Buffer, mode?: number, callback?: (err?: NodeJS.ErrnoException) => void) : void {

    debug('mkdir ', {path, mode})
    
    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)
        if (pathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 通过sh运行 mkdir
        let res = await container.shellExec(['mkdir', pathInContainer])

        callback(null)
    })().catch(err => callback(err as Error))
}

export function open(path : string | Buffer, flags : string | number, callback : (err : NodeJS.ErrnoException, fd : number) => void) : void {
    debug('open ', {path, flags})
    
    ~(async function () {
        if (flags !== 'r') {
            // todo: how to support write?
            callback(new Error("dockerFs.open(): only 'r'(read) is allowed."), 0)
            return
        }

        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)
        if (pathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 通过 docker cp 把文件拷贝到本地，然后打开
        let localFile = generateTempFileName()
        await container.download(pathInContainer, localFile)

        fs.open(localFile, flags, function (err, fd) {
            callback(err, fd)
        })
    })().catch(err => callback(err as Error, 0))
    
    return fs.open(path, flags, callback)
}

export type CreateReadStreamOptions = {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
    end?: number;
}

export class DockerFsReadStream extends stream.Readable implements fs.ReadStream {
        bytesRead: number;
        path: string | Buffer;
        innerStream: fs.ReadStream;

        constructor(init: (cb:(err:Error, innerStream: fs.ReadStream) => void) => void){
            super()

            init(function(err, innerStream){
                if (err){
                    this.emit('error', err)
                    this.push(null)
                    return
                }

                this.innerStream = innerStream

                innerStream.on('data', (data) => {
                    this.push(data)
                })

                innerStream.on('end', () => {
                    this.push(null)
                })

                innerStream.on('error', err => {
                    this.emit('error', err)
                })
            })
        }

        close() {
            if (this.innerStream){
                this.innerStream.close()
            }
        }

        destroy() {
            if (this.innerStream){
                this.innerStream.destroy()
            }
        }

}

export function createReadStream(path : string | Buffer, options?: CreateReadStreamOptions) : fs.ReadStream {
    debug('createReadStream ', {path, options})
    
    if (path) {
        let resultStream = new DockerFsReadStream(function(cb){
            open(path, 'r', function(err, fd){
                if (err){
                    cb(err, null)
                } else {
                    cb(null, fs.createReadStream(null, {fd: fd, ...options}))
                }                
            })
        })

        resultStream.path = path
        return resultStream
    }

    if (!options || !options.fd) {
        throw new Error("Invalid options! You must specify a `fd`.")
    }

    return fs.createReadStream(path, options)
}

export type CreateWriteStreamOptions = {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
}

export function createWriteStream(path : string | Buffer, options?: CreateWriteStreamOptions) : fs.WriteStream {
    debug('createWriteStream', {path, options})

    // 1. 转换路径
    let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)
    if (pathInContainer === '/'){
        throw new DockerFsError('Permition denied.', 'EDENIED')
    }

    // 2. 创建临时文件，先写入临时文件
    let localFile = generateTempFileName()
    let localFileStream = fs.createWriteStream(localFile, options)

    // 3. 写入完成后，通过 docker copy 把文件上传到容器内
    localFileStream
        .on('end', function () {
            // todo: 失败了怎么办？
            container
                .upload(localFile, pathInContainer)
                .catch(err => {
                    localFileStream.emit('error', err)
                })
        }) 

    return localFileStream
}

export function readFile(filename : string, callback : (err : NodeJS.ErrnoException, data : Buffer) => void) : void {
    debug('readFile', {filename})
    
    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(filename)
        if (pathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 通过 docker cp 把文件拷贝到本地，然后打开
        let localFile = generateTempFileName()
        await container.download(pathInContainer, localFile)

        fs.readFile(localFile, callback)
    })().catch(err => callback(err as Error, null))

    // return fs.readFile(filename, callback)
}

export type WriteFileOptions = {
    encoding?: string;
    mode?: number;
    flag?: string;
}

export function writeFile(filename : string, data : any, options : WriteFileOptions, callback?: (err : NodeJS.ErrnoException) => void) : void {
    debug('writeFile', {filename, options, data})
    
    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(filename)
        if (pathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 先写入临时文件
        let localFile = generateTempFileName()
        await writeFileAsync(localFile, data, options)

        // 3. 然后上传到容器内
        await container.upload(localFile, pathInContainer)

        callback(null)
    })().catch(err => callback(err as Error))

    // return fs.writeFile(filename, data, options, callback)
}

/**
 * Asynchronous rmdir - removes the directory specified in {path}
 *
 * @param path
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */

export function rmdir(path : string | Buffer, callback?: (err?: NodeJS.ErrnoException) => void) : void {
    debug('rmdir', {path})

    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)
        if (pathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 执行shell删除目录
        await container.shellExec(['rmdir', pathInContainer])

        callback(null)
    })().catch(err => callback(err as Error))

    // return fs.rmdir(path, callback)
}

/**
 * Asynchronous rename.
 * @param oldPath
 * @param newPath
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */

export function rename(oldPath : string, newPath : string, callback?: (err?: NodeJS.ErrnoException) => void) {
    debug('rename', {oldPath, newPath})
    // return fs.rename(oldPath, newPath, callback)

    ~(async function () {
        // 1. 转换路径
        let [container1, oldPathInContainer] = dockerContainerManager.parseDockerFsPath(oldPath)
        let [container2, newPathInContainer] = dockerContainerManager.parseDockerFsPath(newPath)

        if (container1 !== container2) {
            throw new Error("move file across container is not supported yet!")
        }

        if (oldPathInContainer === '/' || newPathInContainer === '/'){
            throw new DockerFsError('Permition denied.', 'EDENIED')
        }

        // 2. 执行shell删除目录
        await container1.shellExec(['mv', oldPathInContainer, newPathInContainer])

        callback(null)
    })().catch(err => callback(err as Error))
}

export function readdir(path : string | Buffer, callback?: (err : NodeJS.ErrnoException, files : string[]) => void) : void {
    debug('readdir', {path})
    // return fs.readdir(path, callback)
    
    ~(async function () {
        if (isRoot(path)){
            let res = await shellExec(['docker', 'ps', '--format', '{{.Names}}'])
            callback(null, res.stdout.split('\n').map(line => line.trim()))
            return
        }

        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)

        // 2. 执行shell删除目录
        let res = await container.shellExec(['ls', '-1', '--color=none', pathInContainer])

        callback(null, res.stdout.split("\n").map(line => line.trim()))
    })().catch(err => callback(err as Error, []))
}

export function isRoot(path: string|Buffer){
    if (path instanceof Buffer){
        path = path.toString()
    }

    return path === '/' || path === '\\'
}


export class DockerContainer {
    name: string
    manager: DockerContainerManager
    constructor(options: {name: string, manager: DockerContainerManager}){
        this.name = options.name
        this.manager = options.manager
    }

    async shellExec(cmd : string | string[]) : Promise < ShellExecResult > {
        // todo... 注意使用export LANG=en
        // 使用 < /dev/null 可以让程序忽略输入，禁止交互
        
        let finalCmd = typeof cmd === 'string' ? cmd : cmd.map(x => shellEscape(x)).join(' ')

        debug("[DockerContainer.ShellExec] " + cmd)

        // 新建shell会比较快
        // let shell = await this._initShell()
        // return this._execInShell(shell, finalCmd)

        // 但是我们先测下每次都重建shell
        return shellExec(['docker', 'exec', this.name].concat(cmd))

    }

    async download(containerFilePath, localFilePath) {
        return shellExec(['docker', 'cp', `${this.name}:${containerFilePath}`, localFilePath])
    }

    async upload(localFilePath, containerFilePath) {
        return shellExec(['docker', 'cp', localFilePath, `${this.name}:${containerFilePath}`])
    }

    async dispose() {
        this.manager.unregister(this.name)
    }

    async _initShell(){
        throw new Error("todo...")
    }

    async _execInShell(shell, cmd) : Promise < ShellExecResult >{
        throw new Error("todo...")
    }


}

/**
 * docker容器的管理器
 */
export class DockerContainerManager {
    readonly containers:{[name:string]: DockerContainer} = {}

    parseDockerFsPath(path : string | Buffer) : [DockerContainer, string]{
        if (path instanceof Buffer){
            path = path.toString('utf8')
        }

        path = path.replace(/\\/g, '/')
        if (path[0] != '/'){
            throw new Error("Invalid docker-fs path! The path must start with a `/`!")
        }

        let containerName, pathInContainer
        let slashPos = path.indexOf('/', 1)
        if (slashPos <= 0){
            containerName = path.substring(1)
            pathInContainer = '/'
        } else {
            containerName = path.substring(1, slashPos)
            pathInContainer = path.substring(slashPos)
        }

        return [this.getContainerByName(containerName), pathInContainer]
    }

    getContainerByName(containerName: string): DockerContainer{
        if (this.containers[containerName]){
            return this.containers[containerName]
        }

        return this.containers[containerName] = new DockerContainer({name: containerName, manager: this})
    }

    unregister(containerName: string){
        this.containers[containerName] = null
    }

}

export const dockerContainerManager = new DockerContainerManager()

/**
 * 生成临时文件名字
 */
function generateTempFileName() : string {
    return tmp.tmpNameSync()
}

//  Size: 12              Blocks: 1          IO Block: 65536  regular file Size:
// 0               Blocks: 28         IO Block: 65536  directory
const RE_sizeBlockIoBlock = /Size: (\S+)\s+Blocks: (\S+)\s+IO Block: (\S+) (.+)$/

// Device: ca127331h/3390206769d   Inode: 562949954291784  Links: 1
const RE_deviceInodeLinks = /Device: (\S+)\s+Inode: (\S+)\s+Links: (\S+)/

// Access: (0755/drwxr-xr-x)  Uid: (197616/clarence)   Gid: (197121/    None)
// Access: (0644/-rw-r--r--)  Uid: (197616/clarence)   Gid: (197121/    None)
const RE_accessUidGid = /Access:\s+\(\s*(\d+)\s*\/\S+\)\s+Uid:\s+\(\s*(\d+)\s*\/.+\)\s+Gid:\s+\(\s*(\d+)\s*\/.+\)/

// Access: 2017-04-12 10:07:53.931248500 +0000
const RE_accessTime = /Access:\s+\d{4}-\d{2}/

// Modify: 2017-04-12 10:07:53.931248500 +0000
const RE_modifyTime = /Modify:\s+\d{4}-\d{2}/

// Change: 2017-04-12 10:07:53.931248500 +0000
const RE_changeTime = /Change:\s+\d{4}-\d{2}/

//  Birth: 2016-09-06 00:54:40.717559800 +0000
const RE_birthTime = /Birth:\s+\d{4}-\d{2}/

export function parseShellStatOutputToFsStats(shellStatOutput : string) : fs.Stats {
    let lines = shellStatOutput.split("\n").map(line => line.trim())

    let stat: fs.Stats = {
        isFile: () => false,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        dev: 0,
        ino: 0,
        mode: 0,
        nlink: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        size: 0,
        blksize: 0,
        blocks: 0,
        atime: null,
        mtime: null,
        ctime: null,
        birthtime: null
    }

    for (let line of lines) {
        let matches
        if (matches = line.match(RE_sizeBlockIoBlock)) {
            stat.size = +matches[1] || 0
            stat.blocks = +matches[2] || 0
            stat.blksize = +matches[3] || 0

            let fileType = matches[4].trim()
            stat.isFile = () => /file/.test(fileType)
            stat.isDirectory = () => fileType === 'directory'
            continue
        }

        if (matches = line.match(RE_deviceInodeLinks)) {
            stat.dev = +matches[1] || 0
            stat.ino = +matches[2] || 0
            stat.nlink = +matches[3] || 0
            continue
        }

        if (matches = line.match(RE_accessUidGid)) {
            stat.mode = parseInt(matches[1], 8) || 0
            stat.uid = +matches[2] || 0
            stat.gid = +matches[3] || 0
            continue
        }

        if ((matches = line.match(RE_accessTime))) {
            stat.atime = new Date(line.replace('Access:', '').trim())
            continue
        }

        if ((matches = line.match(RE_modifyTime))) {
            stat.mtime = new Date(line.replace('Modify:', '').trim())
            continue
        }

        if ((matches = line.match(RE_changeTime))) {
            stat.ctime = new Date(line.replace('Change:', '').trim())
            continue
        }

        if ((matches = line.match(RE_birthTime))) {
            stat.birthtime = new Date(line.replace('Birth:', '').trim())
            continue
        }
    }

    // Make invalid time field be null    
    ~['atime', 'mtime', 'ctime', 'birthtime'].forEach(field => {
        if (stat[field] && !+ stat[field]) {
            stat[field] = null
        }
    });

    return stat
}

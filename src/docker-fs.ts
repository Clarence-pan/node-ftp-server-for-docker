import * as fs from 'fs'
import * as cb2p from 'cb2p'
import * as path from 'path'
import * as tmp from 'tmp'
import Cache from './cache'
import {shellExec, ShellExecOptions, ShellExecResult, shellEscape} from './shell'
import * as stream from 'stream'

const debug = require('debug')('docker-fs:debug')
const warn  = require('debug')('docker-fs:warn')
const child_proces = require('child_process')
const writeFileAsync = cb2p(fs.writeFile.bind(fs))

export class DockerFsError extends Error{
    code: string|number

    constructor(msg: string, code: string|number){
        super(msg)
        this.code = code
    }
}

export class FsStats implements fs.Stats{
        dev = 0
        ino = 0
        mode = 0
        nlink = 0
        uid = 0
        gid = 0
        rdev = 0
        size = 0
        blksize = 0
        blocks = 0
        atime: Date|null = null
        mtime: Date|null = null
        ctime: Date|null = null
        birthtime: Date|null = null
        file: string = ''
        fileType: string = ''

        static FILE_TYPE_FILE = 'file'
        static FILE_TYPE_DIRECTORY = 'directory'
        static FILE_TYPE_SYM_LINK = 'symbolic link'

        isFile(): boolean{
            return /file/.test(this.fileType)
        }

        isDirectory(): boolean{
            return this.fileType === FsStats.FILE_TYPE_DIRECTORY
        }

        isBlockDevice(): boolean{
            return false
        }

        isCharacterDevice(): boolean{
            return false
        }

        isSymbolicLink(): boolean{
            return this.fileType === FsStats.FILE_TYPE_SYM_LINK
        }

        isFIFO(): boolean{
            return false
        }

        isSocket(): boolean{
            return false
        }

        static create(init: (obj: FsStats) => any): FsStats{
            let stats = new FsStats()
            init(stats)
            return stats
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
        callback(null, FsStats.create(stat => {
            stat.fileType = FsStats.FILE_TYPE_DIRECTORY
            stat.atime = stat.mtime = stat.ctime = stat.birthtime = new Date('1970-01-01')
        }))
        return
    }
    
    ~(async function () {
        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)
        if (isRoot(pathInContainer)){
            callback(null, FsStats.create(stat => {
                stat.fileType = FsStats.FILE_TYPE_DIRECTORY
                stat.atime = stat.mtime = stat.ctime = stat.birthtime = new Date('1970-01-01')
            }))
            return
        }

        // 2. 通过sh运行 stat
        let stats = await container.readFileStat(pathInContainer)

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

        // 刷新文件状态
        container.readFileStat(pathInContainer, {refresh: true})

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

        // 刷新文件状态
        container.readFileStat(pathInContainer, {refresh: true})

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
        .on('finish', function () {
            // todo: 失败了怎么办？
            container
                .upload(localFile, pathInContainer)
                .then(() => {                    
                    // 刷新文件状态
                    container.readFileStat(pathInContainer, {refresh: true})
                })
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

        // 刷新文件状态
        container.readFileStat(pathInContainer, {refresh: true})

        callback(null)
    })().catch(err => callback(err as Error))
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

        // 刷新文件状态
        container.readFileStat(pathInContainer, {refresh: true})

        callback(null)
    })().catch(err => callback(err as Error))
}

/**
 * Asynchronous rename.
 * @param oldPath
 * @param newPath
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */

export function rename(oldPath : string, newPath : string, callback?: (err?: NodeJS.ErrnoException) => void) {
    debug('rename', {oldPath, newPath})

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

        // 刷新文件状态
        container1.readFileStat(oldPathInContainer, {refresh: true})
        if (path.dirname(newPathInContainer) !== path.dirname(oldPathInContainer)){
            container1.readFileStat(newPathInContainer, {refresh: true})
        }

        callback(null)
    })().catch(err => callback(err as Error))
}

export function readdir(path : string | Buffer, callback?: (err : NodeJS.ErrnoException, files : string[]) => void) : void {
    debug('readdir', {path})
    
    ~(async function () {
        if (isRoot(path)){
            let res = await dockerContainerManager.listAllContainers()
            callback(null, res)
            return
        }

        // 1. 转换路径
        let [container, pathInContainer] = dockerContainerManager.parseDockerFsPath(path)

        // 2. 执行shell删除目录
        let res = await container.shellExec(['ls', '-1', '--color=none', pathInContainer])

        container.readFilesStatsInDir(pathInContainer, {timeout: 3000})

        callback(null, splitIntoLines(res.stdout))
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
    _dirStatCache: Cache<Promise<{[path:string]: fs.Stats}>>
    _execCache: Cache<ShellExecResult | Promise<ShellExecResult>>

    constructor(options: {name: string, manager: DockerContainerManager}){
        this.name = options.name
        this.manager = options.manager
        this._dirStatCache = new Cache<Promise<{[path:string]: fs.Stats}>>()
        this._execCache = new Cache<ShellExecResult | Promise<ShellExecResult>>()
    }

    async shellExec(cmd : string | string[]) : Promise < ShellExecResult > {
        // todo... 注意使用export LANG=en
        // 使用 < /dev/null 可以让程序忽略输入，禁止交互
        
        let finalCmd = typeof cmd === 'string' ? cmd : cmd.map(x => shellEscape(x)).join(' ')

        debug("[DockerContainer.ShellExec] %s", cmd)

        // 新建shell会比较快
        // let shell = await this._initShell()
        // return this._execInShell(shell, finalCmd)

        // 但是我们先测下每次都重建shell
        return shellExec([this.manager.dockerExecPath, 'exec', this.name].concat(cmd))

    }

    async shellExecCached(cmd: string | string[], options?: {timeout?: number, refresh?: boolean}): Promise<ShellExecResult>{
        options = {timeout: 3000, refresh: false, ...(options || {})}

        let cacheKey = Array.isArray(cmd) ? cmd.join(' ') : cmd

        if (!options.refresh){
            let cachedResult = this._execCache.get(cacheKey)
            if (cachedResult){
                return cachedResult
            }
        }

        let result = this.shellExec(cmd)
        this._execCache.set(cacheKey, result, options.timeout)

        return result
    }

    async readFilesStatsInDir(dir, options?: {timeout?: number, refresh?: boolean}): Promise<{[path:string]: fs.Stats}>{
        options = {timeout: 3000, refresh: false, ...(options || {})}

        let cacheKey = dir
        if (!options.refresh){
            let cachedResult = this._dirStatCache.get(cacheKey)
            if (cachedResult){
                return cachedResult
            }
        }

        
        let statCmd = `stat --printf='${STAT_MULTI_FORMAT}' ` + `'${dir}/'*`.replace(/^'\/+/, "'/")
        let result = this.shellExecCached(['sh', '-c', statCmd ], options)
                         .then(shExecStatResult => parseMultiFileStatsFromShellOutput(shExecStatResult.stdout))

        this._dirStatCache.set(cacheKey, result, options.timeout)

        return result
    }

    async readFileStat(file, options?: {timeout?: number, refresh?: boolean}): Promise<fs.Stats>{
        let baseDir = path.dirname(file).replace(/\\/g, '/')
        let filesStatsInBaseDir = await this.readFilesStatsInDir(baseDir, options)
        if (!filesStatsInBaseDir[file]){
            warn("Cannot find stat of " + file)
            return new FsStats()
        }

        return filesStatsInBaseDir[file]
    }

    async download(containerFilePath, localFilePath) {
        return shellExec([this.manager.dockerExecPath, 'cp', `${this.name}:${containerFilePath}`, localFilePath])
    }

    async upload(localFilePath, containerFilePath) {
        return shellExec([this.manager.dockerExecPath, 'cp', localFilePath, `${this.name}:${containerFilePath}`])
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
    _containers: {[name:string]: DockerContainer} = {}
    dockerExecPath: string = 'docker'

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
        if (this._containers[containerName]){
            return this._containers[containerName]
        }

        return this._containers[containerName] = new DockerContainer({name: containerName, manager: this})
    }

    unregister(containerName: string){
        this._containers[containerName] = null
    }

    async listAllContainers(){
        let res = await shellExec([this.dockerExecPath, 'ps', '--format', '{{.Names}}'])
        return splitIntoLines(res.stdout)
    }
}

export const dockerContainerManager = new DockerContainerManager()

/**
 * The directory for all temporary files.
 */
let TempDirName = null

/**
 * 生成临时文件名字
 */
function generateTempFileName() : string {
    if (!TempDirName){
        let tmpDir = tmp.dirSync({prefix: 'docker-fs-'})
        TempDirName = tmpDir.name
    }

    return tmp.tmpNameSync({dir: TempDirName})
}


type StatTextLine = {
    text: string
}

type StatFieldLine = {
    field: string,
    format: string,
    sanitize?: (val: string) => number|string|null|Date
}

const sanitizeStatNumber = (val: string) => +val || 0;
const sanitizeStatTime = (val: string) => ((t: Date) => t || null)(new Date(val));

/**
 * stat 的 --format 参数的定义
 */
const STAT_MULTI_FORMAT_LINES_DEFINETIONS: Array<StatTextLine|StatFieldLine> = [
    {
        text: '======',
    },
    {
        field: 'file',
        format: '%n',
    },
    {
        field: 'fileType',
        format: '%F',
    },
    {
        field: 'atime',
        format: '%x',
        sanitize: sanitizeStatTime,
    },
    {
        field: 'mtime',
        format: '%y',
        sanitize: sanitizeStatTime,
    },
    {
        field: 'ctime',
        format: '%z',
        sanitize: sanitizeStatTime,
    },
    {
        field: 'size',
        format: '%s',
        sanitize: sanitizeStatNumber,
    },
    {
        field: 'blocks',
        format: '%b',
        sanitize: sanitizeStatNumber,
    },
    {
        field: 'blksize',
        format: '%B',
        sanitize: sanitizeStatNumber,
    },
    {
        field: 'mode',
        format: '%a',
        sanitize: (val: string) => parseInt(val, 8) || 0,
    },
    {
        field: 'nlink',
        format: '%h',
        sanitize: sanitizeStatNumber,
    },
];

/**
 * stat 的 --format 参数的 field => def 的映射
 */
const STAT_MULTI_FORMAT_LINES_DEFINETIONS_MAP: {[field:string]:StatTextLine|StatFieldLine} = STAT_MULTI_FORMAT_LINES_DEFINETIONS.reduce<any>(
    (preValue, value) => {
        preValue[value['field']] = value
        return preValue
    },
    {}
);

/**
 * stat 的 --format 参数
 */
const STAT_MULTI_FORMAT = STAT_MULTI_FORMAT_LINES_DEFINETIONS.map(x => {
    if ('text' in x){
        return (x as StatTextLine).text
    }

    x = x as StatFieldLine

    return x.field + ':' + x.format
}).join("\\n") + "\\n";

/**
 * 从shell输出中解析出多个文件的状态
 */
function parseMultiFileStatsFromShellOutput(output: string): {[file:string]: fs.Stats}{
    let fragments = output.split(STAT_MULTI_FORMAT_LINES_DEFINETIONS[0]['text'])
    if (!fragments){
        return {}
    }

    let result: {[file:string]: fs.Stats} = {}

    fragments.forEach(fragment => {
        let stat = new FsStats()
        let lines = splitIntoLines(fragment)
        for (let line of lines){
            let mpos = line.indexOf(':')
            if (mpos <= 0){
                continue;
            }

            let field = line.substring(0, mpos).trim()
            let value = line.substring(mpos + 1).trim()
            let fieldDef = STAT_MULTI_FORMAT_LINES_DEFINETIONS_MAP[field]
            if (fieldDef && 'field' in fieldDef){
                fieldDef = fieldDef as StatFieldLine
                stat[field] = fieldDef.sanitize ? fieldDef.sanitize(value) : value
            }
        }

        if (stat.file) {
            result[stat.file] = stat
        }
    })

    return result
}

/**
 * 将一段文本拆成单行的数组，空白行将被忽略
 */
function splitIntoLines(content: string): string[]{
    return content.split("\n").map(x => x.trim()).filter(x => !!x)
}

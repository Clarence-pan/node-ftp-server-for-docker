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
const fs = require("fs");
const cb2p = require("cb2p");
const path = require("path");
const tmp = require("tmp");
const cache_1 = require("./cache");
const shell_1 = require("./shell");
const stream = require("stream");
const debug = require('debug')('docker-fs');
const child_proces = require('child_process');
const writeFileAsync = cb2p(fs.writeFile.bind(fs));
class DockerFsError extends Error {
    constructor(msg, code) {
        super(msg);
        this.code = code;
    }
}
exports.DockerFsError = DockerFsError;
class FsStats {
    constructor() {
        this.dev = 0;
        this.ino = 0;
        this.mode = 0;
        this.nlink = 0;
        this.uid = 0;
        this.gid = 0;
        this.rdev = 0;
        this.size = 0;
        this.blksize = 0;
        this.blocks = 0;
        this.atime = null;
        this.mtime = null;
        this.ctime = null;
        this.birthtime = null;
        this.file = '';
        this.fileType = '';
    }
    isFile() {
        return /file/.test(this.fileType);
    }
    isDirectory() {
        return this.fileType === FsStats.FILE_TYPE_DIRECTORY;
    }
    isBlockDevice() {
        return false;
    }
    isCharacterDevice() {
        return false;
    }
    isSymbolicLink() {
        return this.fileType === FsStats.FILE_TYPE_SYM_LINK;
    }
    isFIFO() {
        return false;
    }
    isSocket() {
        return false;
    }
    static create(init) {
        let stats = new FsStats();
        init(stats);
        return stats;
    }
}
FsStats.FILE_TYPE_FILE = 'file';
FsStats.FILE_TYPE_DIRECTORY = 'directory';
FsStats.FILE_TYPE_SYM_LINK = 'symbolic link';
exports.FsStats = FsStats;
/**
 * Asynchronous stat - get the file stats of {path}
 *
 * @param path
 * @param callback
 */
function stat(path, callback) {
    debug('stat ', path);
    if (isRoot(path)) {
        callback(null, FsStats.create(stat => {
            stat.fileType = FsStats.FILE_TYPE_DIRECTORY;
            stat.atime = stat.mtime = stat.ctime = stat.birthtime = new Date('1970-01-01');
        }));
        return;
    }
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
            if (isRoot(pathInContainer)) {
                callback(null, FsStats.create(stat => {
                    stat.fileType = FsStats.FILE_TYPE_DIRECTORY;
                    stat.atime = stat.mtime = stat.ctime = stat.birthtime = new Date('1970-01-01');
                }));
                return;
            }
            // 2. 通过sh运行 stat
            let stats = yield container.readFileStat(pathInContainer);
            callback(null, stats);
        });
    })().catch(err => callback(err, null));
}
exports.stat = stat;
/**
 * Asynchronous unlink - deletes the file specified in {path}
 *
 * @param path
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
function unlink(path, callback) {
    debug('unlink ', path);
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
            if (pathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 通过sh运行 rm
            let res = yield container.shellExec(['rm', '-f', pathInContainer]);
            callback(null);
        });
    })().catch(err => callback(err));
}
exports.unlink = unlink;
/**
 * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
 *
 * @param path
 * @param mode
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
function mkdir(path, mode, callback) {
    debug('mkdir ', { path, mode });
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
            if (pathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 通过sh运行 mkdir
            let res = yield container.shellExec(['mkdir', pathInContainer]);
            callback(null);
        });
    })().catch(err => callback(err));
}
exports.mkdir = mkdir;
function open(path, flags, callback) {
    debug('open ', { path, flags });
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (flags !== 'r') {
                // todo: how to support write?
                callback(new Error("dockerFs.open(): only 'r'(read) is allowed."), 0);
                return;
            }
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
            if (pathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 通过 docker cp 把文件拷贝到本地，然后打开
            let localFile = generateTempFileName();
            yield container.download(pathInContainer, localFile);
            fs.open(localFile, flags, function (err, fd) {
                callback(err, fd);
            });
        });
    })().catch(err => callback(err, 0));
    return fs.open(path, flags, callback);
}
exports.open = open;
class DockerFsReadStream extends stream.Readable {
    constructor(init) {
        super();
        init(function (err, innerStream) {
            if (err) {
                this.emit('error', err);
                this.push(null);
                return;
            }
            this.innerStream = innerStream;
            innerStream.on('data', (data) => {
                this.push(data);
            });
            innerStream.on('end', () => {
                this.push(null);
            });
            innerStream.on('error', err => {
                this.emit('error', err);
            });
        });
    }
    close() {
        if (this.innerStream) {
            this.innerStream.close();
        }
    }
    destroy() {
        if (this.innerStream) {
            this.innerStream.destroy();
        }
    }
}
exports.DockerFsReadStream = DockerFsReadStream;
function createReadStream(path, options) {
    debug('createReadStream ', { path, options });
    if (path) {
        let resultStream = new DockerFsReadStream(function (cb) {
            open(path, 'r', function (err, fd) {
                if (err) {
                    cb(err, null);
                }
                else {
                    cb(null, fs.createReadStream(null, Object.assign({ fd: fd }, options)));
                }
            });
        });
        resultStream.path = path;
        return resultStream;
    }
    if (!options || !options.fd) {
        throw new Error("Invalid options! You must specify a `fd`.");
    }
    return fs.createReadStream(path, options);
}
exports.createReadStream = createReadStream;
function createWriteStream(path, options) {
    debug('createWriteStream', { path, options });
    // 1. 转换路径
    let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
    if (pathInContainer === '/') {
        throw new DockerFsError('Permition denied.', 'EDENIED');
    }
    // 2. 创建临时文件，先写入临时文件
    let localFile = generateTempFileName();
    let localFileStream = fs.createWriteStream(localFile, options);
    // 3. 写入完成后，通过 docker copy 把文件上传到容器内
    localFileStream
        .on('end', function () {
        // todo: 失败了怎么办？
        container
            .upload(localFile, pathInContainer)
            .catch(err => {
            localFileStream.emit('error', err);
        });
    });
    return localFileStream;
}
exports.createWriteStream = createWriteStream;
function readFile(filename, callback) {
    debug('readFile', { filename });
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(filename);
            if (pathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 通过 docker cp 把文件拷贝到本地，然后打开
            let localFile = generateTempFileName();
            yield container.download(pathInContainer, localFile);
            fs.readFile(localFile, callback);
        });
    })().catch(err => callback(err, null));
    // return fs.readFile(filename, callback)
}
exports.readFile = readFile;
function writeFile(filename, data, options, callback) {
    debug('writeFile', { filename, options, data });
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(filename);
            if (pathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 先写入临时文件
            let localFile = generateTempFileName();
            yield writeFileAsync(localFile, data, options);
            // 3. 然后上传到容器内
            yield container.upload(localFile, pathInContainer);
            callback(null);
        });
    })().catch(err => callback(err));
    // return fs.writeFile(filename, data, options, callback)
}
exports.writeFile = writeFile;
/**
 * Asynchronous rmdir - removes the directory specified in {path}
 *
 * @param path
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
function rmdir(path, callback) {
    debug('rmdir', { path });
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
            if (pathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 执行shell删除目录
            yield container.shellExec(['rmdir', pathInContainer]);
            callback(null);
        });
    })().catch(err => callback(err));
    // return fs.rmdir(path, callback)
}
exports.rmdir = rmdir;
/**
 * Asynchronous rename.
 * @param oldPath
 * @param newPath
 * @param callback No arguments other than a possible exception are given to the completion callback.
 */
function rename(oldPath, newPath, callback) {
    debug('rename', { oldPath, newPath });
    // return fs.rename(oldPath, newPath, callback)
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. 转换路径
            let [container1, oldPathInContainer] = exports.dockerContainerManager.parseDockerFsPath(oldPath);
            let [container2, newPathInContainer] = exports.dockerContainerManager.parseDockerFsPath(newPath);
            if (container1 !== container2) {
                throw new Error("move file across container is not supported yet!");
            }
            if (oldPathInContainer === '/' || newPathInContainer === '/') {
                throw new DockerFsError('Permition denied.', 'EDENIED');
            }
            // 2. 执行shell删除目录
            yield container1.shellExec(['mv', oldPathInContainer, newPathInContainer]);
            callback(null);
        });
    })().catch(err => callback(err));
}
exports.rename = rename;
function readdir(path, callback) {
    debug('readdir', { path });
    // return fs.readdir(path, callback)
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (isRoot(path)) {
                let res = yield shell_1.shellExec(['docker', 'ps', '--format', '{{.Names}}']);
                callback(null, splitIntoLines(res.stdout));
                return;
            }
            // 1. 转换路径
            let [container, pathInContainer] = exports.dockerContainerManager.parseDockerFsPath(path);
            // 2. 执行shell删除目录
            let res = yield container.shellExec(['ls', '-1', '--color=none', pathInContainer]);
            container.readFilesStatsInDir(pathInContainer, { timeout: 3000 });
            callback(null, splitIntoLines(res.stdout));
        });
    })().catch(err => callback(err, []));
}
exports.readdir = readdir;
function isRoot(path) {
    if (path instanceof Buffer) {
        path = path.toString();
    }
    return path === '/' || path === '\\';
}
exports.isRoot = isRoot;
class DockerContainer {
    constructor(options) {
        this.name = options.name;
        this.manager = options.manager;
        this._dirStatCache = new cache_1.default();
        this._execCache = new cache_1.default();
    }
    shellExec(cmd) {
        return __awaiter(this, void 0, void 0, function* () {
            // todo... 注意使用export LANG=en
            // 使用 < /dev/null 可以让程序忽略输入，禁止交互
            let finalCmd = typeof cmd === 'string' ? cmd : cmd.map(x => shell_1.shellEscape(x)).join(' ');
            debug("[DockerContainer.ShellExec] " + cmd);
            // 新建shell会比较快
            // let shell = await this._initShell()
            // return this._execInShell(shell, finalCmd)
            // 但是我们先测下每次都重建shell
            return shell_1.shellExec(['docker', 'exec', this.name].concat(cmd));
        });
    }
    shellExecCached(cmd, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let cacheKey = Array.isArray(cmd) ? cmd.join(' ') : cmd;
            let cachedResult = this._execCache.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
            options = Object.assign({ timeout: 3000 }, (options || {}));
            let result = this.shellExec(cmd);
            this._execCache.set(cacheKey, result, options.timeout);
            return result;
        });
    }
    readFilesStatsInDir(dir, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let cacheKey = dir;
            let cachedResult = this._dirStatCache.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
            options = Object.assign({ timeout: 3000 }, (options || {}));
            let statCmd = 'stat ' + (dir + '/*').replace(/(^\/+)/, '/');
            let result = this.shellExecCached(['sh', '-c', statCmd], options)
                .then(shExecStatResult => parseMultiFileStatsFromShellOutput(shExecStatResult.stdout));
            this._dirStatCache.set(cacheKey, result, options.timeout);
            return result;
        });
    }
    readFileStat(file, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let baseDir = path.dirname(file).replace(/\\/g, '/');
            let filesStatsInBaseDir = yield this.readFilesStatsInDir(baseDir, options);
            if (!filesStatsInBaseDir[file]) {
                throw new DockerFsError(`File ${file} not found in ${baseDir}!`, 'ENOET');
            }
            return filesStatsInBaseDir[file];
        });
    }
    download(containerFilePath, localFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return shell_1.shellExec(['docker', 'cp', `${this.name}:${containerFilePath}`, localFilePath]);
        });
    }
    upload(localFilePath, containerFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return shell_1.shellExec(['docker', 'cp', localFilePath, `${this.name}:${containerFilePath}`]);
        });
    }
    dispose() {
        return __awaiter(this, void 0, void 0, function* () {
            this.manager.unregister(this.name);
        });
    }
    _initShell() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("todo...");
        });
    }
    _execInShell(shell, cmd) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("todo...");
        });
    }
}
exports.DockerContainer = DockerContainer;
/**
 * docker容器的管理器
 */
class DockerContainerManager {
    constructor() {
        this.containers = {};
    }
    parseDockerFsPath(path) {
        if (path instanceof Buffer) {
            path = path.toString('utf8');
        }
        path = path.replace(/\\/g, '/');
        if (path[0] != '/') {
            throw new Error("Invalid docker-fs path! The path must start with a `/`!");
        }
        let containerName, pathInContainer;
        let slashPos = path.indexOf('/', 1);
        if (slashPos <= 0) {
            containerName = path.substring(1);
            pathInContainer = '/';
        }
        else {
            containerName = path.substring(1, slashPos);
            pathInContainer = path.substring(slashPos);
        }
        return [this.getContainerByName(containerName), pathInContainer];
    }
    getContainerByName(containerName) {
        if (this.containers[containerName]) {
            return this.containers[containerName];
        }
        return this.containers[containerName] = new DockerContainer({ name: containerName, manager: this });
    }
    unregister(containerName) {
        this.containers[containerName] = null;
    }
}
exports.DockerContainerManager = DockerContainerManager;
exports.dockerContainerManager = new DockerContainerManager();
/**
 * The directory for all temporary files.
 */
let TempDirName = null;
/**
 * 生成临时文件名字
 */
function generateTempFileName() {
    if (!TempDirName) {
        let tmpDir = tmp.dirSync({ prefix: 'docker-fs-' });
        TempDirName = tmpDir.name;
    }
    return tmp.tmpNameSync({ dir: TempDirName });
}
//   File: '/etc/timezone'
//   File: '/entrypoint.sh' -> 'usr/local/bin/docker-entrypoint.sh'
const RE_file = /File: '(.+?)'/;
//  Size: 12              Blocks: 1          IO Block: 65536  regular file Size:
// 0               Blocks: 28         IO Block: 65536  directory
const RE_sizeBlockIoBlock = /Size: (\S+)\s+Blocks: (\S+)\s+IO Block: (\S+) (.+)$/;
// Device: ca127331h/3390206769d   Inode: 562949954291784  Links: 1
const RE_deviceInodeLinks = /Device: (\S+)\s+Inode: (\S+)\s+Links: (\S+)/;
// Access: (0755/drwxr-xr-x)  Uid: (197616/clarence)   Gid: (197121/    None)
// Access: (0644/-rw-r--r--)  Uid: (197616/clarence)   Gid: (197121/    None)
const RE_accessUidGid = /Access:\s+\(\s*(\d+)\s*\/\S+\)\s+Uid:\s+\(\s*(\d+)\s*\/.+\)\s+Gid:\s+\(\s*(\d+)\s*\/.+\)/;
// Access: 2017-04-12 10:07:53.931248500 +0000
const RE_accessTime = /Access:\s+\d{4}-\d{2}/;
// Modify: 2017-04-12 10:07:53.931248500 +0000
const RE_modifyTime = /Modify:\s+\d{4}-\d{2}/;
// Change: 2017-04-12 10:07:53.931248500 +0000
const RE_changeTime = /Change:\s+\d{4}-\d{2}/;
//  Birth: 2016-09-06 00:54:40.717559800 +0000
const RE_birthTime = /Birth:\s+\d{4}-\d{2}/;
class ParsedFsStats extends FsStats {
    constructor() {
        super(...arguments);
        this._beginLineNo = 0; // 从几行开始的（含）
        this._endLineNo = 0; // 到几行结束的（不含）
    }
}
/**
 * 从单个stat的输出中解析出文件的状态(stat)
 */
function parseShellStatOutputToFsStats(shellStatOutput, beginLineNo = 0) {
    let lines = typeof shellStatOutput === 'string' ? splitIntoLines(shellStatOutput) : shellStatOutput;
    let stat = new ParsedFsStats();
    stat._beginLineNo = beginLineNo;
    for (let lineNo = beginLineNo, linesNum = lines.length; lineNo < linesNum; lineNo++) {
        let line = lines[lineNo];
        let matches;
        if (matches = line.match(RE_file)) {
            if (stat.file) {
                stat._endLineNo = lineNo;
                return stat;
            }
            stat.file = matches[1];
            continue;
        }
        if (matches = line.match(RE_sizeBlockIoBlock)) {
            stat.size = +matches[1] || 0;
            stat.blocks = +matches[2] || 0;
            stat.blksize = +matches[3] || 0;
            stat.fileType = matches[4].trim();
            continue;
        }
        if (matches = line.match(RE_deviceInodeLinks)) {
            stat.dev = +matches[1] || 0;
            stat.ino = +matches[2] || 0;
            stat.nlink = +matches[3] || 0;
            continue;
        }
        if (matches = line.match(RE_accessUidGid)) {
            stat.mode = parseInt(matches[1], 8) || 0;
            stat.uid = +matches[2] || 0;
            stat.gid = +matches[3] || 0;
            continue;
        }
        if ((matches = line.match(RE_accessTime))) {
            stat.atime = new Date(line.replace('Access:', '').trim());
            continue;
        }
        if ((matches = line.match(RE_modifyTime))) {
            stat.mtime = new Date(line.replace('Modify:', '').trim());
            continue;
        }
        if ((matches = line.match(RE_changeTime))) {
            stat.ctime = new Date(line.replace('Change:', '').trim());
            continue;
        }
        if ((matches = line.match(RE_birthTime))) {
            stat.birthtime = new Date(line.replace('Birth:', '').trim());
            continue;
        }
    }
    // Make invalid time field be null    
    ~['atime', 'mtime', 'ctime', 'birthtime'].forEach(field => {
        if (stat[field] && !+stat[field]) {
            stat[field] = null;
        }
    });
    stat._endLineNo = lines.length;
    return stat;
}
exports.parseShellStatOutputToFsStats = parseShellStatOutputToFsStats;
/**
 * 从shell输出中解析多个文件的状态(stat)
 */
function parseMultiFileStatsFromShellOutput(output) {
    let lines = typeof output === 'string' ? splitIntoLines(output) : output;
    let result = {};
    let stat;
    let nextLineNo = 0;
    do {
        stat = parseShellStatOutputToFsStats(output, nextLineNo);
        if (!(stat instanceof ParsedFsStats)) {
            throw new DockerFsError("Invalid parsed fs.Stats!", "ERROR");
        }
        nextLineNo = stat._endLineNo;
        result[stat.file] = stat;
    } while (stat._endLineNo < lines.length);
    return result;
}
exports.parseMultiFileStatsFromShellOutput = parseMultiFileStatsFromShellOutput;
/**
 * 将一段文本拆成单行的数组，空白行将被忽略
 */
function splitIntoLines(content) {
    return content.split("\n").map(x => x.trim()).filter(x => !!x);
}

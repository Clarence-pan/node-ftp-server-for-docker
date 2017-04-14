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
const debug = require('debug')('docker-fs:debug');
const warn = require('debug')('docker-fs:warn');
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
            // 刷新文件状态
            container.readFileStat(pathInContainer, { refresh: true });
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
            // 刷新文件状态
            container.readFileStat(pathInContainer, { refresh: true });
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
        .on('finish', function () {
        // todo: 失败了怎么办？
        container
            .upload(localFile, pathInContainer)
            .then(() => {
            // 刷新文件状态
            container.readFileStat(pathInContainer, { refresh: true });
        })
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
            // 刷新文件状态
            container.readFileStat(pathInContainer, { refresh: true });
            callback(null);
        });
    })().catch(err => callback(err));
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
            // 刷新文件状态
            container.readFileStat(pathInContainer, { refresh: true });
            callback(null);
        });
    })().catch(err => callback(err));
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
            // 刷新文件状态
            container1.readFileStat(oldPathInContainer, { refresh: true });
            if (path.dirname(newPathInContainer) !== path.dirname(oldPathInContainer)) {
                container1.readFileStat(newPathInContainer, { refresh: true });
            }
            callback(null);
        });
    })().catch(err => callback(err));
}
exports.rename = rename;
function readdir(path, callback) {
    debug('readdir', { path });
    ~(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (isRoot(path)) {
                let res = yield exports.dockerContainerManager.listAllContainers();
                callback(null, res);
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
            debug("[DockerContainer.ShellExec] %s", cmd);
            // 新建shell会比较快
            // let shell = await this._initShell()
            // return this._execInShell(shell, finalCmd)
            // 但是我们先测下每次都重建shell
            return shell_1.shellExec([this.manager.dockerExecPath, 'exec', this.name].concat(cmd));
        });
    }
    shellExecCached(cmd, options) {
        return __awaiter(this, void 0, void 0, function* () {
            options = Object.assign({ timeout: 3000, refresh: false }, (options || {}));
            let cacheKey = Array.isArray(cmd) ? cmd.join(' ') : cmd;
            if (!options.refresh) {
                let cachedResult = this._execCache.get(cacheKey);
                if (cachedResult) {
                    return cachedResult;
                }
            }
            let result = this.shellExec(cmd);
            this._execCache.set(cacheKey, result, options.timeout);
            return result;
        });
    }
    readFilesStatsInDir(dir, options) {
        return __awaiter(this, void 0, void 0, function* () {
            options = Object.assign({ timeout: 3000, refresh: false }, (options || {}));
            let cacheKey = dir;
            if (!options.refresh) {
                let cachedResult = this._dirStatCache.get(cacheKey);
                if (cachedResult) {
                    return cachedResult;
                }
            }
            let statCmd = `stat --printf='${STAT_MULTI_FORMAT}' ` + `'${dir}/'*`.replace(/^'\/+/, "'/");
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
                warn("Cannot find stat of " + file);
                return new FsStats();
            }
            return filesStatsInBaseDir[file];
        });
    }
    download(containerFilePath, localFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return shell_1.shellExec([this.manager.dockerExecPath, 'cp', `${this.name}:${containerFilePath}`, localFilePath]);
        });
    }
    upload(localFilePath, containerFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return shell_1.shellExec([this.manager.dockerExecPath, 'cp', localFilePath, `${this.name}:${containerFilePath}`]);
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
        this._containers = {};
        this.dockerExecPath = 'docker';
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
        if (this._containers[containerName]) {
            return this._containers[containerName];
        }
        return this._containers[containerName] = new DockerContainer({ name: containerName, manager: this });
    }
    unregister(containerName) {
        this._containers[containerName] = null;
    }
    listAllContainers() {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield shell_1.shellExec([this.dockerExecPath, 'ps', '--format', '{{.Names}}']);
            return splitIntoLines(res.stdout);
        });
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
const sanitizeStatNumber = (val) => +val || 0;
const sanitizeStatTime = (val) => ((t) => t || null)(new Date(val));
/**
 * stat 的 --format 参数的定义
 */
const STAT_MULTI_FORMAT_LINES_DEFINETIONS = [
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
        sanitize: (val) => parseInt(val, 8) || 0,
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
const STAT_MULTI_FORMAT_LINES_DEFINETIONS_MAP = STAT_MULTI_FORMAT_LINES_DEFINETIONS.reduce((preValue, value) => {
    preValue[value['field']] = value;
    return preValue;
}, {});
/**
 * stat 的 --format 参数
 */
const STAT_MULTI_FORMAT = STAT_MULTI_FORMAT_LINES_DEFINETIONS.map(x => {
    if ('text' in x) {
        return x.text;
    }
    x = x;
    return x.field + ':' + x.format;
}).join("\\n") + "\\n";
/**
 * 从shell输出中解析出多个文件的状态
 */
function parseMultiFileStatsFromShellOutput(output) {
    let fragments = output.split(STAT_MULTI_FORMAT_LINES_DEFINETIONS[0]['text']);
    if (!fragments) {
        return {};
    }
    let result = {};
    fragments.forEach(fragment => {
        let stat = new FsStats();
        let lines = splitIntoLines(fragment);
        for (let line of lines) {
            let mpos = line.indexOf(':');
            if (mpos <= 0) {
                continue;
            }
            let field = line.substring(0, mpos).trim();
            let value = line.substring(mpos + 1).trim();
            let fieldDef = STAT_MULTI_FORMAT_LINES_DEFINETIONS_MAP[field];
            if (fieldDef && 'field' in fieldDef) {
                fieldDef = fieldDef;
                stat[field] = fieldDef.sanitize ? fieldDef.sanitize(value) : value;
            }
        }
        if (stat.file) {
            result[stat.file] = stat;
        }
    });
    return result;
}
/**
 * 将一段文本拆成单行的数组，空白行将被忽略
 */
function splitIntoLines(content) {
    return content.split("\n").map(x => x.trim()).filter(x => !!x);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dockerFs = require("./docker-fs");
const EventEmitter = require("events");
const ftpd = require("ftpd");
const debug = require('debug')('ftp-server');
const extend = Object.assign;
// events: listening, error
class FtpServer extends EventEmitter {
    constructor(options) {
        super();
        this.options = extend({
            rootPath: '/',
            initialCwd: '/',
            users: [],
            allowAnonymous: false,
            dockerExecPath: 'docker',
            host: '127.0.0.1',
            port: 21,
        }, options);
        if (!this.options.users) {
            this.options.users = [];
        }
        if (this.options.allowAnonymous) {
            this.options.users = this.options.users.concat([{
                    name: 'anonymous',
                    password: 'guest',
                }]);
        }
    }
    listen(host, port) {
        if (this.ftpd) {
            throw new Error("Ftp server already started!");
        }
        if (host) {
            this.options.host = host;
        }
        if (port) {
            this.options.port = port;
        }
        this.ftpd = new ftpd.FtpServer(this.options.host, {
            getInitialCwd: () => this.options.initialCwd,
            getRoot: () => this.options.rootPath,
            pasvPortRangeStart: 1025,
            pasvPortRangeEnd: 1050,
            tlsOptions: null,
            allowUnauthorizedTls: true,
            useWriteFile: false,
            useReadFile: false,
            uploadMaxSlurpSize: 7000,
        });
        this.ftpd.on('error', (error) => {
            debug("Ftp Server error: ", error);
            this.emit('error', error);
        });
        this.ftpd.on('client:connected', (connection) => {
            debug('client connected: ' + connection.socket.remoteAddress + ':' + connection.socket.remotePort);
            let prevented = false;
            this.emit('client:connected', {
                connection,
                preventDefault() {
                    prevented = true;
                }
            });
            if (prevented) {
                return;
            }
            let username = null;
            connection.on('command:user', (user, success, fail) => {
                if (user) {
                    username = user;
                    success();
                }
                else {
                    fail();
                }
            });
            connection.on('command:pass', (passwd, success, fail) => {
                if (!this.options.users) {
                    fail();
                    return;
                }
                let found = false;
                for (let u of this.options.users) {
                    if (u.name === username && u.password === passwd) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    fail();
                    return;
                }
                success(username, dockerFs);
            });
        });
        this.ftpd.debugging = 4;
        this.ftpd.listen(this.options.port);
        debug("Listening on port " + this.options.port);
        this.emit('listening', { host: this.options.host, port: this.options.port });
    }
    stop() {
        this.ftpd.server.close();
    }
}
exports.default = FtpServer;

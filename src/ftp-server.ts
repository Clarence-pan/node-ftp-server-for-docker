import * as path from 'path'
import * as net from 'net'
import * as fs from 'fs'
import * as bluebird from 'bluebird'
import AbstractFs from './fs/abstract'

import EventEmitter = require('events')

const debug = require('debug')('ftp-server')

const readFile = bluebird.promisify(fs.readFile)
const writeFile = bluebird.promisify(fs.writeFile)

export type Socket = net.Socket

/**
 * Options for FtpServer
 */
export type FtpServerOptions = {}

export default class FtpServer extends EventEmitter {
    options : FtpServerOptions
    closing : boolean = false

    constructor(options : FtpServerOptions) {
        super()

        this.options = options
    }

    listen(host : string = 'localhost', port : number = 21) {
        // todo...
    }

}

export type FtpServerConnectionOptions = {
    socket: Socket,
    server: FtpServer,
    fs: AbstractFs
}

export class FtpServerConnection {
    socket : Socket
    fs : AbstractFs
    server : FtpServer

    constructor(options : FtpServerConnectionOptions) {
        this.socket = options.socket
        this.fs = options.fs
        this.server = options.server

        let socket = this.socket

        socket.on('connect', () => {
            this.reply(220)
        })

        // TODO： 如果分片不是安装命令来的怎么办？
        socket.on('data', (chunk : Buffer) => {
            if (this.server.closing) {
                this.reply(421)
            }

            // todo: 如果带有双引号的参数怎么办？
            let parts = chunk.toString().trim().split(' ')
            let command = parts[0].toUpperCase()
            let args = parts.slice(1)
            let execCommand = commands[command]
            if (!execCommand){
                this.reply(502)
            } else {
                execCommand.apply(this, args)
            }
        })


    }

    async reply(code : number, message?: string) {
        if (!message) {
            message = messages[code + ''] || 'No information'
        }

        return this.write(code + ' ' + message + "\r\n")
    }

    async write(msg : string | Buffer, encoding?: string) {
        return new Promise((resolve, reject) => {
            let cb = (err : any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            }

            if (typeof msg === 'string') {
                this
                    .socket
                    .write(msg, encoding || 'utf8', cb)
            } else {
                this
                    .socket
                    .write(msg, cb)
            }
        })
    }

    handleError(err : any) {
        this
            .reply(500, this.formatError(err))
            .catch(err => {
                debug("Error when reply 500 to client: " + err)
            })
    }

    formatError(err : any) : string {
        if(typeof err === 'string') {
            return err
        } else if (!err) {
            return 'Unknown error'
        } else if (typeof err === 'object' && err.message && typeof err.message === 'string') {
            return err.message
        } else {
            return err + ''
        }
    }
}

/**
 * Standard messages for status (RFC 959)
 */
export const messages = {
    "200": "Command okay.",
    "500": "Syntax error, command unrecognized.", // This may include errors such as command line too long.
    "501": "Syntax error in parameters or arguments.",
    "202": "Command not implemented, superfluous at this site.",
    "502": "Command not implemented.",
    "503": "Bad sequence of commands.",
    "504": "Command not implemented for that parameter.",
    "110": "Restart marker reply.", // In this case, the text is exact and not left to the particular implementation; it must read: MARK yyyy = mmmm Where yyyy is User-process data stream marker, and mmmm server's equivalent marker (note the spaces between markers and "=").
    "211": "System status, or system help reply.",
    "212": "Directory status.",
    "213": "File status.",
    "214": "Help message.", // On how to use the server or the meaning of a particular non-standard command. This reply is useful only to the human user.
    "215": "NodeFTP server emulator.", // NAME system type. Where NAME is an official system name from the list in the Assigned Numbers document.
    "120": "Service ready in %s minutes.",
    "220": "Service ready for new user.",
    "221": "Service closing control connection.", // Logged out if appropriate.
    "421": "Service not available, closing control connection.", // This may be a reply to any command if the service knows it must shut down.
    "125": "Data connection already open; transfer starting.",
    "225": "Data connection open; no transfer in progress.",
    "425": "Can't open data connection.",
    "226": "Closing data connection.", // Requested file action successful (for example, file transfer or file abort).
    "426": "Connection closed; transfer aborted.",
    "227": "Entering Passive Mode.", // (h1,h2,h3,h4,p1,p2).
    "230": "User logged in, proceed.",
    "530": "Not logged in.",
    "331": "User name okay, need password.",
    "332": "Need account for login.",
    "532": "Need account for storing files.",
    "150": "File status okay; about to open data connection.",
    "250": "Requested file action okay, completed.",
    "257": "\"%s\" created.",
    "350": "Requested file action pending further information.",
    "450": "Requested file action not taken.", // File unavailable (e.g., file busy).
    "550": "Requested action not taken.", // File unavailable (e.g., file not found, no access).
    "451": "Requested action aborted. Local error in processing.",
    "551": "Requested action aborted. Page type unknown.",
    "452": "Requested action not taken.", // Insufficient storage space in system.
    "552": "Requested file action aborted.", // Exceeded storage allocation (for current directory or dataset).
    "553": "Requested action not taken.", // File name not allowed.
}

/**
 * Not supported command:
 * A command which returns 202
 */
const NotSupportedCommand = function () {
    this.reply(202)
}

/**
 * Commands implemented by the FTP server
 */
export const commands = {
    /**
   * Unsupported commands
   * They're specifically listed here as a roadmap, but any unexisting command will reply with 202 Not supported
   */
    "ABOR": NotSupportedCommand, // Abort an active file transfer.
    "ACCT": NotSupportedCommand, // Account information
    "ADAT": NotSupportedCommand, // Authentication/Security Data (RFC 2228)
    "ALLO": NotSupportedCommand, // Allocate sufficient disk space to receive a file.
    "APPE": NotSupportedCommand, // Append.
    "AUTH": NotSupportedCommand, // Authentication/Security Mechanism (RFC 2228)
    "CCC": NotSupportedCommand, // Clear Command Channel (RFC 2228)
    "CONF": NotSupportedCommand, // Confidentiality Protection Command (RFC 697)
    "ENC": NotSupportedCommand, // Privacy Protected Channel (RFC 2228)
    "EPRT": NotSupportedCommand, // Specifies an extended address and port to which the server should connect. (RFC 2428)
    "EPSV": NotSupportedCommand, // Enter extended passive mode. (RFC 2428)
    "HELP": NotSupportedCommand, // Returns usage documentation on a command if specified, else a general help document is returned.
    "LANG": NotSupportedCommand, // Language Negotiation (RFC 2640)
    "LPRT": NotSupportedCommand, // Specifies a long address and port to which the server should connect. (RFC 1639)
    "LPSV": NotSupportedCommand, // Enter long passive mode. (RFC 1639)
    "MDTM": NotSupportedCommand, // Return the last-modified time of a specified file. (RFC 3659)
    "MIC": NotSupportedCommand, // Integrity Protected Command (RFC 2228)
    "MKD": NotSupportedCommand, // Make directory.
    "MLSD": NotSupportedCommand, // Lists the contents of a directory if a directory is named. (RFC 3659)
    "MLST": NotSupportedCommand, // Provides data about exactly the object named on its command line, and no others. (RFC 3659)
    "MODE": NotSupportedCommand, // Sets the transfer mode (Stream, Block, or Compressed).
    "NOOP": NotSupportedCommand, // No operation (dummy packet; used mostly on keepalives).
    "OPTS": NotSupportedCommand, // Select options for a feature. (RFC 2389)
    "REIN": NotSupportedCommand, // Re initializes the connection.
    "STOU": NotSupportedCommand, // Store file uniquely.
    "STRU": NotSupportedCommand, // Set file transfer structure.
    "PBSZ": NotSupportedCommand, // Protection Buffer Size (RFC 2228)
    "SITE": NotSupportedCommand, // Sends site specific commands to remote server.
    "SMNT": NotSupportedCommand, // Mount file structure.
    "RMD": NotSupportedCommand, // Remove a directory.
    "STAT": NotSupportedCommand, //

    /**
   * General info
   */
    "FEAT": function () {
        this.write('211-Extensions supported\r\n')
        // No feature
        this.reply(211, 'End')
    },

    "SYST": function () {
        this.reply(215, 'Node FTP featureless server')
    },

    /**
   * Path commands
   */
    "CDUP": function () {
        // Change to parent directory
        commands
            .CWD
            .call(this, '..')
    },

    "CWD": function (dir) {
        // Change working directory
        this
            .fs
            .chdir(dir)
            .then(() => this.reply(250, 'Directory changed to "' + this.fs.cwd() + '"'))
            .catch(this.handleError)
    },
    "PWD": function () { // Get working directory
        this.reply(257, '"' + this.fs.pwd() + '"')
    },
    "XPWD": function () {
        // Alias to PWD
        commands
            .PWD
            .call(this)
    },
    /**
   * Change data encoding
   */
    "TYPE": function (dataEncoding) {
        if (dataEncoding == "A" || dataEncoding == "I") {
            this.dataEncoding = (dataEncoding == "A")
                ? this.asciiEncoding
                : "binary"
            this.reply(200)
        } else {
            this.reply(501)
        }
    },
    /**
   * Authentication
   */
    "USER": function (username) {
        this.username = username
        this.reply(331)
    },
    "PASS": function (password) {
        // Automatically accept password
        this.reply(230)
    },
    /**
   * Passive mode
   */
    "PASV": function () { // Enter passive mode
        var socket = this,
            dataServer = net.createServer()
        socket.passive = true
        dataServer.on('connection', function (dataSocket) {
            dataSocket.setEncoding(socket.dataEncoding)
            dataSocket.on('connect', function () {
                // Unqueue method that has been queued previously
                if (socket.dataTransfer.queue.length) {
                    socket
                        .dataTransfer
                        .queue
                        .shift()
                        .call(dataSocket)
                } else {
                    dataSocket.emit('error', {"code": 421})
                    socket.end()
                    }
                })
                .on('close', function () {
                    socket.reply(this.error
                        ? 426
                        : 226)
                    dataServer.close()
                })
                .on('error', function (err) {
                    this.error = err
                    socket.reply(err.code || 500, err.message)
                })
        })
            .on('listening', function () {
                var port = this
                        .address()
                        .port,
                    host = server
                        .address()
                        .address
                socket.dataInfo = {
                    "host": host,
                    "port": port
                }
                socket.reply(227, 'PASV OK (' + host.split('.').join(',') + ',' + parseInt(port / 256, 10) + ',' + (port % 256) + ')')
            })
            .listen()
    },
    /**
   * TODO Active mode
   */
    "PORT": function (info) {
        this.reply(202)
        // Specifies an address and port to which the server should connect.
        /*socket.passive = false;
    var addr = command[1].split(",");
    socket.pasvhost = addr[0]+"."+addr[1]+"."+addr[2]+"."+addr[3];
    socket.pasvport = (parseInt(addr[4]) * 256) + parseInt(addr[5]);
    socket.send("200 PORT command successful.\r\n");*/
    },
    /**
   * Filesystem
   */
    "LIST": function (target) {
        var socket = this
        socket.dataTransfer(function (dataSocket, finish) {
            socket
                .fs
                .list(target || socket.fs.pwd(), function (result) {
                    dataSocket.write(result + '\r\n', finish)
                })
        })
    },
    "NLST": function (target) {
        // TODO: just the list of file names
        this.reply(202)
    },
    "RETR": function (file) {
        var socket = this
        socket.dataTransfer(function (dataSocket, finish) {
            socket
                .fs
                .readFile(file, function (stream) {
                    stream
                        .on('data', function (chunk) {
                            dataSocket.write(chunk, socket.dataEncoding)
                        })
                    stream.on('end', function () {
                        dataSocket.end()
                    })
                })
        })
    },
    "STOR": function (file) {
        var socket = this
        socket.dataTransfer(function (dataSocket, finish) {
            socket
                .fs
                .writeFile(file, function (stream) {
                    dataSocket
                        .on('data', function (chunk) {
                            stream.write(chunk, socket.dataEncoding)
                        })
                    dataSocket.on('end', function () {
                        stream.end()
                    })
                })
        })
    },
    "DELE": function (file) {
        var socket = this
        socket
            .fs
            .unlink(file, function () {
                socket.reply(250)
            })
    },
    "RNFR": function (name) {
        this.reply(202)
        // Rename from.
        /*socket.filefrom = socket.fs.cwd() + command[1].trim();
    socket.send("350 File exists, ready for destination name.\r\n");*/
    },
    "RNTO": function (name) {
        this.reply(202)
        // Rename to.
        /*var fileto = socket.fs.cwd() + command[1].trim();
    rn = sys.exec("mv " + socket.filefrom + " " + fileto);
    rn.addCallback(function (stdout, stderr) {
      socket.send("250 file renamed successfully\r\n");
    });
    rn.addErrback(function () {
      socket.send("250 file renamed successfully\r\n");
    });*/
    },
    /**
   * Allow restart interrupted transfer
   */
    "REST": function (start) {
        this.reply(202)
        // Restart transfer from the specified point.
        /*socket.totsize = parseInt(command[1].trim());
    socket.send("350 Rest supported. Restarting at " + socket.totsize + "\r\n");*/
    },
    /**
   * Disconnection
   */
    "QUIT": function () {
        this.reply(221)
        this.end()
    }
}

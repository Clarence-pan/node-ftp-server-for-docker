"use strict";
const ftp_server_1 = require("./ftp-server");
const yargs = require("yargs");
const fs = require("fs");
function runFtpServer(options) {
    let ftpd = new ftp_server_1.default(options);
    ftpd.on('listening', function () {
        console.log("FtpServer start listening at " + options.host + ':' + options.port);
    });
    ftpd.on('error', function (err) {
        console.error("FtpServer got error: ", err);
    });
    ftpd.listen();
}
module.exports = function (argv) {
    argv = argv || process.argv;
    let args = yargs
        .strict()
        .usage('Usage: $0 [options]')
        .example('$0 -h localhost -p 21 -u test:123', 'Start the FTP Server on localhost:21, allow user `test` to access.')
        .option('port', {
        alias: 'p',
        describe: 'Specify which port to listen on(default is 21)',
        type: 'number',
    })
        .option('host', {
        alias: 'H',
        describe: 'Specify which host to bind(default is 0.0.0.0)',
        type: 'string',
    })
        .option('annoymous', {
        alias: 'a',
        describe: 'Whether enable annoymous user',
        type: 'boolean',
    })
        .options('users', {
        alias: 'u',
        describe: 'Specify users (in form like username:password, can be multiple)',
        type: 'array',
    })
        .option('config', {
        alias: 'c',
        describe: 'Specify which configuration file to use',
    })
        .option('debug', {
        describe: 'Whether enable debug mode',
        boolean: true,
    })
        .help('help')
        .alias('h', 'help')
        .alias('?', 'help')
        .parse(argv);
    if (args.debug) {
        process.env.DEBUG = '*';
    }
    let options = {};
    if (args.config) {
        try {
            let config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
            if (!config) {
                throw new Error("Invalid configuration file!");
            }
            options = Object.assign({}, options, config);
        }
        catch (e) {
            console.error(e);
            process.exit(1);
        }
    }
    if (args.port) {
        options.port = args.port;
    }
    if (args.host) {
        options.host = args.host;
    }
    if (args.annoymous) {
        options.allowAnonymous = true;
    }
    if (args.users) {
        options.users = args.users.map(up => {
            let [user, passwd] = up.split(':', 2);
            return { name: user, password: passwd };
        });
    }
    options = Object.assign({ port: 21, host: '0.0.0.0' }, options);
    return runFtpServer(options);
};

"use strict";
const ftp_server_1 = require("./ftp-server");
module.exports = function () {
    let ftpd = new ftp_server_1.default({
        users: [
            {
                name: 'test',
                password: '123456'
            }
        ],
        allowAnonymous: false
    });
    ftpd.on('listening', function () {
        console.log("FtpServer start listening...");
    });
    ftpd.on('error', function (err) {
        console.error("FtpServer got error: ", err);
    });
    ftpd.listen('127.0.0.1', 21);
};

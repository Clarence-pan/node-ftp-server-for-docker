import FtpServer from './ftp-server'
import * as path from 'path'

export = function () {
    let ftpd = new FtpServer({
        users: [
            {
                name: 'test',
                password: '123456'
            }
        ],
        allowAnonymous: false
    })

    ftpd.on('listening', function () {
        console.log("FtpServer start listening...")
    })

    ftpd.on('error', function (err) {
        console.error("FtpServer got error: ", err)
    })

    ftpd.listen('127.0.0.1', 21)
}


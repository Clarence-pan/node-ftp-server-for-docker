const FtpServer = require('..')
const path = require('path')

const FTP_ROOT = path.join(__dirname, '../test-data')

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

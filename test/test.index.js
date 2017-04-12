const assert = require('power-assert')
const FtpServer = require('../index.js')
const path = require('path')
const FtpClient = require('ftp')
const cb2p = require('cb2p')
const co = require('co')
const fs = require('fs')
const {readStreamToEnd} = require('./utils')

const joinPath = path
    .join
    .bind(path)

const readFileSync = fs
    .readFileSync
    .bind(fs)

const removeFileSync = fs
    .unlinkSync
    .bind(fs)

const existsSync = fs.existsSync.bind(fs)

describe("Sample Test", function () {
    it("Should success", function () {
        assert(0 === 0)
    })
})

describe("Simple ftp-server for test user", function () {
    const FTP_ROOT = path.join(__dirname, '../test-data')
    let ftpd = null
    let ftpClient = null

    it.skip("server should start", function () {

        ftpd = new FtpServer({
            rootPath: FTP_ROOT,
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

        return new Promise(function (resolve, reject) {
            ftpd
                .on('listening', function () {
                    resolve()
                })

            ftpd.on('error', function (err) {
                reject(err)
            })

            ftpd.listen('127.0.0.1', 21)

            assert(!!ftpd.socket)
        })
    })

    it('test client could connect and work ok', function (done) {
        ftpClient = new FtpClient()

        ~('list get put append rename logout delete cwd abort site status ascii binary '
          + 'mkdir rmdir cdup pwd system listSafe '
          + 'size lastMod restart')
          .split(' ')
          .forEach(fn => ftpClient[fn] = cb2p(ftpClient[fn].bind(ftpClient)))

        if (fs.existsSync(joinPath(FTP_ROOT, 'test2.txt'))) {
            removeFileSync(joinPath(FTP_ROOT, 'test2.txt'))
        }

        if (fs.existsSync(joinPath(FTP_ROOT, 'test3.txt'))) {
            removeFileSync(joinPath(FTP_ROOT, 'test3.txt'))
        }

        ftpClient
            .on('ready', function () {
                done()
            })

        ftpClient.connect({host: '127.0.0.1', port: 21, user: 'test', password: '123456'})
    })

    it('test client could list', () => co(function * () {
        assert(ftpClient !== null)
        const list = yield ftpClient.list()
        assert(list.map(x => x.name).join(', ') == '., .., aa, test.txt')
    }))

    it('test client could get file from remote', () => co(function * () {
        assert(ftpClient !== null)
        let stream = yield ftpClient.get('test.txt')
        let content = yield readStreamToEnd(stream, 'utf8')
        assert(content.toString() === readFileSync(joinPath(FTP_ROOT, 'test.txt'), 'utf8'))
    }))

    it('test client could get utf8 file from remote', () => co(function * () {
        assert(ftpClient !== null)
        let stream = yield ftpClient.get('aa/test-utf8.txt')
        let content = yield readStreamToEnd(stream, 'utf8')
        assert(content.toString() === readFileSync(joinPath(FTP_ROOT, 'aa/test-utf8.txt'), 'utf8'))
    }))

    it('test client could put file to remote', () => co(function * () {
        assert(ftpClient !== null)
        let stream = yield ftpClient.put(readFileSync(joinPath(FTP_ROOT, 'test.txt')), 'test2.txt')
        assert(readFileSync(joinPath(FTP_ROOT, 'test.txt'), 'utf8') === readFileSync(joinPath(FTP_ROOT, 'test2.txt'), 'utf8'))
    }))

    it('test client could put utf8 file to remote', () => co(function * () {
        assert(ftpClient !== null)
        let stream = yield ftpClient.put(readFileSync(joinPath(FTP_ROOT, 'aa/test-utf8.txt')), 'test3.txt')
        assert(readFileSync(joinPath(FTP_ROOT, 'test3.txt'), 'utf8') === readFileSync(joinPath(FTP_ROOT, 'aa/test-utf8.txt'), 'utf8'))
    }))

    it('test client could delete file from remote', () => co(function *(){
        assert(existsSync(joinPath(FTP_ROOT, 'test3.txt')))

        yield ftpClient.delete('test3.txt')

        assert(!existsSync(joinPath(FTP_ROOT, 'test3.txt')))
    }))

    after(function () {
        if (ftpClient){
            ftpClient.end()
            ftpClient = null
        }

        if (ftpd){
            ftpd.stop()
            ftpd = null
        }
    })

})

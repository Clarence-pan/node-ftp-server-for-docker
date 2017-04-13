const assert = require('power-assert')
const shell = require('../lib/shell')

describe('Shell test', function(){
    it('simple ls should ok', function(){
        return shell.shellExec('ls')
            .then(res => {
                assert(res.retCode === 0)
                assert(!!res.stdout)
            })
    })

    it('simple [ls] should ok', function(){
        return shell.shellExec(['ls'])
            .then(res => {
                assert(res.retCode === 0)
                assert(!!res.stdout)
            })
    })

    it('simple ls -l should ok', function(){
        return shell.shellExec('ls -l')
            .then(res => {
                assert(res.retCode === 0)
                assert(!!res.stdout)
            })
    })

    it('simple [ls -l] should ok', function(){
        return shell.shellExec(['ls', '-l'])
            .then(res => {
                assert(res.retCode === 0)
                assert(!!res.stdout)
            })
    })
})
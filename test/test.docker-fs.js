const assert = require('power-assert')
const dockerFs = require('../lib/docker-fs')
const glob = require('glob')
const path = require('path')
const fs = require('fs')

describe('Test fs.stat', function(){
    let dataFiles = glob.sync(path.join(__dirname, 'fs-stat/**.txt'))

    dataFiles.forEach(function(file){        
        it('parseShellStatOutputToFsStats#' + path.basename(file), function(){
            let fileContent = fs.readFileSync(file, 'utf8')

            fileContent = fileContent.replace("\r\n", "\n")
            let [sampleOutput, expectedResult] = fileContent.split('-------------------------------------------------')

            expectedResult = eval('(' + expectedResult + ')')
            let parsedStats = dockerFs.parseShellStatOutputToFsStats(sampleOutput)

            let keys = Object.keys(expectedResult)
            let stringify = stats => {
                let res = ['{']
                for (let key of keys){
                    if (typeof stats[key] === 'function'){
                        res.push('  ' + key + ': ' + JSON.stringify(stats[key].call(stats)))
                    } else {
                        res.push('  ' + key + ': ' + JSON.stringify(stats[key]))
                    }
                }

                res.push('}')
                return res.join("\n")
            }
        
            assert(stringify(expectedResult) === stringify(parsedStats))
        })
    })
})
const assert = require('power-assert')
const dockerFs = require('../lib/docker-fs')
const glob = require('glob')
const path = require('path')
const fs = require('fs')

describe('Test fs.stat parse1', function(){
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

describe('Test fs.stat parse-multi', function(){
    let dataFiles = glob.sync(path.join(__dirname, 'fs-stat-multi/**.txt'))

    dataFiles.forEach(function(file){        
        it('parseMultiFileStatsFromShellOutput#' + path.basename(file), function(){
            let fileContent = fs.readFileSync(file, 'utf8')

            fileContent = fileContent.replace("\r\n", "\n")
            let [sampleOutput, expectedResult] = fileContent.split('-------------------------------------------------')

            expectedResult = eval('(' + expectedResult + ')')
            let parsedStats = dockerFs.parseMultiFileStatsFromShellOutput(sampleOutput)

            let files = Object.keys(expectedResult)
            let statKeys = Object.keys(expectedResult[files[0]])

            let stringifyStat = stats => {
                let res = ['  {']
                for (let key of statKeys){
                    if (typeof stats[key] === 'function'){
                        res.push('    ' + key + ': ' + JSON.stringify(stats[key].call(stats)))
                    } else {
                        res.push('    ' + key + ': ' + JSON.stringify(stats[key]))
                    }
                }

                res.push('  }')
                return res.join("\n")
            }

            let stringify = stats => {
                let res = ['{']
                for (let file of files){
                    res.push('  ' + file + ': ' + stringifyStat(stats[file]))
                }

                res.push('}')
                return res.join("\n")
            }
        
            assert(stringify(expectedResult) === stringify(parsedStats))
        })
    })
})
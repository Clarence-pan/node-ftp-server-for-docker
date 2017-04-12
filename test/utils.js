exports.readStreamToEnd = function (stream, encoding) {
    return new Promise((resolve, reject) => {
        let read = []

        stream.on('data', function (data) {
            read.push(data)
        })

        stream.on('error', function (err) {
            reject(err)
        })

        stream.on('end', function (data) {
            if (data) {
                read.push(data)
            }

            if (read.length === 0) {
                return resolve(encoding
                    ? ''
                    : Buffer.from([]))
            }

            let result = Buffer.concat(read)
            resolve(encoding
                ? result.toString(encoding)
                : result)
        })
    })
}
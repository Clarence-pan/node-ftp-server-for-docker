const assert = require('power-assert');
const Cache = require('../lib/cache').default;
const co = require('co')

let data = [
    '',
    'abc',
    'Hello world!',
    123,
    new Date(),
    {foo: 'bar'},
    ['a', 'b', 'c'],
    null,
    undefined
];

describe('Test Cache', function () {
    it("Get what has set", function () {
        let cache = new Cache()

        data.forEach((val, i) => {
            let key = 'cache#' + i
            cache.set(key, val)

            assert(val === cache.get(key))
        })
    });

    it("Should expire after some time", function () {
        let cache = new Cache()
        data.forEach((val, i) => {
            let key = 'cache#' + i
            cache.set(key, val, 100 * i)
        })

        return Promise.all(
            data.map((val, i) => co(function*(){
                let key = 'cache#' + i
                cache.set(key, val, 100 * i)
                
                yield sleep(100 * i + 10)
                
                assert(null === cache.get(key))
            }))
        )
    });
})


function sleep(timeout){
    return new Promise(resolve => setTimeout(resolve, timeout))
}
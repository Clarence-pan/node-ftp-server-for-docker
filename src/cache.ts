export default class Cache<T> {
    _cache: {
        [key:string]: {
            expire: number,
            value: T
        }
    }

    constructor(){
        this._cache = {}
    }

    /**
     * Get cached data by key
     * @param key - Cache key
     */
    get(key: string): T|null{
        let cached = this._cache[key]

        // only when cached exists and not expired, the cached value can be returned
        if (cached && Date.now() <= cached.expire){
            return cached.value
        } else {
            // otherwise null is returned
            return null
        }
    }

    /**
     * Set cached data by key
     * @param key 
     * @param value 
     * @param timeout - timeout to expire in ms
     */
    set(key: string, value: T, timeout: number=Infinity): void{
        this._cache[key] = {
            expire: Date.now() + timeout,
            value: value
        }
    }
}


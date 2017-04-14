"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Cache {
    constructor() {
        this._cache = {};
    }
    /**
     * Get cached data by key
     * @param key - Cache key
     */
    get(key) {
        let cached = this._cache[key];
        // only when cached exists and not expired, the cached value can be returned
        if (cached && Date.now() <= cached.expire) {
            return cached.value;
        }
        else {
            // otherwise null is returned
            return null;
        }
    }
    /**
     * Set cached data by key
     * @param key
     * @param value
     * @param timeout - timeout to expire in ms
     */
    set(key, value, timeout = Infinity) {
        this._cache[key] = {
            expire: Date.now() + timeout,
            value: value
        };
    }
}
exports.default = Cache;

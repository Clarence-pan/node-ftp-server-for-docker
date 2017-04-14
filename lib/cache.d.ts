export default class Cache<T> {
    _cache: {
        [key: string]: {
            expire: number;
            value: T;
        };
    };
    constructor();
    /**
     * Get cached data by key
     * @param key - Cache key
     */
    get(key: string): T | null;
    /**
     * Set cached data by key
     * @param key
     * @param value
     * @param timeout - timeout to expire in ms
     */
    set(key: string, value: T, timeout?: number): void;
}

import fs from 'fs-extra';
import * as path from "path";

export class Cache {
    cachePath: string;

    constructor(cachePath: string) {
        this.cachePath = cachePath;
    }

    getPathForKey(key: string) {
        return path.resolve(this.cachePath, key + '.json');
    }

    has(key: string): boolean {
        return fs.existsSync(this.getPathForKey(key));
    }

    read(key: string): any {
        return fs.readJSONSync(this.getPathForKey(key));
    }

    write(key: string, data: any) {
        fs.outputJsonSync(this.getPathForKey(key), data, {spaces: 4});
    }

    clear(key: string) {
        fs.removeSync(this.getPathForKey(key));
    }
}

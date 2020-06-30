export interface ReaddirRecursiveOpts {
    path: string;
    ignore?: string[];
}
export interface ReaddirRecursiveFile {
    name: string;
    mode: number;
}
/**
 * Recursively read a directory.
 * @param options options object.
 * @return array of files that match.
 */
export declare function readdirRecursive(options: ReaddirRecursiveOpts): Promise<ReaddirRecursiveFile[]>;

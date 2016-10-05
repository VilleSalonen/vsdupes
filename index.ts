/// <reference path="command-line-args.d.ts" />
/// <reference path="walk.d.ts" />

import process = require("process");
import path = require("path");

import commandLineArgs = require("command-line-args");
import walk = require("walk");
import _ = require("lodash");

import {QuickMD5Hasher} from "./quickmd5hasher";
import {Sha512Hasher} from "./sha512hasher";

class File {
    public filePath: string;
    public fileSize: Number;
    public quickHash: string;
    public accurateHash: string;

    constructor(filePath: string, fileSize: Number) {
        this.filePath = filePath;
        this.fileSize = fileSize;
    }
}

function parseRootPathFromParameters(): string {
    return process.argv[2].replace(/\"/g, '');
}

function getFiles(rootPath: string): Promise<File[]> {
    return new Promise<File[]>((resolve: Function, reject: Function) => {
        var files: File[] = [];

        var walker = walk.walk(rootPath, { followLinks: false });

        walker.on("file", (root: string, stat: walk.WalkStat, next: (() => void)) => {
            if (stat.size > 0) {
                var filePath = path.normalize(path.join(root, stat.name));
                files.push(new File(filePath, stat.size));
            }

            next();
        });

        walker.on("end", () => {
            resolve(files);
        });
    });
}

function weedFilesBySizeComparison(files: File[]): File[][] {
    let grouped = _.groupBy(files, (file: File) => file.fileSize);
    let possibleDuplicates: File[][] = [];
    for (let size in grouped) {
        if (grouped[size].length > 1) {
            possibleDuplicates.push(grouped[size]);
        }
    }
    return possibleDuplicates;
}

async function weedFilesByQuickHash(files: File[][]): Promise<File[][]> {
    let hasher = new QuickMD5Hasher();
    let result: File[][] = [];

    for (let group of files) {
        for (let file of group) {
            file.quickHash = await hasher.hash(file.filePath);
        }

        var groupedByQuickHash = _.groupBy(group, (file: File) => file.quickHash);
        for (let hash in groupedByQuickHash) {
            if (groupedByQuickHash[hash].length > 1) {
                result.push(groupedByQuickHash[hash]);
            }
        }
    }

    return result;
}

async function weedFilesByAccurateHash(files: File[][]): Promise<File[][]> {
    let hasher = new Sha512Hasher();
    let result: File[][] = [];

    for (let group of files) {
        for (let file of group) {
            file.accurateHash = await hasher.hash(file.filePath);
        }

        var groupedByQuickHash = _.groupBy(group, (file: File) => file.accurateHash);
        for (let hash in groupedByQuickHash) {
            if (groupedByQuickHash[hash].length > 1) {
                result.push(groupedByQuickHash[hash]);
            }
        }
    }

    return result;
}

async function main() {
    let rootPath = parseRootPathFromParameters();

    process.stdout.write("Walking the files... ");
    let allFiles = await getFiles(rootPath);
    console.log(allFiles.length + " files found.");

    process.stdout.write("Grouping by file size... ");
    let possibleDuplicates = weedFilesBySizeComparison(allFiles);
    console.log(possibleDuplicates.length + " possible duplicate groups found.");

    process.stdout.write("Grouping by fast hashing... ");
    let possibleDuplicates2 = await weedFilesByQuickHash(possibleDuplicates);
    console.log(possibleDuplicates2.length + " possible duplicate groups found.");

    process.stdout.write("Grouping by accurate hashing... ");
    let possibleDuplicates3 = await weedFilesByAccurateHash(possibleDuplicates2);
    console.log(possibleDuplicates3.length + " definite duplicate groups found.");

    console.log();
    for (let duplicateGroup of possibleDuplicates3) {
        console.log("SHA512 hash: " + duplicateGroup[0].accurateHash.substr(0, 6));

        for (let file of duplicateGroup) {
            console.log("  " + file.filePath);
        }
    }
}

main();
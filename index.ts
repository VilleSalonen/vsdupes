/// <reference path="command-line-args.d.ts" />
/// <reference path="walk.d.ts" />

import process = require("process");
import path = require("path");

import commandLineArgs = require("command-line-args");
import walk = require("walk");
import winston = require("winston");
import _ = require("lodash");

class File {
    constructor(public filePath: string, public fileSize: Number) {
    }
}

function parseOptions(): any {
    let cli = commandLineArgs([
        { name: "rootPath", type: String, multiple: false, defaultOption: true },
        { name: "verbose", type: Boolean, multiple: false }
    ]);

    let options = cli.parse();

    if (options.verbose) {
        winston.level = "verbose";
    }

    // For some reason " is added only to the end of the path if path contains spaces.
    options.rootPath = options.rootPath.replace(/\"/g, '');

    return options;
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

function getPossibleDuplicatesBasedOnSize(files: File[]) {
    let grouped = _.groupBy(files, (file: File) => file.fileSize);
    let possibleDuplicates: File[][] = [];
    for (let size in grouped) {
        if (grouped[size].length > 1) {
            possibleDuplicates.push(grouped[size]);
        }
    }
    return possibleDuplicates;
}

async function main(rootPath: string) {
    let options = parseOptions();

    winston.info("Walking the files...");
    let allFiles = await getFiles(options.rootPath);
    winston.info(allFiles.length + " files found.");

    winston.info("Grouping by file size...")
    let possibleDuplicates = getPossibleDuplicatesBasedOnSize(allFiles);
    winston.info(possibleDuplicates.length + " possible duplicate groups found.");
    
    console.log("exit");
}

main(process.argv[2]);
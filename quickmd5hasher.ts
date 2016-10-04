import crypto = require("crypto");
import fs = require("fs");

var CHUNK_SIZE = 1024;

export class QuickMD5Hasher {
    public hash(path: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {

            fs.open(path, "r", function(err, fd) {
                if (err) return reject(err);

                if (typeof fd === "undefined")
                    return resolve(); // or reject?

                fs.stat(path, function(err, stats) {
                    if (err) return reject(err);

                    // Sometimes stats is undefined. This is probably due to file being
                    // moved elsewhere or deleted.
                    if (typeof stats === "undefined")
                        return resolve(); // or reject?

                    var input_size: number = stats.size;
                    var offset: number = input_size / 2.0 - CHUNK_SIZE / 2.0;
                    var buffer: Buffer = new Buffer(CHUNK_SIZE);


                    fs.read(fd, buffer, 0, buffer.length, offset, function(e, l, b) {
                        var dataForHashing = b.toString("binary");
                        var hash = crypto.createHash("md5")
                            .update(dataForHashing)
                            .digest("hex");

                        fs.close(fd);

                        resolve(hash);
                    });
                });
            });
        }).catch(e => {
            console.log(e);
            if (e.name === "TypeError") {
                // If hashing is done when file is still being copied, it will
                // fail.
            }
            else {
                throw e;
            }
        });

    }
}

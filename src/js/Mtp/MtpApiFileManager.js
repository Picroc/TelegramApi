function MtpApiFileManagerModule(MtpApiManager) {
    var cachedFs = false;
    var cachedFsPromise = false;
    var cachedSavePromises = {};
    var cachedDownloadPromises = {};
    var cachedDownloads = {};

    var downloadPulls = {};
    var downloadActives = {};

    function downloadRequest(dcID, cb, activeDelta) {
        if (downloadPulls[dcID] === undefined) {
            downloadPulls[dcID] = [];
            downloadActives[dcID] = 0
        }
        var downloadPull = downloadPulls[dcID];
        return new Promise(function (resolve, reject) {
            downloadPull.push({ cb: cb, resolve: resolve, reject: reject, activeDelta: activeDelta });
            setZeroTimeout(function () {
                downloadCheck(dcID);
            });
        });
    }

    var index = 0;

    function downloadCheck(dcID) {
        var downloadPull = downloadPulls[dcID];
        var downloadLimit = dcID == 'upload' ? 11 : 5;

        if (downloadActives[dcID] >= downloadLimit || !downloadPull || !downloadPull.length) {
            return false;
        }

        var data = downloadPull.shift(),
            activeDelta = data.activeDelta || 1;

        downloadActives[dcID] += activeDelta;

        var a = index++;
        data.cb()
            .then(function (result) {
                downloadActives[dcID] -= activeDelta;
                downloadCheck(dcID);

                data.resolve(result);

            }, function (error) {
                downloadActives[dcID] -= activeDelta;
                downloadCheck(dcID);

                data.reject(error);
            })
    }

    function uploadFile(file) {
        var fileSize = file.size,
            isBigFile = fileSize >= 10485760,
            canceled = false,
            resolved = false,
            doneParts = 0,
            partSize = 262144, // 256 Kb
            activeDelta = 2;

        if (!fileSize) {
            return Promise.reject({ type: 'EMPTY_FILE' });
        }

        if (fileSize > 67108864) {
            partSize = 524288;
            activeDelta = 4;
        }
        else if (fileSize < 102400) {
            partSize = 32768;
            activeDelta = 1;
        }
        var totalParts = Math.ceil(fileSize / partSize);

        if (totalParts > 3000) {
            return Promise.reject({ type: 'FILE_TOO_BIG' });
        }

        return new Promise(function (resolve, reject) {
            var fileID = [nextRandomInt(0xFFFFFFFF), nextRandomInt(0xFFFFFFFF)],
                errorHandler = function (error) {
                    // console.error('Up Error', error);
                    reject(error);
                    canceled = true;
                    errorHandler = noop;
                },
                part = 0,
                offset,
                resultInputFile = {
                    _: isBigFile ? 'inputFileBig' : 'inputFile',
                    id: fileID,
                    parts: totalParts,
                    name: file.name,
                    md5_checksum: ''
                };


            for (offset = 0; offset < fileSize; offset += partSize) {
                (function (offset, part) {
                    downloadRequest('upload', function () {
                        return new Promise(function (uploadResolve, uploadReject) {
                            // var uploadDeferred = new Promise();

                            var reader = new FileReader();
                            var blob = file.slice(offset, offset + partSize);

                            reader.onloadend = function (e) {
                                if (canceled) {
                                    uploadReject();
                                    return;
                                }
                                if (e.target.readyState != FileReader.DONE) {
                                    return;
                                }
                                MtpApiManager.invokeApi(isBigFile ? 'upload.saveBigFilePart' : 'upload.saveFilePart', {
                                    file_id: fileID,
                                    file_part: part,
                                    file_total_parts: totalParts,
                                    bytes: e.target.result
                                }, {
                                    startMaxLength: partSize + 256,
                                    fileUpload: true,
                                    singleInRequest: true
                                }).then(function (result) {
                                    doneParts++;
                                    uploadResolve();
                                    if (doneParts >= totalParts) {
                                        resolve(resultInputFile);
                                        resolved = true;
                                    } else {
                                        console.log(dT(), 'Progress', doneParts * partSize / fileSize);
                                        resolve({ done: doneParts * partSize, total: fileSize });
                                    }
                                }, errorHandler);
                            };

                            reader.readAsArrayBuffer(blob);
                        });
                    }, activeDelta);
                })(offset, part++);
            }

            this.cancel = function () {
                console.log('cancel upload', canceled, resolved);
                if (!canceled && !resolved) {
                    canceled = true;
                    errorHandler({ type: 'UPLOAD_CANCELED' });
                }
            };
        });
    }

    return {
        uploadFile: uploadFile
    };
}

MtpApiFileManagerModule.dependencies = [
    'MtpApiManager'
];

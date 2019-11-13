function $httpModule() {
    return {
        post: function (url, data) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();

                xhr.open('POST', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function () {
                    var result = { data: xhr.response };
                    xhr.status == 200
                        ? resolve(result)
                        : reject(result);
                };
                xhr.onerror = xhr.onabort = function () {
                    reject({ status: xhr.status });
                };
                xhr.send(data);
            });
        }
    };
}

$httpModule.dependencies = [];

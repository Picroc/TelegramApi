function $timeoutModule() {
    var timeout = function (cb, t) {
        return new Promise(function (resolve, reject) {
            this.__timeoutID = setTimeout(function () {
                resolve(cb());
            }, t || 0);
        })
    };

    timeout.cancel = function (promise) {
        if (!promise) {
            return;
        }

        clearTimeout(promise.__timeoutID);
    };

    return timeout;
}

$timeoutModule.dependencies = [];

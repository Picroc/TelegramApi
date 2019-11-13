function StorageModule() {
    var methods = {};

    forEach(['get', 'set', 'remove'], function (methodName) {
        methods[methodName] = function () {
            var args = toArray(arguments);
            return new Promise(function (resolve, reject) {

                args.push(function (result) {
                    resolve(result);
                });

                ConfigStorage[methodName].apply(ConfigStorage, args);
            });
        };
    });

    return methods;
}

StorageModule.dependencies = [];

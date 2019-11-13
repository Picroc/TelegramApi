function MtpPasswordManagerModule(MtpApiManager, CryptoWorker, MtpSecureRandom) {
    return {
        check: check,
        getState: getState,
        requestRecovery: requestRecovery,
        recover: recover,
        updateSettings: updateSettings
    }

    function getState(options) {
        return MtpApiManager.invokeApi('account.getPassword', {}, options).then(function (result) {
            console.log(result);
            return result;
        })
    }

    function updateSettings(state, settings) {
        console.log(settings);
        var currentHashPromise
        var newHashPromise
        var params = {
            new_settings: {
                _: 'account.passwordInputSettings',
                flags: 0,
                hint: settings.hint || ''
            }
        }

        if (typeof settings.cur_password === 'string' &&
            state.current_salt &&
            settings.cur_password.length > 0) {
            currentHashPromise = makePasswordHash(state.current_salt, settings.cur_password)
        } else {
            currentHashPromise = Promise.resolve([])
        }

        if (typeof settings.new_password === 'string' &&
            settings.new_password.length > 0) {
            var saltRandom = new Array(8)
            var newSalt = bufferConcat(state.new_salt, saltRandom)
            MtpSecureRandom.nextBytes(saltRandom)
            newHashPromise = makePasswordHash(newSalt, settings.new_password)
            params.new_settings.new_salt = newSalt
            params.new_settings.flags |= 1
        } else {
            if (typeof settings.new_password === 'string') {
                params.new_settings.flags |= 1
                params.new_settings.new_salt = []
            }
            newHashPromise = Promise.resolve([])
        }

        if (typeof settings.email === 'string') {
            params.new_settings.flags |= 2
            params.new_settings.email = settings.email || ''
        }

        return Promise.all([currentHashPromise, newHashPromise]).then(function (hashes) {
            params.current_password_hash = hashes[0]
            params.new_settings.new_password_hash = hashes[1]

            return MtpApiManager.invokeApi('account.updatePasswordSettings', params)
        })
    }

    function check(state, password, options) {
        return makePasswordHash(state.current_salt, password).then(function (passwordHash) {
            return MtpApiManager.invokeApi('auth.checkPassword', {
                password_hash: passwordHash
            }, options)
        })
    }

    function requestRecovery(state, options) {
        return MtpApiManager.invokeApi('auth.requestPasswordRecovery', {}, options)
    }

    function recover(code, options) {
        return MtpApiManager.invokeApi('auth.recoverPassword', {
            code: code
        }, options)
    }

    function makePasswordHash(salt, password) {
        var passwordUTF8 = unescape(encodeURIComponent(password))

        var buffer = new ArrayBuffer(passwordUTF8.length)
        var byteView = new Uint8Array(buffer)
        for (var i = 0, len = passwordUTF8.length; i < len; i++) {
            byteView[i] = passwordUTF8.charCodeAt(i)
        }

        buffer = bufferConcat(bufferConcat(salt, byteView), salt)

        return CryptoWorker.sha256Hash(buffer)
    }
}

MtpPasswordManagerModule.dependencies = [
    'MtpApiManager',
    'CryptoWorker',
    'MtpSecureRandom'
]
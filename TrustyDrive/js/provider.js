function log(message) {
    var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
    var dateString, d = new Date();
    dateString = '[' + d.getDate() + '-' + month[d.getMonth()] + '-' + d.getFullYear().toString().substr(-2) + ' ';
    if (d.getMinutes() > 9) {
        dateString += d.getHours() + ':' + d.getMinutes() + '] ';
    } else {
        dateString += d.getHours() + ':0' + d.getMinutes() + '] ';
    }
    Windows.Storage.ApplicationData.current.localFolder.getFileAsync('logs.txt').then(
        function (file) {
            Windows.Storage.FileIO.appendTextAsync(file, dateString + message + '\n');
        },
        function (error) {
            Windows.Storage.ApplicationData.current.localFolder.createFileAsync('logs.txt').then(function (file) {
                Windows.Storage.FileIO.appendTextAsync(file, dateString + '##### NEW FILE ######\n');
                Windows.Storage.FileIO.appendTextAsync(file, dateString + message + '\n');
            });
        }
    );
}

function createProvider(provider, email, token, freeStorage, totalStorage) {
    var credentials = Windows.Security.Credentials;
    var passwordVault = new credentials.PasswordVault();
    var i, found = false;
    for (i = 0; i < g_providers.length; i++) {
        if (g_providers[i].provider == provider && g_providers[i].user == email) {
            found = true;
        }
    }
    if (!found) {
        cred = new credentials.PasswordCredential(provider, email, token)
        passwordVault.add(cred);
        log('Add the provider: ' + provider + '/' + email);
        g_providers.push({
            'provider': cred.resource, 'user': cred.userName, 'token': cred.password,
            'free': freeStorage, 'total': totalStorage
        });
        g_providers.sort(function (a, b) {
            return a.user.localeCompare(b.user);
        });
        if (g_files[g_configName] != undefined) {
            g_files[g_configName]['chunks'] = [];
            g_providers.forEach(function (p) {
                g_files[g_configName]['chunks'].push(p.user.replace('@', 'at') + 'is' + 'remy');
            });
            log('Spread the metadata to all providers');
            uploadConfiguration();
        }
    }
}

function filesOnProvider(filenames, index, myprovider, errorFiles, after) {
    var found = false, current = g_files[filenames[index]];
    if (index >= filenames.length) {
        after();
    } else {
        if (current == undefined || current.name == g_configName) {
            filesOnProvider(filenames, index + 1, myprovider, errorFiles, after);
        } else {
            current.providers.forEach(function (p) {
                if (p.provider == myprovider.provider && p.user == myprovider.user) {
                    found = true;
                }
            });
            if (found) {
                g_workingFolder.getFileAsync(current.name).then(
                    function (file) {
                        filesOnProvider(filenames, index + 1, myprovider, errorFiles, after);
                    },
                    function (error) {
                        errorFiles.push(current);
                        filesOnProvider(filenames, index + 1, myprovider, errorFiles, after);
                    }
                );
            } else {
                filesOnProvider(filenames, index + 1, myprovider, errorFiles, after);
            }
        }
    }
}

function deleteProvider(provider) {
    var passwordVault = new Windows.Security.Credentials.PasswordVault();
    var credentials = passwordVault.retrieveAll();
    var chunkName = provider.user.replace('@', 'at') + 'is' + 'remy';
    var index = g_providers.indexOf(provider);
    var myprovider, message, errorFiles = [];
    log('Try to Delete the provider ' + provider.provider + '/' + provider.user);
    if (index > -1) {
        myprovider = g_providers[index];
        // Check all files using this provider are downloaded
        filesOnProvider(Object.keys(g_files), 0, myprovider, errorFiles, function () {
            if (errorFiles.length > 0) {
                message = 'Delete Provider Error: Can Not Delete <b>' + myprovider.provider + '/' + myprovider.user +
                    '</b>. The following files must be deleted or downloaded:<br>';
                errorFiles.forEach(function (f) {
                    if (f.path.length == 1) {
                        message += f.path + f.name + '<br>';
                    } else {
                        message += f.path + '/' + f.name + '<br>';
                    }
                });
                WinJS.Navigation.navigate('/pages/folder/folder.html', message);
            } else {
                log('Delete ' + provider.provider + '/' + provider.user);
                // Remove the provider from the current provider list
                g_providers.splice(index, 1);
                // Remove credential for the provider
                credentials.forEach(function (c) {
                    if (c.userName == provider.user && c.resource == provider.provider) {
                        index = credentials.indexOf(c);
                        passwordVault.remove(c);
                    }
                });
                // Delete the chunk related to the configuration
                dropboxDelete(chunkName, provider.token);
                if (g_files[g_configName] != undefined) {
                    g_files[g_configName]['chunks'].splice(g_files[g_configName]['chunks'].indexOf(chunkName), 1);
                    // Upload the configuration
                    uploadConfiguration();
                }
            }
        });
    } else {
        log('Can not delete ' + provider.provider + '/' + provider.user);
    }
}

function getProvider(provider, user) {
    var result = undefined;
    g_providers.forEach(function (p) {
        if (p.user == user && p.provider == provider) {
            result = p;
        }
    });
    return result;
}

function sha1(message) {
    var crypto = Windows.Security.Cryptography;
    var algo = crypto.Core.HashAlgorithmProvider.openAlgorithm(crypto.Core.HashAlgorithmNames.sha1).createHash();
    var cBuffer = crypto.CryptographicBuffer;
    message = cBuffer.convertStringToBinary(message, crypto.BinaryStringEncoding.utf8);
    algo.append(message);
    return cBuffer.encodeToHexString(algo.getValueAndReset());
}

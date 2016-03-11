function createProvider(provider, email, token, freeStorage, totalStorage) {
    var debug = $('#debug');
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
        debug.append('Add the provider: ' + provider + '/' + email + '<br>');
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
            debug.append('Spread the metadata to all providers<br>');
            uploadConfiguration();
        }
    }
}

function filesOnProvider(filenames, index, myprovider, errorFiles, after) {
    var found = false, current = g_files[filenames[index]];
    var debug = $('#debug');
    if (index + 1 >= filenames.length) {
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
                g_workingDir.getFileAsync(current.name).then(
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
    var debug = $('#debug');
    var passwordVault = new Windows.Security.Credentials.PasswordVault();
    var credentials = passwordVault.retrieveAll();
    var chunkName = provider.user.replace('@', 'at') + 'is' + 'remy';
    var index = g_providers.indexOf(provider);
    var myprovider, message, errorFiles = [];
    debug.append('Try to Delete the provider ' + provider.provider + '/' + provider.user + '<br>');
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
                debug.append('delete ' + provider.provider + '/' + provider.user + '<br>');
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
        $('#debug').append('Can not delete ' + provider.provider + '/' + provider.user + '<br>');
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

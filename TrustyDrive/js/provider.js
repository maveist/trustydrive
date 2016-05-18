// Return an array with all existing chunk names
function allChunkNames() {
    var allChunks = [];
    $.each(g_files, function (useless, file) {
        allChunks = allChunks.concat(file.chunks);
    });
    return allChunks;
}

// Compute the chunk name for one piece of metadata
function configurationChunkName(provider) {
    var crypto = Windows.Security.Cryptography;
    var algo = crypto.Core.HashAlgorithmNames.sha1;
    var hasher = crypto.Core.HashAlgorithmProvider.openAlgorithm(algo).createHash();
    var chunkName = provider.user + g_files[g_configName].user + provider.provider;
    hasher.append(crypto.CryptographicBuffer.convertStringToBinary(chunkName, crypto.BinaryStringEncoding.utf8));
    return crypto.CryptographicBuffer.encodeToHexString(hasher.getValueAndReset());
}

// Add a provider to the provider list (g_providers)
function createProvider(provider, email, refreshToken, token, freeStorage, totalStorage) {
    var credentials = Windows.Security.Credentials;
    var passwordVault = new credentials.PasswordVault();
    var i, found = undefined;
    // Check if the provider exists
    for (i = 0; i < g_providers.length; i++) {
        if (g_providers[i].provider == provider && g_providers[i].user == email) {
            found = g_providers[i];
        }
    }
    if (found == undefined) {
        // Add the provider
        if (refreshToken == undefined) {
            cred = new credentials.PasswordCredential(provider, email, token)
        } else {
            cred = new credentials.PasswordCredential(provider, email, refreshToken)
        }
        passwordVault.add(cred);
        log('Add the provider: ' + provider + '/' + email);
        provider = {
            'provider': cred.resource, 'user': cred.userName, 'token': token, 'refresh': refreshToken,
            'free': freeStorage, 'total': totalStorage
        };
        g_providers.push(provider);
        g_providers.sort(function (a, b) {
            return a.user.localeCompare(b.user);
        });
        // Add one chunk to notify the update of the provider list
        g_files[g_configName].chunks.push(provider.user);
        return provider;
    } else {
        found.token = token;
        found.refresh = refreshToken;
        found.free = freeStorage;
        found.total = totalStorage;
        return found;
    }
}

// Remove this provider of the provider list then spread the metadata between the remaining providers
// The configuration chunk on this provider is deleted
function deleteProvider(provider) {
    var passwordVault = new Windows.Security.Credentials.PasswordVault();
    var credentials = passwordVault.retrieveAll();
    var chunkName = configurationChunkName(provider);
    var index = g_providers.indexOf(provider);
    var myprovider, message, errorFiles = [];
    var metadata = g_files[g_configName];
    var chunksToDelete = [];
    log('Try to Delete the provider ' + provider.provider + '/' + provider.user);
    if (index > -1) {
        myprovider = g_providers[index];
        // Check that all files using this provider are downloaded
        $.each(g_files, function (useless, f) {
            if (f.name != g_configName) {
                f.providers.forEach(function (p) {
                    if (p.provider == provider.provider && p.user == provider.user) {
                        errorFiles.push(f);
                    }
                });
            }
        });
        if (errorFiles.length > 0) {
            message = 'Delete Provider Error: Can Not Delete <b>' + myprovider.provider + '/' + myprovider.user +
                '</b>. The following files must be deleted:<br>';
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
            // Remove credential for the provider
            credentials.forEach(function (c) {
                if (c.userName == provider.user && c.resource == provider.provider) {
                    credentials.indexOf(c);
                    passwordVault.remove(c);
                }
            });
            // Delete the chunk related to the configuration
            if (metadata.chunks.length > 0) {
                if (metadata.chunks.length == 2) {
                    // Delete the last two chunks because we can not keep metadata in one single file
                    $.each(metadata.chunks, function (idx, c) {
                        chunksToDelete.push({ 'idx': idx, 'chunk': c, 'provider': g_providers[idx] });
                    });
                } else {
                    $.each(metadata.chunks, function (idx, c) {
                        if (c.name == chunkName) {
                            chunksToDelete.push({ 'idx': idx, 'chunk': c, 'provider': provider });
                        }
                    });
                }
                // Remove the provider from the current provider list
                g_providers.splice(index, 1);
                // Delete chunk(s)
                g_complete = 0;
                progressBar(g_complete, chunksToDelete.length + 1, 'Initialization', 'Delete Metadata Chunks');
                chunksToDelete.forEach(function (c) {
                    if (chunksToDelete.length > 1) {
                        metadata['chunks'] = [];
                    } else {
                        metadata['chunks'].splice(c.idx, 1);
                    }
                    // Delete the chunk leads to upload the metadata
                    switch (c.provider.provider) {
                        case 'dropbox':
                            dropboxDelete(c.chunk.name, c.provider, chunksToDelete.length, g_folders[g_homeFolderName]);
                            break;
                        case 'gdrive':
                            gdriveDelete(c.chunk.id, c.provider, chunksToDelete.length, g_folders[g_homeFolderName]);
                            break;
                        case 'onedrive':
                            oneDriveDelete(c.chunk.id, c.provider, chunksToDelete.length, g_folders[g_homeFolderName]);
                            break;
                    }
                });
            }
        }
    } else {
        log('Can not delete ' + provider.provider + '/' + provider.user);
    }
}

function filesOnProvider(filenames, myprovider) {
    var current, errorFiles = [];
    filenames.forEach(function (f) {
        current = g_files[f];
        if (current != undefined && current.name != g_configName) {
            current.providers.forEach(function (p) {
                if (p.provider == myprovider.provider && p.user == myprovider.user) {
                    errorFiles.push(current);
                }
            });
        }
    });
    return errorFiles;
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

function log(message) {
    var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
    var dateString, d = new Date();
    dateString = '[' + d.getDate() + '-' + month[d.getMonth()] + '-' + d.getFullYear().toString().substr(-2) + ' ';
    if (d.getMinutes() > 9) {
        dateString += d.getHours() + ':' + d.getMinutes() + ':';
    } else {
        dateString += d.getHours() + ':0' + d.getMinutes() + ':';
    }
    if (d.getSeconds() > 9) {
        dateString += d.getSeconds() + '] ';
    } else {
        dateString += '0' + d.getSeconds() + '] ';
    }
    Windows.Storage.ApplicationData.current.localFolder.getFileAsync('logs.txt').then(
        function (file) {
            Windows.Storage.FileIO.appendTextAsync(file, dateString + message + '\n').then();
        },
        function (error) {
            Windows.Storage.ApplicationData.current.localFolder.createFileAsync('logs.txt').then(function (file) {
                Windows.Storage.FileIO.appendTextAsync(file, dateString + '##### NEW FILE ######\n');
                Windows.Storage.FileIO.appendTextAsync(file, dateString + message + '\n');
            });
        }
    );
}

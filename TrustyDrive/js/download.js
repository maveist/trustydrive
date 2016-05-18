function downloadChunks(file, myProviders, folder, chunkIdx, writer) {
    var i;
    g_chunks = [];
    for (i = 0; i < myProviders.length; i++) {
        switch (myProviders[i].provider) {
            case 'dropbox':
                dropboxDownload(file, myProviders, folder, chunkIdx + i, myProviders[i], writer);
                break;
            case 'gdrive':
                gdriveDownload(file, myProviders, folder, chunkIdx + i, myProviders[i], writer);
                break;
            case 'onedrive':
                oneDriveDownload(file, myProviders, folder, chunkIdx + i, myProviders[i], writer);
                break;
        }
    }
}

function downloadComplete(file, myProviders, folder, writer) {
    var i, nbRead = 0;
    g_complete++;
    progressBar(g_complete, file['chunks'].length + 1, 'Number of Downloaded Chunks: ' + g_complete);
    if (g_complete % myProviders.length == 0) {
        if (g_chunks.length < myProviders.length) {
            progressBar(g_complete, file['chunks'].length + 1, 'Download error: Try to download it again or check its state in the metadata editor.');
            setTimeout(function () {
                WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
            }, 3000);

        } else {
            g_chunks.sort(function (a, b) {
                return a.idx - b.idx;
            });
            while (nbRead < g_chunks[0].size) {
                for (i = 0; i < myProviders.length; i++) {
                    if (nbRead < g_chunks[i].size) {
                        writer.writeByte(g_chunks[i].reader.readByte());
                    }
                }
                nbRead++;
            }
            for (i = 0 ; i < myProviders.length; i++) {
                g_chunks[i].reader.close();
            }
            if (g_complete < file['chunks'].length) {
                downloadChunks(file, myProviders, folder, g_complete, writer);
            } else {
                log('Download ' + file.name + ' complete');
                writer.storeAsync().done(function () {
                    writer.flushAsync().done(function () {
                        var stream, config, reader, error = '', pwd;
                        var crypto = Windows.Security.Cryptography;
                        var cBuffer = crypto.CryptographicBuffer;
                        if (file.name == g_configName) {
                            stream = writer.detachStream();
                            stream.seek(0);
                            reader = new Windows.Storage.Streams.DataReader(stream);
                            reader.loadAsync(stream.size).then(function () {
                                try {
                                    config = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, reader.readBuffer(stream.size));
                                    config = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, cBuffer.decodeFromBase64String(config));
                                    g_files = JSON.parse(config, function (k, v) {
                                        if (k == g_configName) {
                                            // Do not modify the metadata of the configuration
                                            pwd = v.password;
                                            return g_files[g_configName];
                                        } else {
                                            return v;
                                        }
                                    });
                                    if (pwd == g_files[g_configName].password) {
                                        buildFolderStructure();
                                    } else {
                                        // Delete the metadata
                                        g_files = { [g_configName]: g_files[g_configName] };
                                        error = 'The user "' + g_files[g_configName].user + '" does not exist or the password is incorrect.';
                                    }
                                } catch (ex) {
                                    log('error when parsing configuration: ' + ex);
                                    error = 'The configuration file is malformed. Please check your cloud accounts configuration in Settings'
                                        + ', maybe some providers are missing!'
                                        + '<br>To reset your configuration (<b>all files stored in TrustyDrive will be lost</b>),'
                                        + ' delete the trustydrive folder on the following accounts:<div>';
                                    g_providers.forEach(function (p) {
                                        error += p.provider + ' - ' + p.user + '<br>';
                                    });
                                    error += '</div>';
                                }
                                writer.close();
                                stream.close();
                                reader.close();
                                setTimeout(function () {
                                    if (error.length == 0) {
                                        WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                                    } else {
                                        WinJS.Navigation.navigate('/pages/login/login.html', error);
                                    }
                                }, 1000);
                            });
                        } else {
                            writer.close();
                            setTimeout(function () {
                                WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
                            }, 1000);
                        }
                    });
                });
            }
        }
    }
}

function downloadConfiguration(args) {
    var file = g_files[g_configName];
    var writer;
    if (args == undefined) {
        // Fill args with both valid chunks and valid providers
        args = { 'providers': [], 'chunks': [], 'exists': false, 'all': [], 'idx': -1 };
    }
    args.idx++;
    // Check if configuration chunks exist, configuration = 1 chunk per provider
    if (args.idx < g_providers.length) {
        switch (g_providers[args.idx].provider) {
            case 'dropbox':
                dropboxExists(file['chunks'][args.idx]['name'], g_providers[args.idx], downloadConfiguration, args);
                break;
            case 'gdrive':
                gdriveExists(file['chunks'][args.idx]['name'], g_providers[args.idx], downloadConfiguration, args);
                break;
            case 'onedrive':
                oneDriveExists(file['chunks'][args.idx]['name'], g_providers[args.idx], downloadConfiguration, args);
                break;
        }
    } else {
        if (args['chunks'].length == 0) {
            WinJS.Navigation.navigate('/pages/login/login.html', 'The user "' + file.user + '" does not exist or the password is incorrect.');
        } else if (args['chunks'].length == 1) {
            WinJS.Navigation.navigate('/pages/login/login.html', 'There is only one chunk for metadata. The metadata are illegible!'
                + 'You have to re-create your user.');
        } else {
            file.chunks = args.chunks;
            writer = new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream());
            g_complete = 0;
            progressBar(0, file.chunks.length + 1, 'Initialization', 'Downloading the Configuration');
            downloadChunks(file, args.providers, undefined, g_complete, writer);
        }
    }
}

function downloadFile(file, folder) {
    log('Download the file ' + file.name + ' inside ' + folder.name);
    g_complete = 0;
    progressBar(0, file['chunks'].length + 1, 'Initialization', 'Downloading the File ' + file.name);
    g_workingFolder.createFileAsync(file.name, Windows.Storage.CreationCollisionOption.replaceExisting).done(function (myfile) {
        myfile.openAsync(Windows.Storage.FileAccessMode.readWrite).done(function (output) {
            downloadChunks(file, file.providers, folder, g_complete, new Windows.Storage.Streams.DataWriter(output.getOutputStreamAt(0)));
        });
    });
}

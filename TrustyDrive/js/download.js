function downloadFile(metadata, folder) {
    var i, debug = $('#debug');
    g_complete = 0;
    progressBar(0, metadata['chunks'].length + 1, 'Initialization', 'Downloading the File ' + metadata.name);
    g_workingDir.createFileAsync(metadata.name, Windows.Storage.CreationCollisionOption.replaceExisting).done(function (myfile) {
        myfile.openAsync(Windows.Storage.FileAccessMode.readWrite).done(function (output) {
            var error = false;
            var myProviders = [];
            metadata.providers.forEach(function (p) {
                var fullp = getProvider(p.provider, p.user);
                if (fullp == undefined) {
                    debug.append('Can not download the file: missing the provider ' + p.provider + '/' + p.user + '<br>');
                    error = true;
                } else {
                    myProviders.push(fullp);
                }
            });
            if (error) {
                output.close();
            } else {
                downloadChunks(metadata, myProviders, folder, g_complete, new Windows.Storage.Streams.DataWriter(output.getOutputStreamAt(0)));
            }
        });
    });
}

function downloadChunks(metadata, myProviders, folder, chunkIdx, writer) {
    var i;
    g_chunks = [];
    for (i = 0; i < myProviders.length; i++) {
        dropboxDownload(metadata, myProviders, folder, chunkIdx + i, myProviders[i].token, writer);
    }
}

function downloadComplete(metadata, myProviders, folder, writer) {
    var debug = $('#debug');
    var i, nbRead = 0;
    g_complete++;
    progressBar(g_complete, metadata['chunks'].length + 1, 'Number of Downloaded Chunks: ' + g_complete);
    if (g_complete % myProviders.length == 0) {
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
        if (g_complete < metadata['chunks'].length) {
            downloadChunks(metadata, myProviders, folder, g_complete, writer);
        } else {
            debug.append('Download ' + metadata.name + ' complete<br>');
            writer.storeAsync().done(function () {
                writer.flushAsync().done(function () {
                    var stream, config, reader;
                    var crypto = Windows.Security.Cryptography;
                    var cBuffer = crypto.CryptographicBuffer;
                    if (metadata.name == g_configName) {
                        stream = writer.detachStream();
                        stream.seek(0);
                        reader = new Windows.Storage.Streams.DataReader(stream);
                        reader.loadAsync(stream.size).then(function () {
                            config = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, reader.readBuffer(stream.size));
                            config = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, cBuffer.decodeFromBase64String(config));
                            g_files = JSON.parse(config, function (k, v) {
                                if (k == g_configName) {
                                    // Do not modify the metadata of the configuration
                                    return g_files[g_configName];
                                } else {
                                    return v;
                                }
                            });
                            buildFolderStructure();
                            writer.close();
                            stream.close();
                            reader.close();
                            setTimeout(function () {
                                WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders['home']);
                            }, 1000);
                        });
                    } else {
                        writer.close();
                        setTimeout(function () {
                            WinJS.Navigation.navigate('/pages/file/file.html', { 'md': metadata, 'folder': folder });
                        }, 1000);
                    }
                });
            });
        }
    }
}

function downloadConfiguration() {
    var metadata = g_files[g_configName];
    var writer = new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream());
    var debug = $('#debug');
    g_complete = 0;
    progressBar(0, metadata['chunks'].length + 1, 'Initialization', 'Downloading the Configuration');
    downloadChunks(metadata, g_providers, undefined, g_complete, writer);
}

function downloadChunks(file, chunkIdx, folder, writer) {
    var i;
    g_chunks = [];
    $.each(file.chunks, function (idx, c) {
        switch (c.provider.name) {
            case 'dropbox':
                dropboxDownload(file, c, chunkIdx, idx, folder, writer);
                break;
            case 'gdrive':
                gdriveDownload(file, c, chunkIdx, idx, folder, writer);
                break;
            case 'onedrive':
                oneDriveDownload(file, c, chunkIdx, idx, folder, writer);
                break;
        }
    });
}

function downloadComplete(file, folder, writer) {
    var i, nbRead = 0;
    g_complete++;
    progressBar(g_complete, file.nb_chunks + 1, 'Number of Downloaded Chunks: ' + g_complete);
    if (g_complete % file.chunks.length == 0) {
        // Every buffer is downloaded
        if (g_chunks.length < file.chunks.length) {
            // Missing data
            progressBar(g_complete, file.nb_chunks + 1, 'Download error: Try to download it again or check its state in the metadata editor.');
            setTimeout(function () {
                WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
            }, 3000);
        } else {
            g_chunks.sort(function (a, b) {
                return a.idx - b.idx;
            });
            // Read the largest buffer
            while (nbRead < g_chunks[0].size) {
                for (i = 0; i < g_chunks.length; i++) {
                    if (nbRead < g_chunks[i].size) {
                        writer.writeByte(g_chunks[i].reader.readByte());
                    }
                }
                nbRead++;
            }
            // Close the readers
            for (i = 0 ; i < g_chunks.length; i++) {
                g_chunks[i].reader.close();
            }
            if (g_complete < file.nb_chunks) {
                // There are more chunks to download
                downloadChunks(file, g_complete / file.chunks.length, folder, writer);
            } else {
                log('Download ' + file.name + ' complete');
                writer.storeAsync().done(function () {
                    writer.flushAsync().done(function () {
                        var stream, metadata, reader, error = '', pwd;
                        var crypto = Windows.Security.Cryptography;
                        var cBuffer = crypto.CryptographicBuffer;
                        if (file.name == g_metadataName) {
                            stream = writer.detachStream();
                            stream.seek(0);
                            reader = new Windows.Storage.Streams.DataReader(stream);
                            reader.loadAsync(stream.size).then(function () {
                                try {
                                    metadata = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, reader.readBuffer(stream.size));
                                    metadata = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, cBuffer.decodeFromBase64String(metadata));
                                    g_files = JSON.parse(metadata, function (k, v) {
                                        if (k == g_metadataName) {
                                            // Do not modify the information of the metadata
                                            pwd = v.password;
                                            return g_files[g_metadataName];
                                        } else {
                                            return v;
                                        }
                                    });
                                    if (pwd == g_files[g_metadataName].password) {
                                        buildFolderStructure();
                                        // Add provider information to the metadata
                                        $.each(g_files, function (useless, file) {
                                            file.chunks.forEach(function (c) {
                                                g_providers.forEach(function (fullp) {
                                                    if (c.provider.user == fullp.user && c.provider.name == fullp.name) {
                                                        c.provider = fullp;
                                                    }
                                                });
                                            });
                                        });
                                    } else {
                                        // Delete the metadata
                                        g_files = { [g_metadataName]: g_files[g_metadataName] };
                                        error = 'The user "' + g_files[g_metadataName].user + '" does not exist or the password is incorrect.';
                                    }
                                } catch (ex) {
                                    log('error when parsing metadata: ' + ex);
                                    error = 'The metadata file is malformed. Please check your cloud accounts configuration in Settings'
                                        + ', maybe some providers are missing!'
                                        + '<br>To reset your metadata (<b>all files stored in TrustyDrive will be lost</b>),'
                                        + ' delete the trustydrive folder on the following accounts:<div>';
                                    g_providers.forEach(function (p) {
                                        error += p.name + ' - ' + p.user + '<br>';
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

// Check if metadata chunks exist, metadata = 1 chunk per provider
function downloadMetadata() {
    g_complete = 0;
    g_files[g_metadataName].chunks.forEach(function (c) {
        switch (c.provider.name) {
            case 'dropbox':
                dropboxExists(c, 0, downloadMetadataComplete);
                break;
            case 'gdrive':
                gdriveExists(c, 0, downloadMetadataComplete);
                break;
            case 'onedrive':
                oneDriveExists(c, 0, downloadMetadataComplete);
                break;
        }
    });
}

function downloadMetadataComplete(chunk, chunkIdx) {
    var metadata = g_files[g_metadataName];
    var i, writer;
    g_complete++;
    if (g_complete == metadata.chunks.length) {
        // Remove chunks that do not exist
        for (i = metadata.chunks.length - 1; i > -1; i--) {
            if (!metadata.chunks[i].info[0].exists) {
                metadata.chunks.splice(i, 1);
            }
        }
        if (metadata.chunks.length == 0) {
            WinJS.Navigation.navigate('/pages/login/login.html', 'The user "' + metadata.user + '" does not exist or the password is incorrect.');
        } else if (metadata.chunks.length == 1) {
            WinJS.Navigation.navigate('/pages/login/login.html', 'There is only one chunk for metadata. The metadata are illegible!'
                + 'You have to re-create your user.');
        } else {
            writer = new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream());
            g_complete = 0;
            progressBar(0, metadata.chunks.length + 1, 'Initialization', 'Downloading the Metadata');
            downloadChunks(metadata, 0, undefined, writer);
        }
    }
}

function downloadFile(file, folder) {
    log('Download the file ' + file.name + ' inside ' + folder.name);
    g_complete = 0;
    progressBar(0, file.nb_chunks + 1, 'Initialization', 'Downloading the File ' + file.name);
    g_workingFolder.createFileAsync(file.name, Windows.Storage.CreationCollisionOption.replaceExisting).done(function (myfile) {
        myfile.openAsync(Windows.Storage.FileAccessMode.readWrite).done(function (output) {
            downloadChunks(file, 0, folder, new Windows.Storage.Streams.DataWriter(output.getOutputStreamAt(0)));
        });
    });
}

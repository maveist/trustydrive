function uploadNewFile(folder) {
    // Verify that we are currently not snapped, or that we can unsnap to open the picker
    var currentState = Windows.UI.ViewManagement.ApplicationView.value;
    var filePicker = new Windows.Storage.Pickers.FileOpenPicker();
    if (currentState === Windows.UI.ViewManagement.ApplicationViewState.snapped &&
        !Windows.UI.ViewManagement.ApplicationView.tryUnsnap()) {
        // Fail silently if we can't unsnap
        return;
    }
    // Create the picker object and set options
    filePicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
    filePicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;
    // Users expect to have a filtered view of their folders depending on the scenario.
    // For example, when choosing a documents folder, restrict the filetypes to documents for your application.
    filePicker.fileTypeFilter.replaceAll(['*']);
    // Open the picker for the user to pick a file
    filePicker.pickSingleFileAsync().then(function (file) {
        if (file) {
            // Application now has read/write access to the picked file
            file.openReadAsync().done(
                function (readStream) {
                    uploadChunks(file.name, folder, readStream);
                },
                function (error) {
                    log('Failed to open read stream');
                }
            );
        } else {
            // The picker was dismissed with no selected file
            log('No picked file');
        }
    });
}

function uploadFile(filename, folder) {
    g_workingFolder.getFileAsync(filename).then(function (file) {
        file.openReadAsync().done(function (readStream) {
            uploadChunks(filename, folder, readStream);
        });
    });
}

function uploadChunks(filename, folder, readStream) {
    var i, j, provider, file, nbChunks, chunkName, existingChunks, reader, nbProviders = g_providers.length;
    log('File to Upload: ' + filename + ', size=' + readStream.size);
    if (g_files[filename] == undefined) {
        // Initialize the file metadata
        file = createElement(filename, 'file');
        addToFolder(folder, file);
    } else {
        file = g_files[filename];
    }
    if (filename != g_configName) {
        // Check the provider configuration, an old provider must be in the same place in the current provider list
        if (file.providers.length != g_providers.length) {
            // Delete every chunk of all providers from the file metadata
            for (i = 0; i < file.providers.length; i++) {
                provider = getProvider(file.providers[i].provider, file.providers[i].user);
                if (provider == undefined) {
                    log('Can not get the provider, delete chunks manually');
                } else {
                    log('Delete all chunks from ' + provider.provider + '/' + provider.user);
                    for (j = 0; j < file.chunks.length; j += file.providers.length) {
                        dropboxDelete(file.chunks[i + j], provider.token);
                    }
                }
            }
        } else {
            // Check the providers of the file are the same that the current providers
            for (i = 0; i < g_providers.length; i++) {
                if (file.providers[i].user != g_providers[i].user || file.providers[i].provider != g_providers[i].provider) {
                    provider = getProvider(file.providers[i].provider, file.providers[i].user);
                    if (provider == undefined) {
                        log('Can not get the provider, delete chunks manually');
                    } else {
                        for (j = 0; j < file.chunks.length; j += file.providers.length) {
                            dropboxDelete(file.chunks[i + j], provider.token);
                        }
                    }
                }
            }
        }
    }
    // Set the providers of the file to the current providers
    file['providers'] = [];
    g_providers.forEach(function (p) {
        file.providers.push({ 'provider': p.provider, 'user': p.user });
    });
    // The minimal file size required, 3 bytes on every provider
    if (readStream.size < nbProviders * 3) {
        readStream.close();
        throw "The file is too small. Required size: " + nbProviders * 3;
    }
    // Compute the number of chunks to encode the file
    nbChunks = Math.ceil(readStream.size / g_maxChunkSize);
    if (nbChunks % nbProviders > 0) {
        nbChunks = (Math.trunc(nbChunks / nbProviders) + 1) * nbProviders;
    }
    progressBar(0, nbChunks + 1, 'Initialization', 'Uploading the File ' + filename);
    file['size'] = readStream.size;
    mychunks = file['chunks'];
    if (mychunks.length > nbChunks) {
        mychunks.splice(nbChunks, mychunks.length - nbChunks);
    } else {
        existingChunks = [];
        $.each(g_files, function (useless, file) {
            existingChunks = existingChunks.concat(file.chunks);
        });
        while (mychunks.length < nbChunks) {
            // Generate chunk names that look like a SHA1, i.e., 40 random hexa chars
            do {
                chunkName = '';
                for (j = 0; j < 40; j++) {
                    chunkName += Math.floor(Math.random() * 16).toString(16);
                }
            } while (existingChunks.indexOf(chunkName) > -1);
            mychunks.push(chunkName);
        }
    }
    log('Nb. of Chunks: ' + mychunks.length + ', chunksize=' + Math.floor(readStream.size / mychunks.length));
    reader = new Windows.Storage.Streams.DataReader(readStream.getInputStreamAt(0));
    // Delay the chunk creation to display the progress bar
    setTimeout(function () {
        createChunks(file, folder, reader, Math.floor(readStream.size / mychunks.length), readStream.size % mychunks.length, 0);
    }, 100);
}

function createChunks(file, folder, reader, chunkSize, remainSize, nbCreatedChunks) {
    var temp, tempSize = 0;
    var chunks = [];
    // One chunk per provider
    g_providers.forEach(function (useless) {
        if (remainSize > 0) {
            chunks.push({ 'size': chunkSize + 1, 'stream': new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream()) });
            tempSize += chunkSize + 1;
            remainSize--;
        } else {
            chunks.push({ 'size': chunkSize, 'stream': new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream()) });
            tempSize += chunkSize;
        }
    });
    temp = new Uint8Array(tempSize);
    reader.loadAsync(temp.byteLength).done(function () {
        var i, p, chunkName, idx, d = new Date(), filetype = 'unknown';
        var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
        reader.readBytes(temp);
        for (i = 0; i < temp.byteLength;) {
            for (p = 0; p < g_providers.length; p++) {
                if (i < temp.byteLength) {
                    chunks[p].stream.writeByte(temp[i++]);
                }
            }
        }
        for (p = 0; p < g_providers.length; p++) {
            dropboxUpload(file['chunks'][nbCreatedChunks + p], chunks[p].stream.detachBuffer(), g_providers[p].token);
            chunks[p].stream.close();
        }
        nbCreatedChunks += g_providers.length;
        progressBar(nbCreatedChunks, file['chunks'].length + 1, 'Number of Uploaded Chunks: ' + nbCreatedChunks);
        if (nbCreatedChunks < file['chunks'].length) {
            // Keep creating chunks, delay the chunk creation to update the progress bar
            setTimeout(function () {
                createChunks(file, folder, reader, chunkSize, remainSize, nbCreatedChunks);
            }, 100);
        } else {
            // Upload is complete
            reader.close();
            if (file.name == g_configName) {
                setTimeout(function () {
                    WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                }, 1000);
            } else {
                // Update the last upload date
                file['lastupload'] = d.getDate() + '-' + month[d.getMonth()] + '-' + d.getFullYear().toString().substr(-2) + ' ';
                if (d.getMinutes() > 9) {
                    file['lastupload'] += d.getHours() + ':' + d.getMinutes();
                } else {
                    file['lastupload'] += d.getHours() + ':0' + d.getMinutes();
                }
                // Compute the file type
                idx = file.name.indexOf('.');
                if (idx > -1) {
                    switch (file.name.substr(idx + 1)) {
                        case '7z':
                        case 'tar':
                        case 'tar.gz':
                        case 'zip':
                            filetype = 'archive';
                            break;
                        case 'mp3':
                        case 'wav':
                        case 'ogg':
                        case 'flac':
                            filetype = 'music';
                            break;
                        case 'pdf':
                            filetype = 'pdf';
                            break;
                        case 'bmp':
                        case 'gif':
                        case 'ico':
                        case 'jpg':
                        case 'nef':
                        case 'png':
                            filetype = 'picture';
                            break;
                        case 'c':
                        case 'js':
                        case 'py':
                        case 'sh':
                        case 'bat':
                            filetype = 'script';
                            break;
                        case 'odp':
                        case 'ods':
                        case 'odt':
                        case 'ppt':
                        case 'txt':
                        case 'xls':
                            filetype = 'text';
                            break;
                        case 'avi':
                        case 'mp4':
                            filetype = 'video';
                            break;
                        case 'html':
                        case 'htm':
                        case 'php':
                            filetype = 'web';
                            break;
                        case 'dll':
                        case 'exe':
                            filetype = 'system';
                            break;
                    }
                }
                // End of the file type definition
                file['type'] = filetype;
                setTimeout(uploadConfiguration, 1000);
            }
        }
    });
}

// Configuration management
function uploadConfiguration() {
    var config = JSON.stringify(g_files);
    var crypto = Windows.Security.Cryptography;
    var cBuffer = crypto.CryptographicBuffer;
    // Convert to buffer
    var buffer = cBuffer.convertStringToBinary(config, crypto.BinaryStringEncoding.utf8);
    // Encrypt configuration data
    config = cBuffer.encodeToBase64String(buffer);
    buffer = cBuffer.convertStringToBinary(config, crypto.BinaryStringEncoding.utf8);
    // Save the configuration to the cloud
    var writer = new Windows.Storage.Streams.InMemoryRandomAccessStream();
    writer.writeAsync(buffer);
    g_files[g_configName].chunks.forEach(function (c) {
        log('config chunk: ' + c);
    });
    uploadChunks(g_configName, undefined, writer);
}

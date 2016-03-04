function uploadNewFile(folder) {
    var debug = $('#debug');
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
                    debug.append('Failed to open read stream<br>');
                }
            );
        } else {
            // The picker was dismissed with no selected file
            debug.append('No picked file<br>');
        }
    });
}

function uploadFile(filename, folder) {
    g_workingDir.getFileAsync(filename).then(function (file) {
        file.openReadAsync().done(function (readStream) {
            uploadChunks(filename, folder, readStream);
        });
    });
}

function uploadChunks(filename, folder, readStream) {
    var debug = $('#debug');
    var metadata, nbChunks, reader, nbProviders = g_providers.length;
    debug.append('File to Upload: ' + filename + '<br>');
    debug.append('Size: ' + readStream.size + '<br>');
    if (g_files[filename] == undefined) {
        // Initialize the file metadata
        metadata = createElement(filename, 'file');
        addToFolder(folder, metadata);
    } else {
        metadata = g_files[filename];
    }
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
    metadata['size'] = readStream.size;
    mychunks = metadata['chunks'];
    if (mychunks.length > nbChunks) {
        mychunks.splice(nbChunks, mychunks.length - nbChunks);
    } else {
        while (mychunks.length < nbChunks) {
            mychunks.push(filename.substr(0, 2) + mychunks.length);
        }
    }
    debug.append('Nb. of Chunks: ' + mychunks.length + '<br>');
    reader = new Windows.Storage.Streams.DataReader(readStream.getInputStreamAt(0));
    createChunks(metadata, folder, reader, Math.floor(readStream.size / mychunks.length), readStream.size % mychunks.length, 0);
}

function createChunks(metadata, folder, reader, chunkSize, remainSize, nbCreatedChunks) {
    var debug = $('#debug');
    var temp, firstChunkSize, secondChunkSize;
    debug.append('chunksize: ' + chunkSize + ', remainsize: ' + remainSize + '<br>');
    if (remainSize > 0) {
        firstChunkSize = chunkSize + 1;
        remainSize--;
    } else {
        firstChunkSize = chunkSize;
    }
    if (remainSize > 0) {
        secondChunkSize = chunkSize + 1;
        remainSize--;
    } else {
        secondChunkSize = chunkSize;
    }
    temp = new Uint8Array(firstChunkSize + secondChunkSize);
    reader.loadAsync(temp.byteLength).done(function () {
        var i, chunkName, idx, d = new Date(), filetype = 'unknown';
        var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
        var chunk0 = new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream());
        var chunk1 = new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream());
        reader.readBytes(temp);
        for (i = 0; i < temp.byteLength;) {
            chunk0.writeByte(temp[i++]);
            if (i < temp.byteLength) {
                chunk1.writeByte(temp[i++]);
            }
        }
        debug.append('Creating ' + metadata['chunks'][nbCreatedChunks] + ' and ' + metadata['chunks'][nbCreatedChunks + 1] + '<br>');
        dropboxUpload(metadata['chunks'][nbCreatedChunks], chunk0.detachBuffer(), g_providers[1].token);
        dropboxUpload(metadata['chunks'][nbCreatedChunks + 1], chunk1.detachBuffer(), g_providers[1].token);
        chunk0.close();
        chunk1.close();
        nbCreatedChunks += 2;
        progressBar(nbCreatedChunks, metadata['chunks'].length + 1, 'Number of Uploaded Chunks: ' + nbCreatedChunks);
        if (nbCreatedChunks < metadata['chunks'].length) {
            // Keep creating chunks
            createChunks(metadata, folder, reader, chunkSize, remainSize, nbCreatedChunks);
        } else {
            reader.close();
            // Upload is complete
            if (metadata.name == g_configName) {
                setTimeout(function () {
                    WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders['home']);
                }, 1000);
            } else {
                // Update the last upload date
                metadata['lastupload'] = d.getDate() + '-' + month[d.getMonth()] + '-' + d.getFullYear().toString().substr(-2) + ' ';
                if (d.getMinutes() > 9) {
                    metadata['lastupload'] += d.getHours() + ':' + d.getMinutes();
                } else {
                    metadata['lastupload'] += d.getHours() + ':0' + d.getMinutes();
                }
                // Compute the file type
                idx = metadata.name.indexOf('.');
                if (idx > -1) {
                    switch (metadata.name.substr(idx + 1)) {
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
                        case 'txt':
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
                metadata['type'] = filetype;
                setTimeout(function () {
                    WinJS.Navigation.navigate('/pages/file/file.html', { 'md': metadata, 'folder': folder });
                }, 1000);
            }
        }
    });
}

// Configuration management
function uploadConfiguration() {
    var debug = $('#debug');
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
    uploadChunks(g_configName, undefined, writer);
}

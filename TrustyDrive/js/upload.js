function createChunks(file, folder, reader, chunkSize, remainSize, nbCreatedChunks) {
    var p, temp, tempSize = 0;
    var chunkBuffers = [];
    // One chunk per provider
    for (p = 0; p < g_providers.length; p++) {
        if (remainSize > 0) {
            chunkBuffers.push({ 'created': false, 'size': chunkSize + 1, 'stream': new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream()) });
            tempSize += chunkSize + 1;
            remainSize--;
        } else {
            chunkBuffers.push({ 'created': false, 'size': chunkSize, 'stream': new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream()) });
            tempSize += chunkSize;
        }
    }
    temp = new Uint8Array(tempSize);
    reader.loadAsync(temp.byteLength).done(function () {
        var i;
        reader.readBytes(temp);
        for (i = 0; i < temp.byteLength;) {
            for (p = 0; p < g_providers.length; p++) {
                if (i < g_providers.length && g_providers[p].provider == 'gdrive') {
                    // Add the chunk storage information for Google Drive providers
                    if (file.chunks[nbCreatedChunks + p].id == undefined) {
                        chunkBuffers[p].stream.writeString('--trustydrive_separator\nContent-Type: application/json; charset=UTF-8\n\n'
                            + '{\n"name": "' + file['chunks'][nbCreatedChunks + p]['name'] + '",\n"parents": [ "' + g_cloudFolderId + '" ]\n}\n\n--trustydrive_separator\nContent-Type: application/octet-stream\n\n');
                        chunkBuffers[p].created = true;
                    }
                }
                if (i < temp.byteLength) {
                    chunkBuffers[p].stream.writeByte(temp[i++]);
                }
            }
        }
        for (p = 0; p < g_providers.length; p++) {
            if (chunkBuffers[p].created) {
                // Close the multipart section for Google Drive providers
                chunkBuffers[p].stream.writeString('\n--trustydrive_separator--');
            }
            switch (g_providers[p].provider) {
                case 'dropbox':
                    dropboxUpload(reader, file, nbCreatedChunks + p, chunkBuffers[p].stream.detachBuffer(), g_providers[p]);
                    break;
                case 'gdrive':
                    if (file.chunks[nbCreatedChunks + p].id == undefined) {
                        // Create a new file for the chunk
                        gdriveUpload(reader, file, nbCreatedChunks + p, chunkBuffers[p].stream.detachBuffer(), g_providers[p]);
                    } else {
                        // Update the content of an existing chunk
                        gdriveUpdate(reader, file, nbCreatedChunks + p, chunkBuffers[p].stream.detachBuffer(), g_providers[p]);
                    }
                    break;
                case 'onedrive':
                    oneDriveUpload(reader, file, nbCreatedChunks + p, chunkBuffers[p].stream.detachBuffer(), g_providers[p]);
                    break;
            }
            chunkBuffers[p].stream.close();
        }
        nbCreatedChunks += g_providers.length;
        progressBar(nbCreatedChunks, file['chunks'].length + 1, 'Number of Uploaded Chunks: ' + nbCreatedChunks);
        if (nbCreatedChunks < file['chunks'].length) {
            // Keep creating chunks, delay the chunk creation to update the progress bar
            setTimeout(function () {
                createChunks(file, folder, reader, chunkSize, remainSize, nbCreatedChunks);
            }, 100);
        }
    });
}

function uploadComplete(reader, file) {
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
    var idx, d = new Date(), filetype = 'unknown';
    g_complete++;
    if (g_complete == file.chunks.length) {
        // Upload is complete
        reader.close();
        if (file.name == g_metadataName) {
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
            setTimeout(uploadMetadata, 1000);
        }
    }
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
    if (filename != g_metadataName) {
        // Check the provider metadata, an old provider must be in the same place in the current provider list
        if (file.providers.length != g_providers.length) {
            // Delete every chunk of all providers from the file metadata
            for (i = 0; i < file.providers.length; i++) {
                log('Delete all chunks from ' + file.providers[i].provider + '/' + file.providers[i].user);
                for (j = 0; j < file.chunks.length; j += file.providers.length) {
                    switch (file.providers[i].provider) {
                        case 'dropbox':
                            dropboxDelete(file.chunks[i + j]['name'], file.providers[i], file.chunks.length, g_folders[g_homeFolderName]);
                            break;
                        case 'gdrive':
                            gdriveDelete(file.chunks[i + j]['id'], file.providers[i], file.chunks.length, g_folders[g_homeFolderName]);
                            break;
                        case 'onedrive':
                            oneDriveDelete(file.chunks[i + j]['id'], file.providers[i], file.chunks.length, g_folders[g_homeFolderName]);
                            break;
                    }
                }
            }
        } else {
            // Check the providers of the file are the same that the current providers
            //    for (i = 0; i < g_providers.length; i++) {
            //        if (file.providers[i].user != g_providers[i].user || file.providers[i].provider != g_providers[i].provider) {
            //            for (j = 0; j < file.chunks.length; j += file.providers.length) {
            //                switch (provider.provider) {
            //                    case 'dropbox':
            //                        dropboxDelete(file.chunks[i + j]['name'], file.providers[i], file.chunks.length, g_folders[g_homeFolderName]);
            //                        break;
            //                    case 'gdrive':
            //                        gdriveDelete(file.chunks[i + j]['id'], file.providers[i], file.chunks.length, g_folders[g_homeFolderName]);
            //                        break;
            //                    case 'onedrive':
            //                        oneDriveDelete(file.chunks[i + j]['id'], file.providers[i], file.chunks.length, g_folders[g_homeFolderName]);
            //                        break;
            //                }
            //            }
            //        }
            //    }
        }
    }
    // Set the providers of the file to the current providers
    file.providers = [];
    if (filename == g_metadataName) {
        existingChunks = file.chunks.slice(0);
        file.chunks = [];
    }
    g_providers.forEach(function (p) {
        var index;
        file.providers.push(p);
        if (filename == g_metadataName) {
            index = indexOfChunk(existingChunks, metadataChunkName(p));
            // Generate chunk names for the metadata
            if (index == -1) {
                file.chunks.push({ 'name': metadataChunkName(p) });
            } else {
                file.chunks.push(existingChunks[index]);
            }
        }
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
            file.chunks.forEach(function (c) {
                existingChunks.push(c.name);
            });
        });
        while (mychunks.length < nbChunks) {
            // Generate chunk names that look like a SHA1, i.e., 40 random hexa chars
            do {
                chunkName = '';
                for (j = 0; j < 40; j++) {
                    chunkName += Math.floor(Math.random() * 16).toString(16);
                }
            } while (existingChunks.indexOf(chunkName) > -1);
            mychunks.push({ 'name': chunkName });
        }
    }
    log('Nb. of Chunks: ' + mychunks.length + ', chunksize=' + Math.floor(readStream.size / mychunks.length));
    reader = new Windows.Storage.Streams.DataReader(readStream.getInputStreamAt(0));
    // Counter for the number of upload chunks
    g_complete = 0;
    // Delay the chunk creation to display the progress bar
    setTimeout(function () {
        createChunks(file, folder, reader, Math.floor(readStream.size / mychunks.length), readStream.size % mychunks.length, 0);
    }, 100);
}

// Metadata management
function uploadMetadata() {
    // Check the number of providers
    if (g_providers.length < 2) {
        WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
    } else {
        // Remove tokens from providers
        var metadata = $.extend(true, {}, g_files);
        $.each(metadata, function (useless, file) {
            var minimize = [];
            file.providers.forEach(function (p) {
                minimize.push({ 'user': p.user, 'provider': p.provider });
            });
            file.providers = minimize;
        });
        // Build the JSON
        metadata = JSON.stringify(metadata);
        // TEST
        Windows.Storage.ApplicationData.current.localFolder.createFileAsync('metadata.txt', Windows.Storage.CreationCollisionOption.replaceExisting).then(function (file) {
            Windows.Storage.FileIO.writeTextAsync(file, JSON.stringify(metadata)).done();
        });
        // TEST END
        var crypto = Windows.Security.Cryptography;
        var cBuffer = crypto.CryptographicBuffer;
        // Convert to buffer
        var buffer = cBuffer.convertStringToBinary(metadata, crypto.BinaryStringEncoding.utf8);
        // Encrypt metadata data
        metadata = cBuffer.encodeToBase64String(buffer);
        buffer = cBuffer.convertStringToBinary(metadata, crypto.BinaryStringEncoding.utf8);
        // Save the metadata to the cloud
        var writer = new Windows.Storage.Streams.InMemoryRandomAccessStream();
        writer.writeAsync(buffer);
        uploadChunks(g_metadataName, undefined, writer);
    }
}

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
        var existing;
        if (file) {
            // Application now has read/write access to the picked file
            existing = g_files[file.name];
            if (existing != undefined) {
                var html = '<div class="interface-question">';
                html += 'The file <b>' + file.name + '</b> already exists in <b>' + g_homeFolderName + existing.path + '</b>!<br>';
                html += 'This action will overwrite the existing file. Would you like to upload a new version of this file?<br>';
                html += '<br><br><div id="upload-button" class="interface-button">UPLOAD</div>' +
                    '<div id="cancel-button" class="interface-button">CANCEL</div>';
                html += '</div>';
                $('.interface-body').empty();
                $('.user-interface').show();
                $('.interface-body').append(html);
                $('#upload-button').click(function () {
                    file.openReadAsync().done(
                        function (readStream) {
                            uploadChunks(file.name, folder, readStream);
                        },
                        function (error) {
                            log('Failed to open read stream');
                        }
                    );
                });
                $('#cancel-button').click(function () {
                    $('.user-interface').hide();
                });
            } else {
                file.openReadAsync().done(
                    function (readStream) {
                        uploadChunks(file.name, folder, readStream);
                    },
                    function (error) {
                        log('Failed to open read stream');
                    }
                );
            }
        } else {
            // The picker was dismissed with no selected file
            log('No picked file');
        }
    });
}

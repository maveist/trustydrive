/***
*   createChunks: create chunks on cloud providers
*       file: the file metadata
*       reader: the reader to read the data to upload
*       chunkSize: the minimum size of one chunk
*       remainSize: increase the chunkSize of one byte if remainSize > 0
*       chunkIdx: the index of the chunk to upload
***/
function createChunks(file, reader, chunkSize, remainSize, chunkIdx) {
    var i, temp, tempSize = 0;
    var chunkBuffers = [];
    // One chunk buffer per provider
    for (i = 0; i < file.chunks.length; i++) {
        if (remainSize > 0) {
            chunkBuffers.push({ 'created': false, 'size': chunkSize + 1, 'stream': new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream()) });
            tempSize += chunkSize + 1;
            remainSize--;
        } else {
            chunkBuffers.push({ 'created': false, 'size': chunkSize, 'stream': new Windows.Storage.Streams.DataWriter(new Windows.Storage.Streams.InMemoryRandomAccessStream()) });
            tempSize += chunkSize;
        }
    }
    //WARN: Memory consumption is tempSize = nb. of providers * chunkSize
    temp = new Uint8Array(tempSize);
    reader.loadAsync(temp.byteLength).done(function () {
        reader.readBytes(temp);
        // Fill buffers with data
        for (i = 0; i < temp.byteLength;) {
            $.each(file.chunks, function (idx, c) {
                if (i < file.chunks.length && c.provider.name == 'gdrive') {
                    // Add the chunk storage information at the begin of the chunk for GoogleDrive providers
                    if (c.info[chunkIdx].id == undefined) {
                        chunkBuffers[idx].stream.writeString('--trustydrive_separator\nContent-Type: application/json; charset=UTF-8\n\n'
                            + '{\n"name": "' + c.info[chunkIdx].name + '",\n"parents": [ "' + g_cloudFolderId
                            + '" ]\n}\n\n--trustydrive_separator\nContent-Type: application/octet-stream\n\n');
                        chunkBuffers[idx].created = true;
                    }
                }
                if (i < temp.byteLength) {
                    chunkBuffers[idx].stream.writeByte(temp[i++]);
                }
            });
        }
        // Write buffers to the cloud
        $.each(file.chunks, function (idx, c) {
            if (chunkBuffers[idx].created) {
                // Close the multipart section for Google Drive providers
                chunkBuffers[idx].stream.writeString('\n--trustydrive_separator--');
            }
            switch (c.provider.name) {
                case 'dropbox':
                    dropboxUpload(reader, file, c, chunkIdx, chunkBuffers[idx].stream.detachBuffer());
                    break;
                case 'gdrive':
                    if (c.info[chunkIdx].id == undefined) {
                        // Create a new file for the chunk
                        gdriveUpload(reader, file, c, chunkIdx, chunkBuffers[idx].stream.detachBuffer());
                    } else {
                        // Update the content of an existing chunk
                        gdriveUpdate(reader, file, c, chunkIdx, chunkBuffers[idx].stream.detachBuffer());
                    }
                    break;
                case 'onedrive':
                    oneDriveUpload(reader, file, c, chunkIdx, chunkBuffers[idx].stream.detachBuffer());
                    break;
            }
            chunkBuffers[idx].stream.close();
        });
        chunkIdx++;
        if (chunkIdx * file.chunks.length < file.nb_chunks) {
            // Keep creating chunks, delay the chunk creation to update the progress bar
            setTimeout(function () {
                createChunks(file, reader, chunkSize, remainSize, chunkIdx);
            }, 100);
        }
    });
}

/***
*   uploadComplete: call this function after uploading one chunk
*       reader: the reader to read the data to upload
*       file: the file metadata
***/
function uploadComplete(reader, file) {
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
    var idx, d = new Date(), filetype = 'unknown';
    g_complete++;
    progressBar(g_complete, file.nb_chunks + 1, 'Number of Uploaded Chunks: ' + g_complete);
    if (g_complete == file.nb_chunks) {
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

/***
*   uploadChunks: compute the number of chunks required to upload one file
*       filename: the name of the file
*       folder: the folder that will contain the file in TrustyDrive
*       readStream: the stream opened from the file to upload
***/
function uploadChunks(filename, folder, readStream) {
    var file, nbChunks, nbProviders = g_providers.length;
    if (g_files[filename] == undefined) {
        // Initialize the file metadata
        file = createElement(filename, 'file');
        addToFolder(folder, file);
    } else {
        file = g_files[filename];
    }
    // The minimal file size required, 3 bytes on every provider
    if (readStream.size < nbProviders * 3) {
        readStream.close();
        throw "The file is too small. Required size: " + nbProviders * 3;
        WinJS.Navigation.navigate('/pages/login/login.html', 'The file is too small. Required minimal size: ' + nbProviders * 3);
    }
    // Compute the number of chunks per provider
    nbChunks = Math.ceil(readStream.size / g_maxChunkSize / g_providers.length);
    file['size'] = readStream.size;
    file['nb_chunks'] = nbChunks * g_providers.length;
    if (file.name == g_metadataName) {
        if (file.nb_chunks > g_providers.length) {
            readStream.close();
            WinJS.Navigation.navigate('/pages/login/login.html', 'The maximum number of files is reached. You can not upload new files!');
        } else {
            startUpload(file, readStream, folder);
        }
    } else {
        // Check the number of providers
        if (file.chunks.length < nbProviders) {
            g_providers.forEach(function (p) {
                var notfound = file.chunks.every(function (c) {
                    if (c.provider.name == p.name && c.provider.user == p.user) {
                        return false;
                    } else {
                        return true;
                    }
                });
                if (notfound) {
                    file.chunks.push({ 'provider': p, 'info': [] });
                }
            });
        }
        // Fill the file structure with the right number of chunks
        removeChunks(file, readStream, nbChunks, folder);
    }
}

/***
*   removeChunks: remove the chunks that are no longer required
*       file: the file metadata
*       readStream: the stream opened from the file to upload
*       nbChunks: the number of chunks required per provider
*       folder: the folder to display after uploading the file
***/
function removeChunks(file, readStream, nbChunks, folder) {
    var removed = [];
    file.chunks.forEach(function (c) {
        var temp;
        if (c.info.length > nbChunks) {
            temp = c.info.splice(nbChunks, c.info.length - nbChunks);
            temp.forEach(function (t) {
                removed.push({ 'provider': c.provider, 'name': t.name, 'id': t.id });
            });
        }
    });
    if (removed.length == 0) {
        // No chunk to delete
        addChunks(file, readStream, nbChunks, folder);
    } else {
        // Delete useless chunks
        g_complete = 0;
        progressBar(g_complete, removed.length + 1, 'Initialization', 'Delete Outdated Chunks');
        removed.forEach(function (r) {
            switch (r.provider.name) {
                case 'dropbox':
                    setTimeout(function () {
                        dropboxDelete(r.name, r.provider, removed.length, function () {
                            addChunks(file, readStream, nbChunks, folder);
                        });
                    }, 500);
                    break;
                case 'gdrive':
                    setTimeout(function () {
                        gdriveDelete(r.id, r.provider, removed.length, function () {
                            addChunks(file, readStream, nbChunks, folder);
                        });
                    }, 500);
                    break;
                case 'onedrive':
                    setTimeout(function () {
                        oneDriveDelete(r.id, r.provider, removed.length, function () {
                            addChunks(file, readStream, nbChunks, folder);
                        });
                    }, 500);
                    break;
            }
        });
    }
}

/***
*   addChunks: create chunk information to upload the file
*       file: the file metadata
*       readStream: the stream opened from the file to upload
*       nbChunks: the number of chunks required per provider
*       folder: the folder to display after uploading the file
***/
function addChunks(file, readStream, nbChunks, folder) {
    // Compute all existing chunk names
    var existingChunks = [];
    $.each(g_files, function (useless, file) {
        file.chunks.forEach(function (c) {
            c.info.forEach(function (i) {
                existingChunks.push(i.name);
            });
        });
    });
    // Generate chunk names that look like a SHA1, i.e., 40 random hexa chars
    file.chunks.forEach(function (c) {
        var j, chunkName;
        while (c.info.length < nbChunks) {
            do {
                chunkName = '';
                for (j = 0; j < 40; j++) {
                    chunkName += Math.floor(Math.random() * 16).toString(16);
                }
            } while (existingChunks.indexOf(chunkName) > -1);
            c.info.push({ 'name': chunkName });
            existingChunks.push(chunkName);
        }
    });
    startUpload(file, readStream);
}

/***
*   startUpoad: start to upload chunks to cloud providers
*       file: the file metadata
*       readStream: the stream opened from the file to upload
*       folder: the folder to display after uploading the file
***/
function startUpload(file, readStream) {
    var reader = new Windows.Storage.Streams.DataReader(readStream.getInputStreamAt(0));
    var chunkSize = Math.floor(readStream.size / file.nb_chunks);
    progressBar(0, file.nb_chunks + 1, 'Initialization', 'Uploading the File ' + file.name);
    // Counter for the number of upload chunks
    g_complete = 0;
    // Delay the chunk creation to display the progress bar
    setTimeout(function () {
        createChunks(file, reader, chunkSize, readStream.size % file.nb_chunks, 0);
    }, 100);
}

/***
*   uploadMetadata: build, encrypt and upload the metadata
***/
function uploadMetadata() {
    var metadata, crypto, cBuffer, readStream, metadataChunks = g_files[g_metadataName].chunks;
    // Check the number of providers
    if (g_providers.length < 2) {
        WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
    } else {
        // Build data from the metadata
        metadata = $.extend(true, {}, g_files);
        $.each(metadata, function (filename, file) {
            if (filename == g_metadataName) {
                // Minimize the information about metadata
                metadata[filename] = { 'name': g_metadataName, 'user': file.user, 'password': file.password, 'chunks': [] };
            } else {
                // Remove tokens from providers
                file.chunks.forEach(function (c) {
                    c.provider = { 'name': c.provider.name, 'user': c.provider.user };
                    c.info.forEach(function (i) {
                        delete i.exists;
                    });
                });
            }
        });
        // Build the JSON
        metadata = JSON.stringify(metadata);
        crypto = Windows.Security.Cryptography;
        cBuffer = crypto.CryptographicBuffer;
        // Convert to buffer
        buffer = cBuffer.convertStringToBinary(metadata, crypto.BinaryStringEncoding.utf8);
        // Encrypt metadata data
        metadata = cBuffer.encodeToBase64String(buffer);
        buffer = cBuffer.convertStringToBinary(metadata, crypto.BinaryStringEncoding.utf8);
        // Save the metadata to the cloud
        readStream = new Windows.Storage.Streams.InMemoryRandomAccessStream();
        readStream.writeAsync(buffer);
        // Synchronize the provider list and the metadata chunks
        $.each(g_providers, function (idx, p) {
            if (idx == metadataChunks.length) {
                metadataChunks.push({ 'provider': p, 'info': [{ 'name': metadataChunkName(p) }] });
            } else {
                if (!(metadataChunks[idx].provider.name == p.name && metadataChunks[idx].provider.user == p.user)) {
                    // Insert a new chunk for this provider
                    metadataChunks.splice(idx, 0, { 'provider': p, 'info': [{ 'name': metadataChunkName(p) }] });
                }
            }
        });
        uploadChunks(g_metadataName, undefined, readStream);
    }
}

/***
*   metadataExists: check if metadata chunks exist
***/
function metadataExists() {
    g_complete = 0;
    g_files[g_metadataName].chunks.forEach(function (c) {
        switch (c.provider.name) {
            case 'dropbox':
                dropboxExists(c, 0, metadataExistsComplete);
                break;
            case 'gdrive':
                gdriveExists(c, 0, metadataExistsComplete);
                break;
            case 'onedrive':
                oneDriveExists(c, 0, metadataExistsComplete);
                break;
        }
    });
}


/***
*   metadataExistsComplete: upload the metadata only if every chunks do not exist
***/
function metadataExistsComplete() {
    var metadata = g_files[g_metadataName];
    var exists = false;
    g_complete++;
    if (g_complete == metadata.chunks.length) {
        metadata.chunks.forEach(function (c) {
            exists |= c.info[0].exists;
        });
        if (exists) {
            $('#new-error').html('<b>The user already exists!</b>');
        } else {
            uploadMetadata();
        }
    }
}


/***
*   uploadNewFile: select and upload a new file
*       folder: the folder that will contain the file
***/
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
                    file.openReadAsync().done(function (readStream) {
                        uploadChunks(file.name, folder, readStream);
                    });
                });
                $('#cancel-button').click(function () {
                    $('.user-interface').hide();
                });
            } else {
                file.openReadAsync().done(function (readStream) {
                    uploadChunks(file.name, folder, readStream);
                });
            }
        }
    });
}

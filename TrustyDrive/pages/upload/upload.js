// Initialize the upload page
WinJS.UI.Pages.define('/pages/upload/upload.html', {
    ready: function () {
        // Add click listeners
        $('#upload-button').click(uploadFile);
    }
});

function uploadFile() {
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
            file.getBasicPropertiesAsync().done(function (props) {
                file.openReadAsync().done(
                    function (readStream) {
                        uploadChunks(file.name, readStream);
                    },
                    function (error) {
                        debug.append('Failed to open read stream<br>');
                    }
                );
            });
        } else {
            // The picker was dismissed with no selected file
            debug.append('No picked photo<br>');
        }
    });
}

function uploadChunks(filename, readStream) {
    var debug = $('#debug');
    var metadata, nbChunks, maxChunkSize = 10000, nbProviders = g_providers.length;
    debug.append('Picked file: ' + filename + '<br>');
    debug.append('Size: ' + readStream.size + '<br>');
    if (g_metadata[filename] == undefined) {
        // Initialize the file metadata
        metadata = { 'name': filename, 'chunks': [] };
        g_metadata[filename] = metadata;
    } else {
        metadata = g_metadata[filename];
    }
    // The minimal file size required, 3 bytes on every provider
    if (readStream.size < nbProviders * 3) {
        throw "The file is too small. Required size: " + nbProviders * 3;
    }
    // Compute the number of chunks to encode the file
    nbChunks = Math.ceil(readStream.size / maxChunkSize);
    if (nbChunks % nbProviders > 0) {
        nbChunks = (Math.trunc(nbChunks / nbProviders) + 1) * nbProviders;
    }
    mychunks = metadata['chunks'];
    debug.append('nb of chunks: ' + mychunks.length + '<br>');
    if (mychunks.length > nbChunks) {
        mychunks.splice(nbChunks, mychunks.length - nbChunks);
        //TODO: delete the existing chunks - dropboxDelete()
    } else {
        while (mychunks.length < nbChunks) {
            mychunks.push('chunk' + mychunks.length);
        }
    }
    createChunks(metadata, readStream.getInputStreamAt(0), Math.floor(readStream.size / mychunks.length), readStream.size % mychunks.length, 0);
}

function createChunks(metadata, readStream, chunkSize, remainSize, nbCreatedChunks) {
    var debug = $('#debug');
    debug.append('chunksize: ' + chunkSize + ', remainsize: ' + remainSize + '<br>');
    var temp, firstChunkSize, secondChunkSize;
    var reader = new Windows.Storage.Streams.DataReader(readStream);
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
        var i, chunkName;
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
        nbCreatedChunks += 2;
        if (nbCreatedChunks < metadata['chunks'].length) {
            // Keep creating chunks
            createChunks(metadata, readStream, chunkSize, remainSize, nbCreatedChunks);
        }
    });
}

// Configuration management
function uploadConfiguration() {
    var debug = $('#debug');
    var config = JSON.stringify(g_metadata);
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
    uploadChunks(g_configName, writer);
}

function downloadConfiguration() {
    downloadFile({ 'data': { 'filename': g_configName } });
}

function loadConfiguration() {
    var debug = $('#debug');
    g_workingDir.getFileAsync(g_configName).done(function (configFile) {
        Windows.Storage.FileIO.readBufferAsync(configFile).done(function (buffer) {
            var config, encoded;
            var crypto = Windows.Security.Cryptography;
            var cBuffer = crypto.CryptographicBuffer;
            encoded = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, buffer);
            config = cBuffer.decodeFromBase64String(encoded);
            encoded = cBuffer.convertBinaryToString(crypto.BinaryStringEncoding.utf8, config);
            g_metadata = JSON.parse(encoded);
        });
    });
}

(function () {
    WinJS.UI.Pages.define('/pages/upload/upload.html', {
        ready: function () {
            // Add click listeners
            $('#upload-button').click(uploadFile);
        }
    });

    function uploadFile() {
        // Verify that we are currently not snapped, or that we can unsnap to open the picker
        var currentState = Windows.UI.ViewManagement.ApplicationView.value;
        if (currentState === Windows.UI.ViewManagement.ApplicationViewState.snapped &&
            !Windows.UI.ViewManagement.ApplicationView.tryUnsnap()) {
            // Fail silently if we can't unsnap
            return;
        }
        // Create the picker object and set options
        var filePicker = new Windows.Storage.Pickers.FileOpenPicker();
        filePicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
        filePicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;
        // Users expect to have a filtered view of their folders depending on the scenario.
        // For example, when choosing a documents folder, restrict the filetypes to documents for your application.
        filePicker.fileTypeFilter.replaceAll(['*']);

        // Open the picker for the user to pick a file
        var debug = $('#debug');
        filePicker.pickSingleFileAsync().then(function (file) {
            if (file) {
                // Application now has read/write access to the picked file
                file.getBasicPropertiesAsync().done(function (props) {
                    debug.append('Picked file: ' + file.name + '<br>');
                    debug.append('Size: ' + props.size + '<br>');
                    file.openReadAsync().done(
                        function (readStream) {
                            createChunks(readStream.getInputStreamAt(0), props.size, 10, 0);
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

    function createChunks(readStream, fileSize, chunkSize, nbChunks) {
        var temp, realSize;
        var reader = new Windows.Storage.Streams.DataReader(readStream);
        // Is there data enough to fill 2 chunks
        var remainData = fileSize - nbChunks * chunkSize;
        if (chunkSize * 2 > remainData) {
            temp = new Uint8Array(remainData);
        } else {
            temp = new Uint8Array(chunkSize * 2);
        }
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
            chunkName = 'first' + nbChunks + '.txt';
            if (g_metadata['toto.txt']['chunks'].indexOf(chunkName) == -1) {
                g_metadata['toto.txt']['chunks'].push(chunkName);
            }
            dropboxUpload(chunkName, chunk0.detachBuffer(), g_providers[1].token);
            chunkName = 'second' + nbChunks + '.txt';
            if (g_metadata['toto.txt']['chunks'].indexOf(chunkName) == -1) {
                g_metadata['toto.txt']['chunks'].push(chunkName);
            }
            dropboxUpload(chunkName, chunk1.detachBuffer(), g_providers[1].token);
            nbChunks += 2;
            if (fileSize - nbChunks * chunkSize > 0) {
                // Keep creating chunks
                createChunks(readStream, fileSize, chunkSize, nbChunks);
            }
        });
    }
})();

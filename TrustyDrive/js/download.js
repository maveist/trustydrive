function downloadFile(event) {
    var metadata = g_metadata[event.data.filename];
    var idx, chunks = metadata['chunks'];
    var debug = $('#debug');
    g_complete = 0;
    progressBar(g_complete, chunks.length + 2, 'Initialization', 'Downloading the File ' + metadata.name);
    for (idx = 0; idx < chunks.length; idx++) {
        dropboxDownload(metadata, idx, g_providers[1].token);
    }
}

function downloadComplete(metadata) {
    var debug = $('#debug');
    g_complete++;
    progressBar(g_complete, metadata['chunks'].length + 2, 'Number of Downloaded Chunks: ' + g_complete);
    if (g_complete == metadata['chunks'].length) {
        generateFile(metadata);
    }
}

function generateFile(metadata) {
    var debug = $('#debug');
    debug.append('Generate the file: ' + metadata.name + '<br>');
    progressBar(g_complete + 1, metadata['chunks'].length + 2, 'Building the file ' + metadata.name);
    // Get chunk names from file metadata and iterate on all chunks
    g_workingDir.createFileAsync(metadata.name, Windows.Storage.CreationCollisionOption.replaceExisting).done(function (myfile) {
        myfile.openAsync(Windows.Storage.FileAccessMode.readWrite).done(function (output) {
            var writer = new Windows.Storage.Streams.DataWriter(output.getOutputStreamAt(0));
            var i, chunks = metadata['chunks'], builder;
            assembleFile(metadata.name, writer, 0, chunks);
        });
    });
}

function assembleFile(filename, writer, idx, chunks) {
    var debug = $('#debug');
    // Read two chunks
    g_workingDir.getFileAsync(chunks[idx]).done(function (part0) {
        part0.openReadAsync().done(function (stream0) {
            var size0 = stream0.size;
            var reader0 = new Windows.Storage.Streams.DataReader(stream0.getInputStreamAt(0));
            g_workingDir.getFileAsync(chunks[idx + 1]).done(function (part1) {
                part1.openReadAsync().done(function (stream1) {
                    var j, b0, b1;
                    var size1 = stream1.size;
                    var reader1 = new Windows.Storage.Streams.DataReader(stream1.getInputStreamAt(0));
                    reader0.loadAsync(size0).done(function () {
                        reader1.loadAsync(size1).done(function () {
                            for (j = 0; j < size0; j++) {
                                b0 = reader0.readByte();
                                writer.writeByte(b0);
                                if (j < size1) {
                                    b1 = reader1.readByte();
                                    writer.writeByte(b1);
                                }
                            }
                            writer.storeAsync().done(function () {
                                writer.flushAsync().done(function () {
                                    // Writing chunks to the file is completed
                                    reader0.close();
                                    reader1.close();
                                    // Parse the next chunks
                                    idx += 2;
                                    if (idx < chunks.length) {
                                        assembleFile(filename, writer, idx, chunks);
                                    } else {
                                        debug.append('File generation complete<br>');
                                        writer.close();
                                        if (filename != g_configName) {
                                            setTimeout(function () {
                                                WinJS.Navigation.navigate('/pages/file/file.html', filename);
                                            }, 1000);
                                        }
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

function downloadConfiguration() {
    downloadFile({ 'data': { 'filename': g_configName } });
}

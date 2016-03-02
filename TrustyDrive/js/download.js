function downloadFile(event) {
    var metadata = g_metadata[event.data.filename];
    var idx, chunks = metadata['chunks'];
    var debug = $('#debug');
    g_complete = 0;
    chunks.forEach(function (c) {
        debug.append('conf: ' + c + ' - p: ' + g_providers.length + '<br>');
    });
    progressBar(0, chunks.length + 1, 'Initialization', 'Downloading the File ' + metadata.name);
    g_workingDir.createFileAsync(metadata.name, Windows.Storage.CreationCollisionOption.replaceExisting).done(function (myfile) {
        myfile.openAsync(Windows.Storage.FileAccessMode.readWrite).done(function (output) {
            downloadChunks(metadata, g_complete, new Windows.Storage.Streams.DataWriter(output.getOutputStreamAt(0)));
        });
    });
}

function downloadChunks(metadata, chunkIdx, writer) {
    var i;
    g_chunks = [];
    for (i = 0; i < g_providers.length; i++) {
        $('#debug').append('download ' + (chunkIdx + i) + '<br>');
        dropboxDownload(metadata, chunkIdx + i, g_providers[1].token, writer);
    }
}

function downloadComplete(metadata, writer) {
    var debug = $('#debug');
    var i, nbRead = 0;
    g_complete++;
    $('#debug').append('Complete download<br>');
    progressBar(g_complete, metadata['chunks'].length + 1, 'Number of Downloaded Chunks: ' + g_complete);
    if (g_complete % g_providers.length == 0) {
        g_chunks.sort(function (a, b) {
            return a.idx - b.idx;
        });
        while (nbRead < g_chunks[0].size) {
            for (i = 0; i < g_providers.length; i++) {
                if (nbRead < g_chunks[i].size) {
                    writer.writeByte(g_chunks[i].reader.readByte());
                }
            }
            nbRead++;
        }
        for (i = 0 ; i < g_providers.length; i++) {
            g_chunks[i].reader.close();
        }
        if (g_complete < metadata['chunks'].length) {
            downloadChunks(metadata, g_complete, writer);
        } else {
            debug.append('Download ' + metadata.name + ' complete<br>');
            writer.storeAsync().done(function () {
                writer.flushAsync().done(function () {
                    writer.close();
                    setTimeout(function () {
                        WinJS.Navigation.navigate('/pages/file/file.html', metadata.name);
                    }, 1000);
                });
            });
        }
    }
}

function downloadConfiguration() {
    downloadFile({ 'data': { 'filename': g_configName } });
}

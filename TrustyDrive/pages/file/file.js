WinJS.UI.Pages.define('/pages/file/file.html', {
    ready: function () {
        var debug = $('#debug');
        var filename = WinJS.Navigation.state;
        var metadata = g_metadata[filename];
        $('#filename').append(metadata.name);
        $('#type').append('Script');
        metadata['chunks'].forEach(function (c) {
            $('#chunks').append(c + '<br>');
        });
        $('#download-button').text('Download ' + filename).click({ 'filename': filename }, downloadFile);
        $('#open-button').text('Open ' + filename).click({ 'filename': filename }, showInExplorer);
    }
})

function showInExplorer(event) {
    g_workingDir.getFileAsync(event.data.filename).done(function (file) {
        Windows.System.Launcher.launchFileAsync(file);
    });
}

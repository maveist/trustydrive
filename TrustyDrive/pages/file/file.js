/*** About File Status
    On the Cloud: the file does not exist on the working directory (local storage)
    On the Local Drive: The file belongs to the working directory
    To Be Uploaded: The file belongs to the working directory and the file size is different of the cloud size
***/

WinJS.UI.Pages.define('/pages/file/file.html', {
    ready: function () {
        var debug = $('#debug');
        var size;
        // Get parameters
        var filename = WinJS.Navigation.state;
        var metadata = g_metadata[filename];
        // Menu location
        var height = $('#content').innerHeight();
        if (filename == g_configName) {
            WinJS.Navigation.navigate('/pages/mydocuments/mydocuments.html', g_configName);
        } else {
            // Add click listeners
            $('.upper-settings').click(function () {
                WinJS.Navigation.navigate('/pages/settings/settings.html');
            });
            $('.upper-back').click({ 'folder': 'home' }, displayFolder);
            $('.cloud-delete').click({ 'md': metadata }, cloudDelete);
            $('.download').click({ 'filename': metadata.name }, downloadFile);
            // Display the file metadata
            $('.upper-title').append(metadata.name);
            $('.file-icon').css('background', 'url(../../images/style/' + metadata.type + '-big.png) no-repeat');
            $('#file-type').html(metadata.type.substr(0, 1).toUpperCase() + metadata.type.substr(1) + ' File');
            size = sizeString(metadata.size);
            $('#file-size').html(size.value + ' ' + size.unit);
            $('#file-upload').html(metadata.lastupload);
            var status = $('#file-status');
            g_workingDir.getFileAsync(metadata.name).then(
                function (file) {
                    $('.menu-bar').css('top', height - 120);
                    $('.upload').click({ 'filename': metadata.name }, uploadFile);
                    $('.open').click({ 'filename': metadata.name }, openFile);
                    $('.local-delete').click({ 'filename': metadata.name }, localDelete);
                    file.getBasicPropertiesAsync().done(function (props) {
                        if (props.size == metadata.size) {
                            status.html('On the Local Drive');
                        } else {
                            status.html('To Be Upload');
                        }
                    });
                },
                function (error) {
                    $('.menu-bar').css('top', height - 60);
                    $('.menu-container')[0].remove();
                    status.html('On the Cloud');
                }
            );
        }
    }
})

function openFile(event) {
    g_workingDir.getFileAsync(event.data.filename).done(function (file) {
        Windows.System.Launcher.launchFileAsync(file).done();
    });
}

function localDelete(event) {
    g_workingDir.getFileAsync(event.data.filename).then(function (file) {
        file.deleteAsync().then(function () {
            WinJS.Navigation.navigate('/pages/file/file.html', event.data.filename);
        });
    });
}

function cloudDelete(event) {
    var metadata = event.data.md;
    metadata['chunks'].forEach(function (c) {
        dropboxDelete(c);
    });
    delete g_metadata[metadata['name']];
    WinJS.Navigation.navigate('/pages/mydocuments/mydocuments.html');
}

function sizeString(size) {
    var res = {};
    if (size > 999999999999) {
        res.value = (size / 1000000000).toFixed(1);
        res.unit = 'TBytes';
    } else if (size > 999999999) {
        res.value = (size / 1000000).toFixed(1);
        res.unit = 'GBytes';
    } else if (size > 999999) {
        res.value = (size / 1000000).toFixed(1);
        res.unit = 'MBytes';
    } else if (size > 999) {
        res.value = (size / 1000).toFixed(1);
        res.unit = 'KBytes';
    } else {
        res.value = size;
        res.unit = 'Bytes';
    }
    return res;
}

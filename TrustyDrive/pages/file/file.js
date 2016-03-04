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
        var metadata = WinJS.Navigation.state.md;
        var folder = WinJS.Navigation.state.folder;
        // Menu location
        var height = $('#content').innerHeight();
        if (metadata.name == g_configName) {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders['home']);
        } else {
            // Add click listeners
            $('.upper-settings').click(function () {
                WinJS.Navigation.navigate('/pages/settings/settings.html');
            });
            $('.upper-back').click(function () {
                WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
            });
            $('.cloud-delete').click(function () {
                cloudDelete(metadata, folder);
            });
            $('.download').click(function () {
                downloadFile(metadata, folder);
            });
            $('.move').click(function () {
                moveDialog(metadata, folder);
            });
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
                    $('.upload').click(function () {
                        uploadFile(metadata.name, folder);
                    });
                    $('.open').click({ 'filename': metadata.name }, openFile);
                    $('.local-delete').click(function () {
                        localDelete(metadata, folder);
                    });
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

function localDelete(metadata, folder) {
    g_workingDir.getFileAsync(metadata.name).then(function (file) {
        file.deleteAsync().then(function () {
            WinJS.Navigation.navigate('/pages/file/file.html', { 'md': metadata, 'folder': folder });
        });
    });
}

function cloudDelete(metadata, folder) {
    var index;
    metadata['chunks'].forEach(function (c) {
        dropboxDelete(c);
    });
    delete g_files[metadata.name];
    index = folder.files.indexOf(metadata);
    if (index > -1) {
        folder.files.splice(index, 1);
    }
    WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
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
function moveDialog(file, src) {
    $('.interface-body').empty();
    $('.user-interface').show();
    var html = '<div class="interface-question">';
    html += 'Move <b>' + file.name + '</b><br>';
    html += 'Choose the target folder:<br>';
    $('.interface-body').append(html);
    $.each(g_folders, function (name, dest) {
        if (name != src.name) {
            $('.interface-body').append('<div id="folder-' + name + '" class="interface-folder">' + name + '</div>');
            $('#folder-' + name).click(function () {
                move(file, src, dest);
            });
        }
    });
    html = '<br><br><div id="cancel-button" class="interface-button">CANCEL</div>';
    html += '</div>';
    $('.interface-body').append(html);
    $('#cancel-button').click(function () {
        $('.user-interface').hide();
    });
}

function move(file, src, dest) {
    var index = src.files.indexOf(file);
    if (index > -1) {
        src.files.splice(index, 1);
    }
    addToFolder(dest, file);
    WinJS.Navigation.navigate('/pages/folder/folder.html', dest);
}

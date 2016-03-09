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
        // Status property
        var status = $('#file-status');
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
            });
            $('.download').click(function () {
                downloadFile(metadata, folder);
            });
            $('.move').click(function () {
                var html = '<div class="interface-question">';
                $('.interface-body').empty();
                $('.user-interface').show();
                html += 'Move <b>' + metadata.name + '</b><br>';
                html += 'Choose the target folder:<br>';
                $('.interface-body').append(html);
                $.each(g_folders, function (name, dest) {
                    if (name != folder.name) {
                        $('.interface-body').append('<div id="folder-' + name + '" class="interface-folder">' + name + '</div>');
                        $('#folder-' + name).click(function () {
                            var index = folder.files.indexOf(metadata);
                            if (index > -1) {
                                folder.files.splice(index, 1);
                            }
                            addToFolder(dest, metadata);
                            WinJS.Navigation.navigate('/pages/folder/folder.html', dest);
                        });
                    }
                });
                html = '<br><br><div id="cancel-button" class="interface-button">CANCEL</div>';
                html += '</div>';
                $('.interface-body').append(html);
                $('#cancel-button').click(function () {
                    $('.user-interface').hide();
                });
            });
            // Display the file metadata
            $('.upper-title').append(metadata.name);
            $('.file-icon').css('background', 'url(../../images/style/' + metadata.type + '-big.png) no-repeat');
            $('#file-type').html(metadata.type.substr(0, 1).toUpperCase() + metadata.type.substr(1) + ' File');
            size = sizeString(metadata.size);
            $('#file-size').html(size.value + ' ' + size.unit);
            $('#file-upload').html(metadata.lastupload);
            // Display providers
            metadata.providers.forEach(function (p) {
                var div = $('<div class="used-provider">' + p.user + '</div>');
                div.css('background', 'url(../../images/style/' + p.provider + '.png) no-repeat');
                // Display currently used accounts
                $('.file-providers').append(div);
            });
            // Configure properties and actions for a downloaded file
            g_workingDir.getFileAsync(metadata.name).then(
                function (file) {
                    $('.menu-bar').css('top', height - 120);
                    $('.upload').click(function () {
                        uploadFile(metadata.name, folder);
                    });
                    $('.open').click(function () {
                        g_workingDir.getFileAsync(metadata.name).done(function (file) {
                            Windows.System.Launcher.launchFileAsync(file).done();
                        });
                    });
                    $('.local-delete').click(function () {
                        g_workingDir.getFileAsync(metadata.name).then(function (file) {
                            file.deleteAsync().then(function () {
                                WinJS.Navigation.navigate('/pages/file/file.html', { 'md': metadata, 'folder': folder });
                            });
                        });
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

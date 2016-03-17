WinJS.UI.Pages.define('/pages/file/file.html', {
    ready: function () {
        var size;
        // Get parameters
        var metadata = WinJS.Navigation.state.md;
        var folder = WinJS.Navigation.state.folder;
        // Status property
        var status = $('#file-status');
        // Menu location
        var height = $('#content').innerHeight();
        if (metadata.name == g_configName) {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        } else {
            // Add click listeners
            $('.upper-settings').click(function () {
                WinJS.Navigation.navigate('/pages/settings/settings.html');
            });
            $('.upper-back').click(function () {
                WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
            });
            $('.cloud-delete').click(function () {
                g_complete = 0;
                progressBar(g_complete, metadata.chunks.length + 1, 'Initialization', 'Delete the Cloud Version of ' + metadata.name);
                cloudDelete(metadata, folder, metadata.chunks.length);
            });
            $('.rename').click(function () {
                var index;
                var title = $('.upper-title');
                var input = $('<input id="fname" type="text" value="' + metadata.name + '">');
                title.empty();
                title.append(input);
                input.keypress(function (e) {
                    if (e.which == 13) {
                        renameFile(metadata, $('#fname').val(), folder);
                    }
                });
                input.focus();
                index = metadata.name.indexOf('.');
                if (index > -1) {
                    input[0].setSelectionRange(0, index);
                } else {
                    input[0].setSelectionRange(0, metadata.name.length);
                }
                var confirm = $('<button>Done</button>');
                var cancel = $('<button>Cancel</button>');
                confirm.click(function () {
                    renameFile(metadata, $('#fname').val(), folder);
                });
                title.append(confirm);
                cancel.click(function () {
                    WinJS.Navigation.navigate('/pages/file/file.html', {'md' : metadata, 'folder': folder });
                });
                title.append(cancel);
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
                    var idString;
                    if (name != folder.name) {
                        idString = replaceAnnoyingChars(name);
                        $('.interface-body').append('<div id="folder-' + idString + '" class="interface-folder">' + name + '</div>');
                        $('#folder-' + idString).click(function () {
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
                div.css('background', 'url(../../images/style/' + p.provider + '-small.png) no-repeat');
                // Display currently used accounts
                $('.file-providers').append(div);
            });
            // Configure properties and actions for a downloaded file
            g_workingFolder.getFileAsync(metadata.name).then(
                function (file) {
                    $('.menu-bar').css('top', height - 120);
                    $('.upload').click(function () {
                        uploadFile(metadata.name, folder);
                    });
                    $('.open').click(function () {
                        g_workingFolder.getFileAsync(metadata.name).done(function (file) {
                            Windows.System.Launcher.launchFileAsync(file).done();
                        });
                    });
                    $('.local-delete').click(function () {
                        g_workingFolder.getFileAsync(metadata.name).then(function (file) {
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

function replaceAnnoyingChars(annoying) {
    return annoying.replace(' ', '_');
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

function renameFile(metadata, newName, folder) {
    if (newName.length > 0 && g_files[newName] == undefined) {
        delete g_files[metadata.name];
        metadata.name = newName;
        g_files[newName] = metadata;
        WinJS.Navigation.navigate('/pages/file/file.html', { 'md': metadata, 'folder': folder });
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'The file <b>' + newName + '</b> already exists!');
    }
}

function cloudDelete(metadata, folder, nbDelete) {
    var index = true;
    var myProviders = [];
    g_complete = 0;
    metadata.providers.forEach(function (p) {
        var temp = getProvider(p.provider, p.user);
        if (temp == undefined) {
            index = false;
            log('Can not get the provider ' + p.provider + '/' + p.user);
        } else {
            myProviders.push(temp);
        }
    });
    if (index) {
        for (index = 0 ; index < metadata.chunks.length; index++) {
            dropboxDelete(metadata.chunks[index], myProviders[index % myProviders.length].token, nbDelete, folder);
        }
        delete g_files[metadata.name];
        index = folder.files.indexOf(metadata);
        if (index > -1) {
            folder.files.splice(index, 1);
        }
    }
}

function deleteComplete(nbDelete, folder) {
    g_complete++;
    if (g_complete == nbDelete) {
        WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
    } else {
        progressBar(g_complete, nbDelete + 1, 'Number of Deleted Chunks: ' + g_complete);
    }
}

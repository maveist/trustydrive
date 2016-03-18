WinJS.UI.Pages.define('/pages/file/file.html', {
    ready: function () {
        var size;
        // Get parameters
        var file = WinJS.Navigation.state.file;
        var folder = WinJS.Navigation.state.folder;
        // Status property
        var status = $('#file-status');
        // Menu location
        var height = $('#content').innerHeight();
        if (file.name == g_configName) {
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
                progressBar(g_complete, file.chunks.length + 1, 'Initialization', 'Delete the Cloud Version of ' + file.name);
                cloudDelete(file, folder, file.chunks.length);
            });
            $('.rename').click(function () {
                var index;
                var title = $('.upper-title');
                var input = $('<input id="fname" type="text" value="' + file.name + '">');
                title.empty();
                title.append(input);
                input.keypress(function (e) {
                    if (e.which == 13) {
                        renameFile(file, $('#fname').val(), folder);
                    }
                });
                input.focus();
                index = file.name.indexOf('.');
                if (index > -1) {
                    input[0].setSelectionRange(0, index);
                } else {
                    input[0].setSelectionRange(0, file.name.length);
                }
                var confirm = $('<button>Done</button>');
                var cancel = $('<button>Cancel</button>');
                confirm.click(function () {
                    renameFile(file, $('#fname').val(), folder);
                });
                title.append(confirm);
                cancel.click(function () {
                    WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
                });
                title.append(cancel);
            });
            $('.download').click(function () {
                downloadFile(file, folder);
            });
            $('.move').click(function () {
                var html = '<div class="interface-question">';
                $('.interface-body').empty();
                $('.user-interface').show();
                html += 'Move <b>' + file.name + '</b><br>';
                html += 'Choose the target folder:<br>';
                $('.interface-body').append(html);
                $.each(g_folders, function (name, dest) {
                    var idString;
                    if (name != folder.name) {
                        idString = replaceAnnoyingChars(name);
                        $('.interface-body').append('<div id="folder-' + idString + '" class="interface-folder">' + name + '</div>');
                        $('#folder-' + idString).click(function () {
                            var index = folder.files.indexOf(file);
                            if (index > -1) {
                                folder.files.splice(index, 1);
                            }
                            addToFolder(dest, file);
                            uploadConfiguration();
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
            $('.upper-title').append(longName(file.name));
            $('.file-icon').css('background', 'url(../../images/style/' + file.type + '-big.png) no-repeat');
            $('#file-type').html(file.type.substr(0, 1).toUpperCase() + file.type.substr(1) + ' File');
            size = sizeString(file.size);
            $('#file-size').html(size.value + ' ' + size.unit);
            $('#file-upload').html(file.lastupload);
            // Display providers
            file.providers.forEach(function (p) {
                var div = $('<div class="used-provider">' + p.user + '</div>');
                div.css('background', 'url(../../images/style/' + p.provider + '-small.png) no-repeat');
                // Display currently used accounts
                $('.file-providers').append(div);
            });
            // Configure properties and actions for a downloaded file
            g_workingFolder.getFileAsync(file.name).then(
                function (f) {
                    $('.menu-bar').css('top', height - 120);
                    $('.upload').click(function () {
                        uploadFile(file.name, folder);
                    });
                    $('.open').click(function () {
                        g_workingFolder.getFileAsync(file.name).done(function (file) {
                            Windows.System.Launcher.launchFileAsync(file).done();
                        });
                    });
                    $('.local-delete').click(function () {
                        g_workingFolder.getFileAsync(file.name).then(function (f) {
                            f.deleteAsync().then(function () {
                                WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
                            });
                        });
                    });
                    f.getBasicPropertiesAsync().done(function (props) {
                        if (props.size == f.size) {
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

function renameFile(file, newName, folder) {
    if (newName.length > 0 && g_files[newName] == undefined) {
        delete g_files[file.name];
        file.name = newName;
        g_files[newName] = file;
        uploadConfiguration();
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'The file <b>' + newName + '</b> already exists!');
    }
}

function cloudDelete(file, folder, nbDelete) {
    var index = true;
    var myProviders = [];
    g_complete = 0;
    file.providers.forEach(function (p) {
        var temp = getProvider(p.provider, p.user);
        if (temp == undefined) {
            index = false;
            log('Can not get the provider ' + p.provider + '/' + p.user);
        } else {
            myProviders.push(temp);
        }
    });
    if (index) {
        for (index = 0 ; index < file.chunks.length; index++) {
            dropboxDelete(file.chunks[index], myProviders[index % myProviders.length].token, nbDelete, folder);
        }
        delete g_files[file.name];
        index = folder.files.indexOf(file);
        if (index > -1) {
            folder.files.splice(index, 1);
        }
    }
}

function deleteComplete(nbDelete, folder) {
    g_complete++;
    if (g_complete == nbDelete) {
        uploadConfiguration();
    } else {
        progressBar(g_complete, nbDelete + 1, 'Number of Deleted Chunks: ' + g_complete);
    }
}

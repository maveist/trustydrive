﻿/***
*   file scope: display files and manage them
***/
WinJS.UI.Pages.define('/pages/file/file.html', {
    ready: function () {
        var size;
        // Get parameters
        var file = WinJS.Navigation.state.file;
        var folder = WinJS.Navigation.state.folder;
        // Status property

        // Menu location
        if (file.name == g_metadataName) {
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
                var html = '<div class="interface-question">';
                html += 'Do you really permanently delete <b>' + file.name + '</b> from the cloud?<br>';
                html += 'This action can not be undone!<br>';
                html += '<br><br><div id="delete-button" class="interface-button">DELETE</div>' +
                    '<div id="cancel-button" class="interface-button">CANCEL</div>';
                html += '</div>';
                $('.interface-body').empty();
                $('.user-interface').show();
                $('.interface-body').append(html);
                $('#delete-button').click(function () {
                    // Count the number of deleted chunks
                    g_complete = 0;
                    // Display the progress bar
                    progressBar(g_complete, file.nb_chunks + 1, 'Initialization', 'Delete the Cloud Version of ' + file.name);
                    cloudDelete(file, file.nb_chunks, folder);
                });
                $('#cancel-button').click(function () {
                    $('.user-interface').hide();
                });
            });
            $('.rename').click(function () {
                var index;
                var title = $('.upper-title');
                var input = $('<input id="fname" type="text" value="' + file.name + '">');
                title.empty();
                title.append(input);
                input.keypress(function (e) {
                    if (e.which == 13) {
                        renameFile(file, $('#fname').val());
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
                    renameFile(file, $('#fname').val());
                });
                title.append(confirm);
                cancel.click(function () {
                    title.html(file.name);
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
                        // Remove space to use the string as a HTML id
                        idString = name.replace(' ', '_');
                        $('.interface-body').append('<div id="folder-' + idString + '" class="interface-folder">' + name + '</div>');
                        $('#folder-' + idString).click(function () {
                            var index = folder.files.indexOf(file);
                            if (index > -1) {
                                folder.files.splice(index, 1);
                            }
                            addToFolder(dest, file);
                            // Modify the destination of the back button
                            $('.upper-back').off();
                            $('.upper-back').click(function () {
                                WinJS.Navigation.navigate('/pages/folder/folder.html', dest);
                            });
                            // Save the modification
                            uploadMetadata();
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
            file.chunks.forEach(function (c) {
                var div;
                if (c.provider.name == 'onedrive') {
                    div = $('<div class="used-provider">' + c.provider.username + '</div>');
                } else {
                    div = $('<div class="used-provider">' + c.provider.user + '</div>');
                }
                div.css('background', 'url(../../images/style/' + c.provider.name + '-small.png) no-repeat');
                // Display currently used accounts
                $('.file-providers').append(div);
            });
            showDownloadedFileMenu(file);
        }
    }
})

function showDownloadedFileMenu(file) {
    var status = $('#file-status');
    var height = $('#content').innerHeight();
    // Check the existence of the file on the working folder
    g_workingFolder.getFileAsync(file.name).then(
        function (f) {
            if ($('.menu-container').length == 1) {
                var menubar = $('.menu-bar');
                // Increase the size of the menu bar
                menubar.css('top', height - 120);
                // Add new buttons
                menubar.prepend('<div class="menu-container">' +
                    '<div title="Open this File" class="menu-item open"></div>' +
                    '<div title="Delete the Local Version" class="menu-item local-delete"></div>' +
                    '</div>');
                // Configure new buttons
                $('.open').click(function () {
                    g_workingFolder.getFileAsync(file.name).done(function (toOpen) {
                        Windows.System.Launcher.launchFileAsync(toOpen).done();
                    });
                });
                $('.local-delete').click(function () {
                    g_workingFolder.getFileAsync(file.name).then(function (toDelete) {
                        toDelete.deleteAsync().then(function () {
                            showDownloadedFileMenu(file);
                        });
                    });
                });
                // Check the size of the file
                f.getBasicPropertiesAsync().done(function (props) {
                    if (props.size == file.size) {
                        status.html('On the Local Drive');
                    } else {
                        status.html('To Be Upload');
                    }
                });
            }
        },
        function (error) {
            $('.menu-bar').css('top', height - 60);
            if ($('.menu-container').length > 1) {
                $('.menu-container')[0].remove();
            }
            status.html('On the Cloud');
        }
    );
}

/***
*   cloudDelete: delete the chunks on the cloud related to a file
*       file: the file metadata
*       nbDelete: the number of chunks to delete
*           i.e., # of chunks of the file or the sum of the # of chunks of files included inside a folder
*       folder: the folder to display after deleting all chunks
***/
function cloudDelete(file, nbDelete, folder) {
    // Display the folder after the deletion
    g_file2display = folder;
    // Delete every chunks
    file.chunks.forEach(function (c) {
        c.info.forEach(function (i) {
            switch (c.provider.name) {
                case 'dropbox':
                    setTimeout(function () {
                        dropboxDelete(i.name, c.provider, nbDelete, uploadMetadata);
                    }, 500);
                    break;
                case 'gdrive':
                    setTimeout(function () {
                        gdriveDelete(i.id, c.provider, nbDelete, uploadMetadata);
                    }, 500);
                    break;
                case 'onedrive':
                    setTimeout(function () {
                        oneDriveDelete(i.id, c.provider, nbDelete, uploadMetadata);
                    }, 500);
                    break;
            }
        });
    });
    delete g_files[file.name];
    index = folder.files.indexOf(file);
    if (index > -1) {
        folder.files.splice(index, 1);
    }
}

/***
*   deleteComplete: this function is called after deleting one chunks
*       nbDelete: the number of chunks to delete
*       func: the function to execute after the deletion
***/
function deleteComplete(nbDelete, func) {
    g_complete++;
    if (g_complete == nbDelete) {
        func();
    } else {
        progressBar(g_complete, nbDelete + 1, 'Number of Deleted Chunks: ' + g_complete, 'Deleting...');
    }
}

/***
*   syncComplete: this function is called after dropboxSync, gdriveSync and oneDriveSync
*       orphans: the chunks that are no longer used by TrustyDrive
***/
function syncComplete(orphans) {
    if (g_complete == g_providers.length) {
        deleteOrphansDialog(orphans);
    }
}

/***
*   renameFile: rename a file
*       file: the file metadata
*       newName: the new name of the file
***/
function renameFile(file, newName) {
    var title = $('.upper-title');
    if (newName.length > 0 && g_files[newName] == undefined) {
        title.empty();
        title.append(newName);
        delete g_files[file.name];
        file.name = newName;
        g_files[newName] = file;
        uploadMetadata();
        showDownloadedFileMenu(file);
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'The file <b>' + newName + '</b> already exists!');
    }
}

/***
*   sizeString: compute a string to represent the size in order to display it
*       size: the size in bytes
*       return: an object to stylishly display the size
***/
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

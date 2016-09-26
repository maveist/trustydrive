/***
*   folder scope: display folders and manage them
***/
WinJS.UI.Pages.define('/pages/folder/folder.html', {
    ready: function () {
        var folder = WinJS.Navigation.state;
        var height = $('#content').innerHeight();
        var home, body, div, files = $('.file-list'), fileArray = [];
        var sorting = Windows.Storage.ApplicationData.current.localSettings.values['sortingFiles'];
        // Fail to pass the Windows Certification test
        //if (folder.name == g_homeFolderName) {
        //    // Delete the navigation history if the home page is display
        //    WinJS.Navigation.history.backStack = [];
        //}
        // Position of the menu bar
        $('.menu-bar').css('top', height - 60);
        // Remove the menu-bar height and the upper-bar height and padding
        $('.file-list').innerHeight(height - 60 - 60 - 5);
        // Default folder to display
        if (typeof folder === 'string') {
            showFolderError(folder);
            folder = g_folders[g_homeFolderName];
        } else if (folder == undefined) {
            folder = g_folders[g_homeFolderName];
        }
        // Add click listeners
        $('.upper-settings').click(function () {
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        });
        $('.upload').click(function () {
            uploadFile(folder);
        });
        $('.local-delete').click(function () {
            var html = '<div class="interface-question">';
            html += 'This action permanently deletes the <b>' + folder.files.length + ' files</b> of the <b>' + folder.name + '</b> folder.<br>';
            html += 'This action can not be undone! Do you really want to delete the content of this folder?<br>';
            html += '<br><br><div id="delete-button" class="interface-button">DELETE</div>' +
                '<div id="cancel-button" class="interface-button">CANCEL</div>';
            html += '</div>';
            $('.interface-body').empty();
            $('.user-interface').show();
            $('.interface-body').append(html);
            $('#delete-button').click(function () {
                deleteFolder(folder);
            });
            $('#cancel-button').click(function () {
                $('.user-interface').hide();
            });
        });
        $('.rename').click(function () {
            var title = $('.upper-title');
            title.empty();
            var input = $('<input id="fname" type="text" value="' + folder.name + '">');
            title.append(input);
            input.keypress(function (e) {
                if (e.which == 13) {
                    // Press enter
                    renameFolder(folder, $('#fname').val());
                }
            });
            input.focus();
            input[0].setSelectionRange(0, folder.name.length);
            var confirm = $('<button>Done</button>');
            var cancel = $('<button>Cancel</button>');
            confirm.click(function () {
                renameFolder(folder, $('#fname').val());
            });
            title.append(confirm);
            cancel.click(function () {
                title.empty();
                title.append(folder.name);
            });
            title.append(cancel);
        });
        $('.create-dir').click(function () {
            $('.interface-body').empty();
            $('.user-interface').show();
            var html = '<div class="interface-question">';
            html += 'Create a new folder in <b>' + folder.name + '</b><br>';
            html += 'Name of the new folder: <input id="fname" type="text"><br>';
            html += '<div id="create-button" class="interface-button">CREATE</div><div id="cancel-button" class="interface-button">CANCEL</div>';
            html += '</div>';
            $('.interface-body').append(html);
            // Set focus and magic key
            var fname = $('#fname');
            fname.focus();
            fname.keypress(function (e) {
                if (e.which == 13) {
                    createFolder(fname.val(), folder);
                }
            });
            $('#create-button').click(function () {
                createFolder(fname.val(), folder);
            });
            $('#cancel-button').click(function () {
                $('.user-interface').hide();
            });
        });
        // Display the folder content
        $('.upper-title').html(longName(folder.name));
        // Add click listeners
        if (folder.name != g_homeFolderName) {
            $('.upper-back').click(function () {
                WinJS.Navigation.navigate('/pages/folder/folder.html', folder.father);
            });
        }
        folder.folders.sort(alphabetic);
        $.each(folder.folders, function (useless, f) {
            div = $('<div id="' + f.name + '" class="file folder">' + longName(f.name) + '</div>');
            div.click(function () {
                WinJS.Navigation.navigate('/pages/folder/folder.html', f);
            });
            files.append(div);
        });
        if (sorting == 'type') {
            folder.files.sort(byType);
        } else {
            folder.files.sort(alphabetic);
        }
        // Display the files of the folder
        $.each(folder.files, function (useless, file) {
            if (file.name != g_metadataName) {
                div = $('<div id="' + file.name + '" class="file ' + file.type + '">' + longName(file.name) + '</div>');
                div.click(function () {
                    WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
                });
                fileArray.push(div);
                files.append(div);
            }
        });
        $.each(folder.files, function (index, file) {
            if (file.name != g_metadataName) {
                g_workingFolder.getFileAsync(file.name).then(function (f) {
                    fileArray[index].css('font-weight', 'bold');
                });
            }
        });
    }
})

/***
*   showFolderError: display the error
*       errorMessage: the text describing the error
***/
function showFolderError(errorMessage) {
    $('.user-interface').show();
    // Create a close button
    div = $('<div id="close-button" class="interface-button">CLOSE</div>');
    div.click(function () {
        $('.user-interface').hide();
    });
    // Configure body
    body = $('.interface-body');
    body.empty();
    body.append(errorMessage + '<br><br>');
    body.append(div);
}

/***
*   alphabetic: sort alphabetically the files of a folder
*       a: one file
*       b: another file
***/
function alphabetic(a, b) {
    return a.name.localeCompare(b.name);
}

/***
*   byType: sort the files of a folder from their type
*       a: one file
*       b: another file
***/
function byType(a, b) {
    if (a.type == b.type) {
        return a.name.localeCompare(b.name);
    } else {
        if (a.type == undefined || b.type == undefined) {
            return -1;
        } else {
            return a.type.localeCompare(b.type);
        }
    }
}

/***
*   createFolder: create a folder
*       fname: the name of the folder
*       folder: the parent of the folder
***/
function createFolder(fname, folder) {
    if (fname.length > 0 && g_folders[fname] == undefined) {
        // Create the new folder
        var newfolder = createElement(fname, 'folder');
        addToFolder(folder, newfolder);
        WinJS.Navigation.navigate('/pages/folder/folder.html', newfolder);
    } else {
        showFolderError('Folder <b>' + fname + '</b> already exists!');
    }
}

/***
*   deleteFolder: delete a folder and every chunk associated to the files inside this folder
*       folder: the folder to delete
***/
function deleteFolder(folder) {
    var current = [], future = [], allFiles = [], nbChunks = 0;
    current.push(folder);
    while (current.length > 0) {
        current.forEach(function (c) {
            c.files.forEach(function (f) {
                allFiles.push({ 'file': f, 'folder': c });
                nbChunks += f.chunks.length;
            });
            future = future.concat(c.folders);
        });
        current = future.slice(0);
        future = [];
    }
    g_complete = 0;
    progressBar(g_complete, nbChunks + 1, 'Initialization', 'Delete the Content of the Folder ' + folder.name);
    if (allFiles.length == 0) {
        $('.user-interface').hide();
    } else {
        allFiles.forEach(function (af) {
            cloudDelete(af.file, nbChunks, af.folder);
        });
    }
}

/***
*   renameFolder: rename a folder
*       folder: the folder to rename
*       newName: the new name of the folder
***/
function renameFolder(folder, newName) {
    var current = [], future = [], modify = false;
    var title = $('.upper-title');
    title.empty();
    // Check the new name
    if (newName.length == 0 || g_folders[newName] != undefined) {
        title.append(folder.name);
        showFolderError('The folder <b>' + newName + '</b> already exists!');
    } else {
        title.append(newName);
        delete g_folders[folder.name];
        g_folders[newName] = folder;
        if (folder.name == g_homeFolderName) {
            // Remember the new home name
            Windows.Storage.ApplicationData.current.localSettings.values['home'] = newName;
            folder.name = newName;
        } else {
            // Modify the path of files
            folder.name = newName;
            current.push(folder);
            while (current.length > 0) {
                current.forEach(function (c) {
                    future = future.concat(c.folders);
                    c.files.forEach(function (f) {
                        modify = true;
                        setPath(c, f);
                    });
                });
                current = future.slice(0);
                future = [];
            }
        }
    }
    if (modify) {
        uploadMetadata();
    }
}

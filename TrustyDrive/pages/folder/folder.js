WinJS.UI.Pages.define('/pages/folder/folder.html', {
    ready: function () {
        var folder = WinJS.Navigation.state;
        var height = $('#content').innerHeight();
        var home, body, div, files = $('.file-list');
        var sorting = Windows.Storage.ApplicationData.current.localSettings.values['sortingFiles'];
        // Position of the menu bar
        $('.menu-bar').css('top', height - 60);
        // Remove the menu-bar height and the upper-bar height and padding
        $('.file-list').innerHeight(height - 60 - 60 - 5);
        // Default folder to display
        if (typeof folder === 'string') {
            $('.user-interface').show();
            // Create a close button
            div = $('<div id="close-button" class="interface-button">CLOSE</div>');
            div.click(function () {
                $('.user-interface').hide();
            });
            // Configure body
            body = $('.interface-body');
            body.empty();
            body.append(folder + '<br><br>');
            body.append(div);
            folder = g_folders[g_homeFolderName];
        } else if (folder == undefined) {
            folder = g_folders[g_homeFolderName];
        }
        // Add click listeners
        $('.upper-settings').click(function () {
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        });
        $('.upload').click(function () {
            uploadNewFile(folder);
        });
        $('.local-delete').click(function () {
            var html = '<div class="interface-question">';
            html += 'This action permanently deletes the <b>' + folder.files.length + ' files</b> of the <b>' + folder.name + '</b> folder.<br>';
            html += 'This action can not be undone! Do you really want to delete this folder?<br>';
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
                WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
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
                    createDir(fname.val(), folder);
                }
            });
            $('#create-button').click(function () {
                createDir(fname.val(), folder);
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
        $.each(folder.folders, function (useless, file) {
            if (file.name != g_configName) {
                div = $('<div id="' + file.name + '" class="file folder">' + longName(file.name) + '</div>');
                div.click(function () {
                    WinJS.Navigation.navigate('/pages/folder/folder.html', file);
                });
                files.append(div);
            }
        });
        if (sorting == 'type') {
            folder.files.sort(byType);
        } else {
            folder.files.sort(alphabetic);
        }
        $.each(folder.files, function (useless, file) {
            if (file.name != g_configName) {
                div = $('<div id="' + file.name + '" class="file ' + file.type + '">' + longName(file.name) + '</div>');
                // Get ids of chunk to test the Google Drive driver
                //file.chunks.forEach(function (c) {
                //    $('body').append('ID: ' + c.id);
                //});
                div.click(function () {
                    WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
                });
                files.append(div);
            }
        });
    }
})

function alphabetic(a, b) {
    return a.name.localeCompare(b.name);
}

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

function createDir(fname, folder) {
    if (fname.length > 0 && g_folders[fname] == undefined) {
        // Create the new folder
        var newfolder = createElement(fname, 'folder');
        addToFolder(folder, newfolder);
        WinJS.Navigation.navigate('/pages/folder/folder.html', newfolder);
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'Folder <b>' + fname + '</b> already exists!');
    }
}

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
    allFiles.forEach(function (af) {
        cloudDelete(af.file, nbChunks, af.folder);
    });
}

function renameFolder(folder, newName) {
    var current = [], future = [], modify = false;
    if (newName.length == 0 || g_folders[newName] != undefined) {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'The folder <b>' + newName + '</b> already exists!');
    } else {
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
        uploadConfiguration();
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
    }
}

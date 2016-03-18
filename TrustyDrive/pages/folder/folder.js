WinJS.UI.Pages.define('/pages/folder/folder.html', {
    ready: function () {
        var folder = WinJS.Navigation.state;
        var height = $('#content').innerHeight();
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var credentials = passwordVault.retrieveAll();
        //TESTING Delete all credentials
        //credentials.forEach(function (c) {
        //    passwordVault.remove(c);
        //});
        var body, div, files = $('.file-list');
        var sorting = Windows.Storage.ApplicationData.current.localSettings.values['sortingFiles'];
        // Check if the configuration exists
        if (g_files[g_configName] == undefined) {
            // Create the home folder
            var home = { 'name': g_homeFolderName, 'kind': 'folder', 'files': [], 'folders': [] };
            g_folders[g_homeFolderName] = home;
            // Create the configuration metadata
            g_files = {};
            g_files[g_configName] = { 'name': g_configName, 'user': 'remy', 'password': 'toto', 'chunks': [], 'providers': [] };
        }
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
            deleteFolder(folder);
        });
        $('.rename').click(function () {
            var title = $('.upper-title');
            title.empty();
            var input = $('<input id="fname" type="text" value="' + folder.name + '">');
            title.append(input);
            input.keypress(function (e) {
                if (e.which == 13) {
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
        // Select information to display
        if (g_workingFolder == undefined) {
            // Set the working folder
            WinJS.Navigation.navigate('/pages/wfolder/wfolder.html');
        } else if (g_files[g_configName].chunks.length == 0 && credentials.length > 0) {
            // Connect to existing providers
            progressBar(0, credentials.length + 1, 'Initialization', 'Connecting to cloud accounts');
            setTimeout(function () {
                connect(credentials, 0, passwordVault);
            }, 300);
        } else if (g_providers.length < 2) {
            // Add a new cloud provider
            WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
        } else {
            // Display the folder content
            $('.upper-title').html(longName(folder.name));
            // Add click listeners
            if (folder.name != g_homeFolderName) {
                $('.upper-back').click(function () {
                    WinJS.Navigation.navigate('/pages/folder/folder.html', folder.father);
                });
            }
            folder.folders.sort(alphabetic);
            $.each(folder.folders, function (useless, props) {
                if (props.name != g_configName) {
                    div = $('<div id="' + props.name + '" class="file folder">' + longName(props.name) + '</div>');
                    div.click(function () {
                        WinJS.Navigation.navigate('/pages/folder/folder.html', props);
                    });
                    files.append(div);
                }
            });
            if (sorting == 'type') {
                folder.files.sort(byType);
            } else {
                folder.files.sort(alphabetic);
            }
            $.each(folder.files, function (useless, props) {
                if (props.name != g_configName) {
                    div = $('<div id="' + props.name + '" class="file ' + props.type + '">' + longName(props.name) + '</div>');
                    div.click(function () {
                        WinJS.Navigation.navigate('/pages/file/file.html', { 'file': props, 'folder': folder });
                    });
                    files.append(div);
                }
            });
        }
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

function configurationChunk(provider) {
    return provider.user.replace('@', 'at') + 'isremy';
}

function connect(credentials, idx, vault) {
    if (idx < credentials.length) {
        log('Connecting to ' + credentials[idx].resource + ' with ' + credentials[idx].userName);
        progressBar(idx + 1, credentials.length + 1, 'Connecting to ' + credentials[idx].resource + ' with ' + credentials[idx].userName);
        switch (credentials[idx].resource) {
            case 'box':
                break;
            case 'dropbox':
                dropboxUserInfo(vault.retrieve(credentials[idx].resource, credentials[idx].userName).password, true, function () {
                    connect(credentials, idx + 1, vault);
                });
                break;
            case 'googledrive':
                break;
            case 'onedrive':
                break;
        }
    } else {
        // Connection to all providers are etablished
        if (g_providers.length < 2) {
            // Users must add providers, at least 2 providers is required
            WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
        } else {
            //$('.user-interface').hide();
            downloadConfiguration();
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
        cloudDelete(af.file, af.folder, nbChunks);
    });
}

function progressBar(current, max, legend, title) {
    var bar, barLegend, body, step;
    if (current == 0) {
        $('.user-interface').show();
        // Add the progress bar
        bar = $('<div class="progress-bar"></div>');
        barLegend = $('<div class="bar-legend">' + legend + '</div>');
        body = $('.interface-body');
        body.empty();
        body.append('<div class="bar-title">' + title + '</div>').append(bar).append(barLegend);
    } else {
        bar = $('.progress-bar');
        barLegend = $('.bar-legend');
    }
    while (current >= bar.children().length) {
        step = $('<div class="progress-step"></div>').width(bar.width() / max);
        bar.append(step);
        barLegend.html(legend);
    }
    if (current == max - 1) {
        if (typeof title === 'function') {
            setTimeout(title, 1000);
        }
    }
}

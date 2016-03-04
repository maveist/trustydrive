WinJS.UI.Pages.define('/pages/folder/folder.html', {
    ready: function () {
        var debug = $('#debug');
        var folder = WinJS.Navigation.state;
        var height = $('#content').innerHeight();
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var credentials = passwordVault.retrieveAll();
        var div, files = $('.file-list');
        var sorting = Windows.Storage.ApplicationData.current.localSettings.values['sortingFiles'];
        $('.menu-bar').css('top', height - 60);
        // Remove the menu-bar height and the upper-bar height and padding
        $('.file-list').innerHeight(height - 60 - 60 - 5);
        // Add click listeners
        $('.upper-settings').click(function () {
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        });
        $('.upload').click(function () {
            uploadNewFile(folder);
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
            $('#create-button').click(function () {
                var fname = $('#fname').val();
                if (fname.length > 0 && g_folders[fname] == undefined) {
                    // Create the new folder
                    var newfolder = createElement(fname, 'folder');
                    addToFolder(folder, newfolder);
                    WinJS.Navigation.navigate('/pages/folder/folder.html', newfolder);
                }
            });
            $('#cancel-button').click(function () {
                $('.user-interface').hide();
            });
        });
        if (g_files[g_configName] == undefined) {
            // Connect to existing providers
            progressBar(0, credentials.length + 1, 'Initialization', 'Connecting to cloud accounts');
            setTimeout(function () {
                connect(credentials, 0, passwordVault);
            }, 300);
        } else {
            // Display the folder content
            if (folder == undefined) {
                folder = g_folders['home'];
            }
            // Set the title
            $('.upper-title').html(folder.name);
            // Add click listeners
            if (folder.name != 'home') {
                $('.upper-back').click(function () {
                    WinJS.Navigation.navigate('/pages/folder/folder.html', folder.father);
                });
            }
            folder.folders.sort(alphabetic);
            $.each(folder.folders, function (useless, props) {
                if (props.name != g_configName) {
                    div = $('<div id="' + props.name + '" class="file folder">' + props.name + '</div>');
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
                    div = $('<div id="' + props.name + '" class="file ' + props.type + '">' + props.name + '</div>');
                    div.click(function () {
                        WinJS.Navigation.navigate('/pages/file/file.html', { 'md': props, 'folder': folder });
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
        return a.type.localeCompare(b.type);
    }
}

function connect(credentials, idx, vault) {
    if (idx < credentials.length) {
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
        if (g_providers.length < 2) {
            // Users must add providers, at least 2 providers is required
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        } else {
            g_files = {};
            // Every provider is available, build the configuration metadata
            g_files[g_configName] = { 'name': g_configName, 'user': 'remy', 'password': 'toto', 'chunks': [] };
            g_providers.forEach(function (p) {
                g_files[g_configName]['chunks'].push(p.user.replace('@', 'at') + 'is' + 'remy');
            });
            downloadConfiguration();
        }
    }
}

function progressBar(current, max, legend, title) {
    var bar, barLegend, body;
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
        var step = $('<div class="progress-step"></div>').width(300 / max);
        bar.append(step);
        barLegend.html(legend);
    }
    if (current == max - 1) {
        if (typeof title === 'function') {
            setTimeout(title, 1000);
        }
    }
}

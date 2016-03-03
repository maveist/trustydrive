WinJS.UI.Pages.define('/pages/mydocuments/mydocuments.html', {
    ready: function () {
        var debug = $('#debug');
        var folderName = WinJS.Navigation.state;
        var height = $('#content').innerHeight();
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var credentials = passwordVault.retrieveAll();
        $('.menu-bar').css('top', height - 60);
        // Remove the menu-bar height and the upper-bar height and padding
        $('.file-list').innerHeight(height - 60 - 60 - 5);
        // Add click listeners
        $('.upload').click(uploadNewFile);
        $('.upper-settings').click(function () {
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        });
        if (g_metadata[g_configName] == undefined) {
            // Connect to existing providers
            progressBar(0, credentials.length + 1, 'Initialization', 'Connecting to cloud accounts');
            setTimeout(function () {
                connect(credentials, 0, passwordVault);
            }, 300);
        } else {
            displayFiles();
        }
    }
})

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
            g_metadata = {};
            // Every provider is available, build the configuration metadata
            g_metadata[g_configName] = { 'name': g_configName, 'user': 'remy', 'password': 'toto', 'chunks': [] };
            g_providers.forEach(function (p) {
                g_metadata[g_configName]['chunks'].push(p.user.replace('@', 'at') + 'is' + 'remy');
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

function displayFiles() {
    var files = $('.file-list');
    files.empty();
    $.each(g_metadata, function (key, val) {
        if (key != g_configName) {
            var div = $('<div id="' + key + '" class="file ' + val.type + '">' + key + '</div>');
            div.click({ 'filename': key }, displayFile);
            files.append(div);
        }
    });
}

function displayFolder(event) {
    WinJS.Navigation.navigate('/pages/mydocuments/mydocuments.html', event.data.folder);
}

function displayFile(event) {
    WinJS.Navigation.navigate('/pages/file/file.html', event.data.filename);
}

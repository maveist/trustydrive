﻿WinJS.UI.Pages.define('/pages/login/login.html', {
    ready: function () {
        // Do not forget to provider the string argument
        var logError = WinJS.Navigation.state;
        // Credentials to load registered providers
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var credentials = passwordVault.retrieveAll();
        //TESTING Delete all credentials
        //credentials.forEach(function (c) {
        //    passwordVault.remove(c);
        //});
        // Check the working folder configuration
        if (g_workingFolder == undefined) {
            WinJS.Navigation.navigate('/pages/wfolder/wfolder.html');
        } else {
            if (g_files[g_configName] == undefined) {
                // Create the home folder
                home = { 'name': g_homeFolderName, 'kind': 'folder', 'files': [], 'folders': [] };
                g_folders[g_homeFolderName] = home;
                // Initialize the metadata of files
                g_files = {};
                g_files[g_configName] = { 'name': g_configName, 'user': '', 'password': '', 'chunks': [], 'providers': [] };
            }
            if (g_files[g_configName].chunks.length == 0 && credentials.length > 0) {
                // Connect to existing providers
                progressBar(0, credentials.length + 1, 'Initialization', 'Connecting to cloud accounts');
                setTimeout(function () {
                    connect(credentials, 0, passwordVault);
                }, 300);
            } else {
                if (g_providers.length < 2) {
                    // Add a new cloud provider
                    WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
                } else {
                    showConnectFields(logError);
                }
            }
        }
    }
})

function connectToFilesystem() {
    var user = $('#connect-login').val(), pwd = $('#connect-pwd').val();
    if (user.length == 0 || pwd.length == 0) {
        $('#connect-error').html('<b>Wrong login or password!</b>');
    } else {
        g_files[g_configName] = { 'name': g_configName, 'user': user, 'password': pwd, 'chunks': [], 'providers': [] };
        g_providers.forEach(function (p) {
            g_files[g_configName].chunks.push(configurationChunkName(p));
        });
        downloadConfiguration();
    }
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
        // Connections to every provider are etablished
        if (g_providers.length < 2) {
            // Users must add providers, at least 2 providers is required
            WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
        } else {
            // Enter the login/password to load metadata
            WinJS.Navigation.navigate('/pages/login/login.html', '');
        }
    }
}

function createAccount() {
    var user = $('#new-login').val(), pwd = $('#new-pwd').val(), pwdbis = $('#new-pwdbis').val(),
        question = $('#new-que').val(), answer = $('#new-ans').val();
    // Check there is no empty fields
    if (user.length == 0 || pwd.length == 0 || pwd.length == 0 || pwdbis.length == 0 || question.length == 0 || answer.length == 0) {
        $('#new-error').html('<b>All fields are required!</b>');
    } else {
        if (pwd != pwdbis) {
            $('#new-error').html('<b>Passwords do not match!</b>');
        } else {
            g_files[g_configName] = { 'name': g_configName, 'user': user, 'password': pwd, 'question': question, 'answer': answer, 'chunks': [], 'providers': [] };
            g_providers.forEach(function (p) {
                g_files[g_configName].chunks.push(configurationChunkName(p));
            });
            uploadConfiguration();
        }
    }
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
        if (title == undefined) {
            body.append('<div class="bar-title">Executing...</div>').append(bar).append(barLegend);
        } else {
            body.append('<div class="bar-title">' + title + '</div>').append(bar).append(barLegend);
        }
    } else {
        bar = $('.progress-bar');
        barLegend = $('.bar-legend');
    }
    while (current >= bar.children().length) {
        step = $('<div class="progress-step"></div>').width(bar.width() / max);
        bar.append(step);
        barLegend.html(legend);
    }
}

function showConnectFields(logError) {
    $('#lost-form').hide();
    $('#new-form').hide();
    $('#connect-form').show();
    $('#connect-error').html('');
    if (logError.length > 0) {
        $('#connect-error').html('<b>' + logError + '</b>');
    }
    if ($._data($('#connect-confirm').get(0), 'events') == undefined) {
        // Define click listeners
        $('#provider-link').click(function () {
            WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
        });
        $('#connect-confirm').keypress(function (e) {
            if (e.which == 13) {
                connectToFilesystem();
            }
        });
        $('#connect-confirm').click(function () {
            connectToFilesystem();
        });
        $('#new-link').click(function () {
            $('#connect-form').hide();
            $('#new-form').show();
            $('#new-error').html('');
            if ($._data($('#new-confirm').get(0), 'events') == undefined) {
                $('#new-confirm').keypress(function (e) {
                    if (e.which == 13) {
                        createAccount();
                    }
                });
                // Define click listeners
                $('#new-confirm').click(createAccount);
                $('#connect-link').click(function () {
                    showConnectFields('');
                });
            }
        });
        $('#lost-link').click(function () {
            $('#connect-form').hide();
            $('#lost-form').show();
            $('#lost-error').html('');
            $('#lost-que').html('Ou est parti Toto ?');
            if ($._data($('#lost-confirm').get(0), 'events') == undefined) {
                // Define click listeners
                $('#lost-confirm').click(function () {
                    if ($('#lost-ans').val() == g_files[g_configName].answer) {
                    } else {
                        $('#lost-error').html('Wrong answer!');
                    }
                });
                $('#connect-link3').click(function () {
                    showConnectFields('');
                });
            }
        });
    }
}

/***
*   login scope: the entry point of TrustyDrive. Check precondition about the working folder and the number of providers
*       and download the metadata
***/
var done = true;
function readAnswer(sender) {
    $('body').append('ANSWER: ' + sender.answer);
    setTimeout(function () {
        readAnswer(sender);
    }, 1000);
}

WinJS.UI.Pages.define('/pages/login/login.html', {
    ready: function () {
        // TEST the connection to the dispatcher
        //if (done) {
        //    done = false;
        //    var sender = new breaker.Instance();
        //    sender.dispatcher("hello:\n");
        //    readAnswer(sender);
        //}
        // END TEST
        // Do not forget to provider the string argument
        var logError = WinJS.Navigation.state;
        // Credentials to load registered providers
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var credentials = passwordVault.retrieveAll();
        //TESTING Delete all credentials
        //credentials.forEach(function (c) {
        //    passwordVault.remove(c);
        //});
        //TESTING END
        if (g_workingFolder == undefined) {
            // The working folder is required to start using TrustyDrive
            WinJS.Navigation.navigate('/pages/wfolder/wfolder.html');
        } else {
            if (g_files[g_metadataName] == undefined) {
                // Connect to existing providers
                progressBar(0, credentials.length + 1, 'Initialization', 'Connecting to cloud accounts');
                setTimeout(function () {
                    connect(credentials, 0, passwordVault);
                }, 300);
            } else {
                if (g_providers.length < 2) {
                    // There are not enough providers
                    WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
                } else {
                    showConnectFields(logError);
                }
            }
        }
    }
})

/***
*   metadataInit: create an empty metadata for the user and clear both the folder list and the file list
*       user: the user name
*       password: the password to protect the account
***/
function metadataInit(user, password) {
    // Initialize the metadata of folders
    g_folders = {};
    g_folders[g_homeFolderName] = { 'name': g_homeFolderName, 'files': [], 'folders': [] };
    // Initialize the metadata of files
    g_files = {};
    g_files[g_metadataName] = { 'name': g_metadataName, 'user': user, 'password': password, 'chunks': [] };
    g_providers.forEach(function (p) {
        g_files[g_metadataName].chunks.push({ 'provider': p, 'info': [{ 'name': metadataChunkName(p) }] });
    });
    g_files[g_metadataName]['nb_chunks'] = g_providers.length;
}

/***
*   connectToFilesystem: fill the metadata with password and download the metadata
***/
function connectToFilesystem() {
    var user = $('#connect-login').val(), pwd = $('#connect-pwd').val();
    if (user.length == 0 || pwd.length == 0) {
        $('#connect-error').html('<b>Wrong login or password!</b>');
    } else {
        metadataInit(user, pwd);
        downloadMetadata();
    }
}

/***
*   connect: connect to one registered provider
*       credentials: the credentials of the TrustyDrive
*       idx: the index of the provider credentials
*       vault: the utility to read credentials
***/
function connect(credentials, idx, vault) {
    var provider, user;
    if (idx < credentials.length) {
        var provider = credentials[idx].resource;
        var user = credentials[idx].userName;
        switch (provider) {
            case 'dropbox':
                progressBar(idx + 1, credentials.length + 1, 'Connecting to ' + provider + ' with ' + user);
                dropboxUserInfo(vault.retrieve(provider, user).password, true, function () {
                    connect(credentials, idx + 1, vault);
                });
                break;
            case 'gdrive':
                progressBar(idx + 1, credentials.length + 1, 'Connecting to ' + provider + ' with ' + user);
                gdriveUserInfo(vault.retrieve(provider, user).password, true, function () {
                    connect(credentials, idx + 1, vault);
                });
                break;
            case 'onedrive':
                // Get the name of the user from a file
                Windows.Storage.ApplicationData.current.localFolder.getFileAsync(user + '.name').then(function (file) {
                    Windows.Storage.FileIO.readTextAsync(file).then(function (userName) {
                        progressBar(idx + 1, credentials.length + 1, 'Connecting to ' + provider + ' with ' + userName);
                        oneDriveUserInfo(vault.retrieve(provider, user).password, true, function () {
                            connect(credentials, idx + 1, vault);
                        });
                    });
                }, function () {
                    progressBar(idx + 1, credentials.length + 1, 'Connecting to ' + provider + ' with ' + user);
                    oneDriveUserInfo(vault.retrieve(provider, user).password, true, function () {
                        connect(credentials, idx + 1, vault);
                    });
                });
                break;
        }
    } else {
        metadataInit('', '');
        // Enter the login/password to load metadata
        WinJS.Navigation.navigate('/pages/login/login.html', '');
    }
}

/***
*   createAccount: create an account to a new TrustyDrive user
***/
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
            metadataInit(user, pwd);
            metadataExists();
        }
    }
}

/***
*   progressBar: display a nice progress bar
*       current: the current step of the operation
*       max: the number of steps to complete the operation
*       legend: the message to update at every step
*       title: the title of the operation
***/
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

/***
*   showConnectFields: show fields to allow the login of an existing user
*       logError: display why the login failed
***/
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
                    if ($('#lost-ans').val() == g_files[g_metadataName].answer) {
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

/***
*   login scope: the entry point of TrustyDrive. Check precondition about the working folder and the number of providers
*       and download the metadata
***/
WinJS.UI.Pages.define('/pages/login/login.html', {
    ready: function () {
        // Do not forget to provide the string argument
        var logError = WinJS.Navigation.state;
        // Credentials to load registered providers
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var credentials = passwordVault.retrieveAll();
        //RESET
        //// Remove the path to the download folder
        //Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList.clear();
        ////Delete all credentials
        //$.each(credentials, function (useless, c) {
        //    passwordVault.remove(c);
        //});
        // Delete the password file, see the declaration of g_pwdFile for more details
        // Windows.Storage.ApplicationData.current.localFolder.deleteAsync(g_pwdFile).done();
        //RESET END
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
                    Windows.Storage.ApplicationData.current.localFolder.getFileAsync(g_pwdFile).then(function (file) {
                        // The user has already set a password, do nothing
                    }, function () {
                        // The user have no password, display new form to set it
                        showNewFields();
                    });
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
function metadataInit(password) {
    // Initialize the metadata of folders
    g_folders = {};
    g_folders[g_homeFolderName] = { 'name': g_homeFolderName, 'files': [], 'folders': [] };
    // Initialize the metadata of files
    g_files = {};
    g_files[g_metadataName] = { 'name': g_metadataName, 'password': password, 'chunks': [] };
    g_providers.forEach(function (p) {
        g_files[g_metadataName].chunks.push({ 'provider': p, 'info': [{ 'name': metadataChunkName(p) }] });
    });
    g_files[g_metadataName]['nb_chunks'] = g_providers.length;
}

/***
*   connectToFilesystem: fill the metadata with password and download the metadata
***/
function connectToFilesystem() {
    var pwd = $('#connect-pwd').val();
    if (pwd.length == 0) {
        $('#connect-error').html('<b>Password is required!</b>');
    } else {
        metadataInit(pwd);
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
        // Set an empty metadata to notify that every credentials is loaded
        metadataInit('');
        // Enter the login/password to load metadata
        WinJS.Navigation.navigate('/pages/login/login.html', '');
    }
}

/***
*   createPassword: create a new password to store files
***/
function createPassword() {
    var pwd = $('#new-pwd').val(), pwdbis = $('#new-pwdbis').val();
    // Check there is no empty fields
    if (pwd.length == 0 || pwd != pwdbis) {
        $('#new-error').html('<b>Passwords do not match!</b>');
    } else {
        metadataInit(pwd);
        Windows.Storage.ApplicationData.current.localFolder.createFileAsync(g_pwdFile, Windows.Storage.CreationCollisionOption.replaceExisting).then(function (file) {
            Windows.Storage.FileIO.writeTextAsync(file, 'iopqcumlapjpua').then(function () {
                g_file2display = 'login';
                uploadMetadata();
            });
        });
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
        $('#new-link').click(showNewFields);
    }
}

/***
*   showNewFields: show fields to create a new password
***/
function showNewFields() {
    Windows.Storage.ApplicationData.current.localFolder.getFileAsync(g_pwdFile).then(function (file) {
        // A password already exists, print a warning
        $('#new-msg').html('A password already exists ? Reset your password involves <b>the loss of your files</b>' +
            ' previously saved from TrustyDrive.<br><br>');
    }, function () {
        $('#new-msg').html('Choose a secure password (more than 8 characters with symbols, numbers and upper/lower case)' +
            ' is important to secure your TrustyDrive files. However, be sure to not forget it. <b>TrustyDrive does not save this' +
            ' password. If you lose it, your files cannot be recovered.<br><br>');
    });
    $('#connect-form').hide();
    $('#new-form').show();
    $('#new-error').html('');
    if ($._data($('#new-confirm').get(0), 'events') == undefined) {
        $('#new-confirm').keypress(function (e) {
            if (e.which == 13) {
                createPassword();
            }
        });
        // Define click listeners
        $('#new-confirm').click(createPassword);
        $('#connect-link').click(function () {
            showConnectFields('');
        });
    }
}

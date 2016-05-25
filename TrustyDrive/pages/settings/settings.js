/***
*   settings scope: settings to configure TrustyDrive
***/
(function () {
    WinJS.UI.Pages.define('/pages/settings/settings.html', {
        ready: function () {
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            var localSettings = Windows.Storage.ApplicationData.current.localSettings;
            var height = $('#content').innerHeight();
            // Display the TrustyDrive current version
            $('#td-version').html('You are running TrustyDrive v' + g_td_version + '<br>');
            // Set the height of the page
            $('.menu-bar').css('top', height - 60);
            $('.settings-params').innerHeight(height - 60 - 5);
            // Add click listeners
            $('#picker-button').click(function () {
                var folderPicker = new Windows.Storage.Pickers.FolderPicker();
                folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.desktop;
                // Useless for the folder selection but required by the API
                folderPicker.fileTypeFilter.replaceAll(['.txt', '.pdf', '.jpg']);
                folderPicker.pickSingleFolderAsync().then(function (folder) {
                    if (folder) {
                        futureAccess.addOrReplace('PickedFolderToken', folder);
                        g_workingFolder = folder;
                        setButtonLabel(folder.path);
                        WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                    }
                });
            });
            $('#change-pwd').click(function () {
                WinJS.Navigation.navigate('/pages/changepwd/changepwd.html');
            });
            $('#metadata-editor').click(function () {
                WinJS.Navigation.navigate('/pages/metadata/metadata.html');
            });
            if (localSettings.values['sortingFiles'] == undefined) {
                $('#file-view').text('Alphabetic');
            } else {
                $('#file-view').text(localSettings.values['sortingFiles'].substr(0, 1).toUpperCase() + localSettings.values['sortingFiles'].substr(1));
            }
            $('#file-view').click(viewFiles);
            $('.upper-back').click(function () {
                WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
            });
            // Display information about providers
            $('.new-provider').click(function () {
                WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
            });
            if (g_providers.length < 2) {
                $('.my-accounts').append('<b>Please add at least two accounts from a storage service</b>');
                $('.my-accounts > b').css('color', 'red');
            }
            g_providers.forEach(function (p) {
                var embed = $('<div class="remove-provider"></div>');
                var div, username = p.user;
                if (p.name == 'onedrive') {
                    username = p.username;
                }
                if (username.length > 26) {
                    div = $('<div class="used-account">...' + username.substring(username.length - 23, username.length) + '</div>');
                } else {
                    div = $('<div class="used-account">' + username + '</div>');
                }
                div.append(embed);
                div.css('background', 'url(../../images/style/' + p.name + '.png) no-repeat');
                embed.click(function () {
                    deleteProvider(p);
                });
                // Display currently used accounts
                $('.my-accounts').append(div);
            });
            // Display the current working directory path
            if (futureAccess.containsItem('PickedFolderToken')) {
                futureAccess.getFolderAsync('PickedFolderToken').done(function (folder) {
                    setButtonLabel(folder.path);
                });
            } else {
                setButtonLabel('Select Working Directory');
            }
        }
    });

    /***
    *   setButtonLabel: shorten the name of the picker button
    *       name: the full path
    *       return: the shortened full path
    ***/
    function setButtonLabel(name) {
        if (name.length > 26) {
            $('#picker-button').text('...' + name.substr(-23));
        } else {
            $('#picker-button').text(name);
        }
    }

    /***
    *   viewFiles: select the sorting type (sort by type or alphabetically)
    ***/
    function viewFiles() {
        var button = $('#file-view');
        var localSettings = Windows.Storage.ApplicationData.current.localSettings;
        if (button.text() == 'Alphabetic') {
            localSettings.values['sortingFiles'] = 'type';
            button.text('Type');
        } else {
            localSettings.values['sortingFiles'] = 'alphabetic';
            button.text('Alphabetic');
        }
    }
})();

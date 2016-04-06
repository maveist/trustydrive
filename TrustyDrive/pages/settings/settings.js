(function () {
    WinJS.UI.Pages.define('/pages/settings/settings.html', {
        ready: function () {
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            var localSettings = Windows.Storage.ApplicationData.current.localSettings;
            // Display the TrustyDrive current version
            $('#td-version').html('You are running TrustyDrive v' + g_td_version + '<br>');
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
                    } else {
                        // The picker was dismissed with no selected file
                    }
                });
            });
            $('#editor-config').click(function () {
                WinJS.Navigation.navigate('/pages/editor/editor.html');
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
                var embed = $('<div class="remove-provider">Remove</div>');
                var div = $('<div class="used-account">' + p.user + '</div>');
                div.append(embed);
                div.css('background', 'url(../../images/style/' + p.provider + '.png) no-repeat');
                embed.click(function () {
                    deleteProvider(p);
                });
                // Display size in MB
                log('User: ' + p.user + ', Storage ' + (p.free / 1000000).toFixed(1) + '/' + (p.total / 1000000).toFixed(1));
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

    function setButtonLabel(name) {
        if (name.length > 26) {
            $('#picker-button').text('...' + name.substr(-23));
        } else {
            $('#picker-button').text(name);
        }
    }

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
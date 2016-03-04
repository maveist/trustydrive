(function () {
    WinJS.UI.Pages.define('/pages/settings/settings.html', {
        ready: function () {
            var localSettings = Windows.Storage.ApplicationData.current.localSettings;
            localSettings.values['sortingFiles'] = 'alphabetic';
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            // Add click listeners
            $('#picker-button').click(function () {
                var folderPicker = new Windows.Storage.Pickers.FolderPicker();
                var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
                folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.desktop;
                // Useless for the folder selection but required by the API
                folderPicker.fileTypeFilter.replaceAll(['.txt', '.pdf', '.jpg']);
                folderPicker.pickSingleFolderAsync().then(function (folder) {
                    if (folder) {
                        futureAccess.addOrReplace('PickedFolderToken', folder);
                        setButtonLabel(folder.path);
                    } else {
                        // The picker was dismissed with no selected file
                    }
                });
            });
            $('#upload-config').click(uploadConfiguration);
            $('#download-config').click(downloadConfiguration);
            $('.upper-back').click(function() {
                WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders['home']);
            });
            $('#dropbox').click(dropboxLogin);
            // Compute the available size
            g_providers.forEach(function (p) {
                // Display size in MB
                $('#debug').append('user: ' + p.user + ', Storage ' + (p.free / 1000000).toFixed(1) + '/' + (p.total / 1000000).toFixed(1) + '<br>');
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
})();
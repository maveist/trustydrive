(function () {
    WinJS.UI.Pages.define('/pages/settings/settings.html', {
        ready: function () {
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            // Add click listeners
            $('#picker-button').click(chooseDir);
            $('#dropbox').click({'provider': 'dropbox'}, addProvider);
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

    function chooseDir() {
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
    }

    function addProvider(event) {
        var provider;
        switch (event.data.provider) {
            case 'box':
                break;
            case 'dropbox':
                dropboxLogin();
                break;
        }
    }
})();
WinJS.UI.Pages.define('/pages/wfolder/wfolder.html', {
    ready: function () {
        var index = 0;
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        });
        $('.working-folder').click(function () {
            var folderPicker = new Windows.Storage.Pickers.FolderPicker();
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.downloads;
            // Useless for the folder selection but required by the API
            folderPicker.fileTypeFilter.replaceAll(['.txt', '.pdf', '.jpg']);
            folderPicker.pickSingleFolderAsync().then(function (folder) {
                if (folder) {
                    futureAccess.addOrReplace('PickedFolderToken', folder);
                    g_workingFolder = folder;
                    WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                } else {
                    // The picker was dismissed with no selected file
                }
            });
        });
    }
})

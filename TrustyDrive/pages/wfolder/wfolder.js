﻿/***
*   wfolder scope: select the working folder (i.e., the folder to download files)
***/
WinJS.UI.Pages.define('/pages/wfolder/wfolder.html', {
    ready: function () {
        var index = 0;
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/login/login.html', '');
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
                    WinJS.Navigation.navigate('/pages/login/login.html', '');
                }
            });
        });
    }
})

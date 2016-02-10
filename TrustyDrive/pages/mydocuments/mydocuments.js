(function () {
    WinJS.UI.Pages.define('/pages/mydocuments/mydocuments.html', {
        ready: function () {
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            if (futureAccess.containsItem('PickedFolderToken')) {
                futureAccess.getFolderAsync('PickedFolderToken').done(function (folder) {
                    $('#files').html('Parsing the working directory ' + folder.path);
                });
            }
        }
    });
})();
(function () {
    var workingDir;
    // APP URI: ms-appx://1cee9efb-b8db-46ff-b36e-6aad85b039fd/pages/mydocuments/mydocuments.js
    WinJS.UI.Pages.define('/pages/mydocuments/mydocuments.html', {
        ready: function () {
            g_providers.forEach(function (p) {
                $('#debug').append('user: ' + p.user + ', Storage ' + (p.free / 1000000).toFixed(1) + '/' + (p.total / 1000000).toFixed(1) + '<br>');
            });
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            if (futureAccess.containsItem('PickedFolderToken')) {
                futureAccess.getFolderAsync('PickedFolderToken').done(function (folder) {
                    workingDir = folder;
                    var fileDiv = $('#files');
                    //    fileDiv.html('Parsing the working directory ' + folder.path + ':<br>');
                    //    folder.getFilesAsync().done(function (files) {
                    //        files.forEach(function (file) {
                    //            fileDiv.append(file.name + '<br>');
                    //        });
                    //    });
                });
            }
        }
    });
})();
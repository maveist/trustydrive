WinJS.UI.Pages.define('/pages/addprovider/addprovider.html', {
    ready: function () {
        // Add click listeners
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        });
        $('.upper-settings').click(function () {
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        });
        if (g_providers.length == 0) {
            $('#registered').append('<b>none</b>');
        } else {
            g_providers.forEach(function (p) {
                $('#registered').append('<li>' + p.provider + ' - ' + p.user + '</li>');
            });
        }
        $('.add-dropbox').click(function () {
            dropboxLogin(function () {
                WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
            });
        });
        $('.add-drive').click(driveLogin);
        $('.add-onedrive').click(oneDriveLogin);
    }
})

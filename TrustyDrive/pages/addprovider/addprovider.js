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
            // Display a waiting wheel
            dropboxLogin(function (provider) {
                if (g_providers.length > 1) {
                    dropboxExists(configurationChunk(provider), provider.token, function (args) {
                        if (args.exists) {
                            downloadConfiguration();
                        } else {
                            uploadConfiguration();
                        }
                    });
                } else {
                    WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
                }
            });
        });
        $('.add-drive').click(driveLogin);
        $('.add-onedrive').click(oneDriveLogin);
    }
})

WinJS.UI.Pages.define('/pages/addprovider/addprovider.html', {
    ready: function () {
        // Add click listeners
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/login/login.html', '');
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
            dropboxLogin(function () {
                if (g_providers.length > 1) {
                    WinJS.Navigation.navigate('/pages/login/login.html', '');
                } else {
                    WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
                }
            });
        });
        $('.add-drive').click(function () {
            gdriveLogin(function () {
                if (g_providers.length > 1) {
                    WinJS.Navigation.navigate('/pages/login/login.html', '');
                } else {
                    WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
                }
            });
        });
        $('.add-onedrive').click(oneDriveLogin);
    }
})

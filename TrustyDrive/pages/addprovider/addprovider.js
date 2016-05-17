WinJS.UI.Pages.define('/pages/addprovider/addprovider.html', {
    ready: function () {
        // Add click listeners
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/login/login.html', '');
        });
        $('.upper-settings').click(function () {
            WinJS.Navigation.navigate('/pages/settings/settings.html');
        });
        $('.signin-link').click(function () {
            WinJS.Navigation.navigate('/pages/login/login.html', '');
        });
        if (g_providers.length == 0) {
            $('#registered').append('<b>none</b>');
        } else {
            g_providers.forEach(function (p) {
                if (p.provider == 'onedrive') {
                    $('#registered').append('<li>' + p.provider + ' - ' + p.username + '</li>');
                } else {
                    $('#registered').append('<li>' + p.provider + ' - ' + p.user + '</li>');
                }
            });
        }
        $('.add-dropbox').click(function () {
            dropboxLogin(function () {
                WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
            });
        });
        $('.add-drive').click(function () {
            gdriveLogin(function () {
                WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
            });
        });
        $('.add-onedrive').click(function () {
            oneDriveLogin(function () {
                WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
            });
        });
    }
})

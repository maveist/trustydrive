/***
*   addprovider scope: display already registered accounts and register new providers
***/
WinJS.UI.Pages.define('/pages/addprovider/addprovider.html', {
    ready: function () {
        // Add click listeners
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/login/login.html', '');
        });
        $('.signin-link').click(function () {
            WinJS.Navigation.navigate('/pages/login/login.html', '');
        });
        providerList();
        $('#delete-cred').click(deleteCredentials);
        $('.add-dropbox').click(function () {
            dropboxLogin(function () {
                providerList();
            });
        });
        $('.add-drive').click(function () {
            gdriveLogin(function () {
                providerList();
            });
        });
        $('.add-onedrive').click(function () {
            oneDriveLogin(function () {
                providerList();
            });
        });
    }
})

function providerList() {
    $('#registered').empty();
    if (g_providers.length == 0) {
        $('#registered').append('<b>none</b>');
    } else {
        g_providers.forEach(function (p) {
            if (p.name == 'onedrive') {
                $('#registered').append('<li>' + p.name + ' - ' + p.username + '</li>');
            } else {
                $('#registered').append('<li>' + p.name + ' - ' + p.user + '</li>');
            }
        });
    }
    if ($('.user-interface').is(':visible')) {
        $('.user-interface').hide();
    }
}

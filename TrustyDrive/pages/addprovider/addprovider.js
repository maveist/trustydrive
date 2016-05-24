﻿/***
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

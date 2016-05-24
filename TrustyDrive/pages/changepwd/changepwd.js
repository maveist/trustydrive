/***
*   changepwd scope: change the user password
***/
WinJS.UI.Pages.define('/pages/changepwd/changepwd.html', {
    ready: function () {
        $('#password-confirm').click(function () {
            var current = $('#password-cur').val(), newp = $('#password-new').val(), newpbis = $('#password-newbis').val();
            if (current.length == 0 || newp.length == 0 || newpbis.length == 0) {
                $('#password-error').html('All fields are required!');
            } else {
                if (current == g_files[g_metadataName].password) {
                    if (newp == newpbis) {
                        g_files[g_metadataName].password = newp;
                        uploadMetadata();
                    } else {
                        $('#password-error').html('Passwords do not match!');
                    }
                } else {
                    $('#password-error').html('Wrong password!');
                }
            }
        });
    }
})

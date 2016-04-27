// Google Drive connector
function gdriveLogin(func) {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://www.dropbox.com/1/oauth2/authorize?';
    if (!$('.user-interface').is(':visible')) {
        $('.user-interface').show();
        body = $('.interface-body');
        body.empty();
        body.append('Connecting to dropbox<br><center><img src="../../images/style/waiting.gif"></center>');
    }
    uri += 'response_type=token&';
    uri += 'client_id=qsg6s8c70g3newe&';
    uri += 'redirect_uri=' + webAuthenticationBroker.getCurrentApplicationCallbackUri();
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).then(function (response) {
        if (response.responseStatus == webtools.WebAuthenticationStatus.success) {
            var data = response.responseData;
            var token = data.substring(data.indexOf('=') + 1, data.indexOf('&'));
            $('.interface-body').append('connection successful!');

            // Check that the 'trustydrive' folder exists
            //dropboxExists('', token, function (args) {
            //    if (args.exists) {
            //        dropboxUserInfo(token, false, func);
            //    } else {
            //        dropboxCreateFolder(token, function () {
            //            dropboxUserInfo(token, false, func);
            //        });
            //    }
            //});
        }
    });
}

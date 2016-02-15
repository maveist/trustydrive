// Dropbox connector to one dropbox account
function addProvider(p) {
    var i, found = false;
    for (i = 0; i < g_providers.length; i++) {
        if (g_providers[i].provider == p.provider && g_providers[i].user == p.user) {
            found = true;
        }
    }
    if (!found) {
        $('#debug').append('Add provider: ' + p.user);
        g_providers.push(p);
    }
}

function dropbox_login() {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://www.dropbox.com/1/oauth2/authorize?';
    uri += 'response_type=token&';
    uri += 'client_id=qsg6s8c70g3newe&';
    uri += 'redirect_uri=' + webAuthenticationBroker.getCurrentApplicationCallbackUri();
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).done(
        function (success) {
            var data = success.responseData;
            dropbox_userinfo(data.substring(data.indexOf('=') + 1, data.indexOf('&')), false);
        },
        function (error) {
            $('#debug').append(error + '<br>');
        }
    );
}

function dropbox_userinfo(token, reconnect) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/account/info');
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).done(
        function (success) {
            success.content.readAsStringAsync().done(function (jsonInfo) {
                var data, cred, storage;
                var credentials = Windows.Security.Credentials;
                var passwordVault = new credentials.PasswordVault();
                try {
                    //$('#debug').append(jsonInfo + '<br>');
                    data = $.parseJSON(jsonInfo);
                    storage = data['quota_info'];
                    cred = new credentials.PasswordCredential('dropbox', data['email'], token)
                    passwordVault.add(cred);
                    addProvider({
                        'provider': cred.resource, 'user': cred.userName, 'token': cred.password,
                        'free': (storage['quota'] - storage['shared'] - storage['normal']), 'total': storage['quota']
                    });
                    WinJS.Navigation.navigate("/pages/mydocuments/mydocuments.html")
                } catch (ex) {
                    $('#debug').append('<br>error: ' + ex);
                }
            });
        },
        function (error) {
            if (reconnect) {
                dropbox_login();
            }
        }
    );
}

function dropbox_download(filename, token) {
    var fileDiv = $('#files');
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files/auto/' + filename);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    var buffer = new Windows.Storage.Streams.Buffer(4096);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    fileDiv.append('<br>HTTP request:<br>');
    //workingDir.createFileAsync("toto.txt").done(function () {
    //    fileDiv.append('HTTP request:<br>');
    //});
    httpClient.sendRequestAsync(requestMessage).done(
        function (success) {
            fileDiv.append('Success:<br>');
            success.content.readAsBufferAsync().done(function (buffer) {
                //WARN: Overwrite the existing file
                Windows.Storage.PathIO.writeBufferAsync(workingDir.path + '\\' + filename, buffer).done(function () {
                    fileDiv.append('File downloaded!<br>');
                });
            });
        },
        function (error) {
            fileDiv.append('Error:<br>' + error);
        }
    );
}

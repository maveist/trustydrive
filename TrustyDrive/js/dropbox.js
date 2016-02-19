// Dropbox connector to one dropbox account
function createProvider(p) {
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
    g_providers.sort(function (a, b) {
        return a.user.localeCompare(b.user);
    });
}

function dropboxLogin() {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://www.dropbox.com/1/oauth2/authorize?';
    uri += 'response_type=token&';
    uri += 'client_id=qsg6s8c70g3newe&';
    uri += 'redirect_uri=' + webAuthenticationBroker.getCurrentApplicationCallbackUri();
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).done(
        function (success) {
            var data = success.responseData;
            dropboxUserInfo(data.substring(data.indexOf('=') + 1, data.indexOf('&')), false);
        },
        function (error) {
            $('#debug').append(error + '<br>');
        }
    );
}

function dropboxUserInfo(token, reconnect) {
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
                    createProvider({
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
                dropboxLogin();
            }
        }
    );
}

function dropboxDownload(metadata, chunkIdx, token) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var chunkName = metadata['chunks'][chunkIdx];
    var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files/auto/' + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    //WARN: Delete the file if exists
    g_workingDir.createFileAsync(chunkName, Windows.Storage.CreationCollisionOption.replaceExisting).done(function (newFile) {
        httpClient.sendRequestAsync(requestMessage).done(function (success) {
            //fileDiv.append('Success: ' + success + '<br>');
            success.content.readAsBufferAsync().done(function (buffer) {
                Windows.Storage.PathIO.writeBufferAsync(newFile.path, buffer).done(function () {
                    downloadComplete(metadata);
                });
            });
        });
    });
}

function dropboxUpload(chunkName, data, token) {
    var debug = $('#debug');
    var filePicker = new Windows.Storage.Pickers.FileOpenPicker();
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files_put/auto/' + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    httpClient.sendRequestAsync(requestMessage).done(
        function (success) {
            //debug.append('Success: ' + success + '<br>');
        },
        function (error) {
            debug.append('Error:' + error + '<br>');
        }
    );
}

// Dropbox connector to one dropbox account
function createProvider(p) {
    var i, found = false;
    for (i = 0; i < g_providers.length; i++) {
        if (g_providers[i].provider == p.provider && g_providers[i].user == p.user) {
            found = true;
        }
    }
    if (!found) {
        $('#debug').append('Add provider: ' + p.user + '<br>');
        g_providers.push(p);
    }
    g_providers.sort(function (a, b) {
        return a.user.localeCompare(b.user);
    });
}

function dropboxLogin(func) {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://www.dropbox.com/1/oauth2/authorize?';
    uri += 'response_type=token&';
    uri += 'client_id=qsg6s8c70g3newe&';
    uri += 'redirect_uri=' + webAuthenticationBroker.getCurrentApplicationCallbackUri();
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).then(
        function (success) {
            var data = success.responseData;
            dropboxUserInfo(data.substring(data.indexOf('=') + 1, data.indexOf('&')), false, func);
        },
        function (error) {
            $('#debug').append(error + '<br>');
        }
    );
}

function dropboxUserInfo(token, reconnect, func) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/account/info');
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).done(
        function (success) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                var data, cred, storage;
                var credentials = Windows.Security.Credentials;
                var passwordVault = new credentials.PasswordVault();
                try {
                    data = $.parseJSON(jsonInfo);
                    storage = data['quota_info'];
                    cred = new credentials.PasswordCredential('dropbox', data['email'], token)
                    passwordVault.add(cred);
                    createProvider({
                        'provider': cred.resource, 'user': cred.userName, 'token': cred.password,
                        'free': (storage['quota'] - storage['shared'] - storage['normal']), 'total': storage['quota']
                    });
                    func();
                } catch (ex) {
                    $('#debug').append('<br>error: ' + ex);
                }
            });
        },
        function (error) {
            if (reconnect) {
                dropboxLogin(func);
            }
        }
    );
}

function dropboxDownload(metadata, folder, chunkIdx, token, writer) {
    var reader, size;
    var debug = $('debug');
    var httpClient = new Windows.Web.Http.HttpClient();
    var chunkName = metadata['chunks'][chunkIdx];
    var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files/auto/' + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    //WARN: Delete the file if exists
    httpClient.sendRequestAsync(requestMessage).then(
        function (success) {
            if (success.isSuccessStatusCode) {
                success.content.readAsBufferAsync().done(function (buffer) {
                    reader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                    g_chunks.push({ 'idx': chunkIdx, 'reader': reader, 'size': buffer.length });
                    downloadComplete(metadata, folder, writer);
                });
            } else {
                debug.append('download error: ' + success.content + '<br>');
            }
        },
        function (error) {
            debug.append('download error: ' + error + '<br>');
        }
    );
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

function dropboxDelete(chunkName) {
    $('#debug').append('Delete the chunk ' + chunkName + '<br>');
}
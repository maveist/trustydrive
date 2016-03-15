// Dropbox connector
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
            var token = data.substring(data.indexOf('=') + 1, data.indexOf('&'));
            dropboxExists('trustydrive', token,
                function () {
                    dropboxUserInfo(token, false, func);
                },
                function () {
                    createCloudFolder(token, function () {
                        dropboxUserInfo(token, false, func);
                    });
                }
            );
        },
        function (error) {
            log(error);
        }
    );
}

function dropboxExists(path, token, exist, notexist, args) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/metadata/auto/' + path);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    log('Looking for ' + 'https://api.dropboxapi.com/1/metadata/auto/' + path);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).done(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().done(function (info) {
                if (info.indexOf('is_deleted') == -1) {
                    args['exists'] = true;
                    exist(args);
                } else {
                    args['exists'] = false;
                    notexist(args);
                }
            });
        } else {
            args['exists'] = false;
            notexist(args);
        }
    });
}

function createCloudFolder(token, func) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/fileops/create_folder?root=auto&path=%2F' + g_cloudFolder);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, uri);
    log('Create the trustydrive folder');
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            func();
        } else {
            WinJS.Navigation.navigate('/pages/folder/folder.html', 'Can not create the trustydrive folder!. Please restart the application');
        }
    });
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
                try {
                    data = $.parseJSON(jsonInfo);
                    storage = data['quota_info'];
                    createProvider('dropbox', data['email'], token, storage['quota'] - storage['shared'] - storage['normal'], storage['quota']);
                    func();
                } catch (ex) {
                    log('error: ' + ex);
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

function dropboxDownload(metadata, myProviders, folder, chunkIdx, token, writer) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var chunkName = metadata['chunks'][chunkIdx];
    var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files/auto/' + g_cloudFolder + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    //WARN: Delete the file if exists
    httpClient.sendRequestAsync(requestMessage).then(
        function (success) {
            if (success.isSuccessStatusCode) {
                success.content.readAsBufferAsync().done(function (buffer) {
                    reader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                    g_chunks.push({ 'idx': chunkIdx, 'reader': reader, 'size': buffer.length });
                    downloadComplete(metadata, myProviders, folder, writer);
                });
            } else {
                progressBar(g_complete, metadata['chunks'].length + 1, 'Error: Download Failure');
                if (metadata.name == g_configName) {
                    // Download the metadata failed
                    setTimeout(function () {
                        WinJS.Navigation.navigate('/pages/folder/folder.html', 'Download Error: Can Not Retrieve the <b>Configuration</b>.'
                            + '<br>If you already use TrustyDrive to save your files, restart it. If not, ignore this message.');
                    }, 2000);
                } else {
                    setTimeout(function () {
                        WinJS.Navigation.navigate('/pages/folder/folder.html', 'Download Error: Can Not Retrieve the Document <b>' + metadata.name + '</b>');
                    }, 2000);
                }
            }
        }
    );
}

function dropboxUpload(chunkName, data, token) {
    var filePicker = new Windows.Storage.Pickers.FileOpenPicker();
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files_put/auto/' + g_cloudFolder + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, uri);
    log('Upload the chunk ' + chunkName);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    httpClient.sendRequestAsync(requestMessage).done(
        function (success) {
        },
        function (error) {
            log('Error:' + error);
        }
    );
}

function dropboxDelete(chunkName, token, nbDelete, folder) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/fileops/delete?root=auto&path=%2F' + g_cloudFolder + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, uri);
    log('Delete the chunk ' + chunkName);
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            log('Delete operation complete');
            deleteComplete(nbDelete, folder);
        } else {
            log('Delete error: ' + response);
        }
    });
}

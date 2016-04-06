// Dropbox connector
function dropboxLogin(func) {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://www.dropbox.com/1/oauth2/authorize?';
    if (!$('.user-interface').is(':visible')) {
        $('.user-interface').show();
        body = $('.interface-body');
        body.empty();
        body.append('Connecting to dropbox<br>'
            + '<center><img src="../../images/style/waiting.gif"></center>');
    }
    uri += 'response_type=token&';
    uri += 'client_id=qsg6s8c70g3newe&';
    uri += 'redirect_uri=' + webAuthenticationBroker.getCurrentApplicationCallbackUri();
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).then(function (response) {
        if (response.responseStatus == webtools.WebAuthenticationStatus.success) {
            var data = response.responseData;
            var token = data.substring(data.indexOf('=') + 1, data.indexOf('&'));
            dropboxExists('', token, function (args) {
                if (args.exists) {
                    dropboxUserInfo(token, false, func);
                } else {
                    createCloudFolder(token, function () {
                        dropboxUserInfo(token, false, func);
                    });
                }
            });
        }
    });
}

function dropboxExists(path, token, func, args) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/metadata/auto/' + g_cloudFolder + path);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    if (args == undefined) {
        args = { 'path': path };
    }
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).done(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().done(function (info) {
                if (info.indexOf('is_deleted') == -1) {
                    args['exists'] = true;
                } else {
                    args['exists'] = false;
                }
                func(args);
            });
        } else {
            args['exists'] = false;
            func(args);
        }
    });
}

function createCloudFolder(token, func) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/fileops/create_folder?root=auto&path=%2F' + g_cloudFolder);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, uri);
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
                var data, storage;
                try {
                    data = $.parseJSON(jsonInfo);
                    storage = data['quota_info'];
                    func(createProvider('dropbox', data['email'], token, storage['quota'] - storage['shared'] - storage['normal'], storage['quota']));
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

function dropboxDownload(file, myProviders, folder, chunkIdx, token, writer) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var chunkName = file['chunks'][chunkIdx];
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
                    downloadComplete(file, myProviders, folder, writer);
                });
            } else {
                progressBar(g_complete, file['chunks'].length + 1, 'Error: Download Failure');
                if (file.name == g_configName) {
                    // Download the metadata failed
                    setTimeout(function () {
                        WinJS.Navigation.navigate('/pages/folder/folder.html', 'Download Error: Can Not Retrieve the <b>Configuration</b>.'
                            + '<br>If you already use TrustyDrive to save your files, restart it. If not, ignore this message.');
                    }, 2000);
                } else {
                    setTimeout(function () {
                        WinJS.Navigation.navigate('/pages/folder/folder.html', 'Download Error: Can Not Retrieve the Document <b>' + file.name + '</b>');
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
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    httpClient.sendRequestAsync(requestMessage).done(function (response) {
        if (!response.isSuccessStatusCode) {
            log('ERROR uploading again: ' + chunkName);
            setTimeout(function () {
                dropboxUpload(chunkName, data, token);
            }, 1000);
        }
    });
}

function dropboxDelete(chunkName, provider, nbDelete, folder) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/fileops/delete?root=auto&path=%2F' + g_cloudFolder + chunkName);
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, uri);
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            deleteComplete(nbDelete, folder);
        } else {
            log('ERROR can not delete the chunk ' + chunkName + ' from ' + provider.user + ': ' + response.statusCode);
            if (response.statusCode == 404) {
                deleteComplete(nbDelete, folder);
            } else {
                setTimeout(function () {
                    dropboxDelete(chunkName, provider, nbDelete, folder);
                }, 500);
            }
        }
    });
}

function dropboxSync(chunks) {
    var orphans = [];
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/metadata/auto/' + g_cloudFolder);
    g_complete = 0;
    $.each(g_providers, function (index, p) {
        var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
        requestMessage.headers.append('Authorization', 'Bearer ' + p.token);
        httpClient.sendRequestAsync(requestMessage).then(function (response) {
            response.content.readAsStringAsync().then(function (jsonInfo) {
                data = $.parseJSON(jsonInfo);
                if (data['contents'] != undefined) {
                    data.contents.forEach(function (c) {
                        var chunkName = c['path'].substring(c['path'].lastIndexOf("/") + 1, c['path'].length);
                        if (chunks.indexOf(chunkName) == -1) {
                            orphans.push({ 'name': chunkName, 'provider': p });
                        }
                    });
                    g_complete++;
                    if (g_complete == g_providers.length) {
                        deleteOrphansDialog(orphans);
                    }
                } else {
                    log('No contents');
                }
            });
        });
    });
}
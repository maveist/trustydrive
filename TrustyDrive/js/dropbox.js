// Dropbox connector
function dropboxCreateFolder(token, func) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/fileops/create_folder?root=auto&path=%2F' + g_cloudFolder;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            func();
        } else {
            WinJS.Navigation.navigate('/pages/folder/folder.html', 'Can not create the trustydrive folder!. Please restart the application');
        }
    });
}

// nbDelete: number of chunks to delete to complete the operation
function dropboxDelete(chunkName, provider, nbDelete, folder) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/fileops/delete?root=auto&path=%2F' + g_cloudFolder + chunkName;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
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

function dropboxDownload(file, myProviders, folder, chunkIdx, provider, writer) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var chunkName = file['chunks'][chunkIdx]['name'];
    var uri = 'https://content.dropboxapi.com/1/files/auto/' + g_cloudFolder + chunkName;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    //WARN: Delete the file if exists
    log('download the chunk ' + file.chunks[chunkIdx]['name']);
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
                        WinJS.Navigation.navigate('/pages/login/login.html', 'Download Error: Can Not Retrieve your metadata.'
                            + '<br>Please check your login and your network connection.');
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

function dropboxExists(chunkName, provider, func, args) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/metadata/auto/' + g_cloudFolder + chunkName;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    if (args == undefined) {
        args = { 'exists': false, 'chunks': [], 'providers': [], 'all': [] };
    } else {
        args.exists = false;
    }
    args.all.push(chunkName);
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).done(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().done(function (info) {
                if (info.indexOf('is_deleted') == -1) {
                    args['exists'] = true;
                    args.chunks.push({ 'name': chunkName });
                    args.providers.push(provider);
                }
                func(args);
            });
        } else {
            func(args);
        }
    });
}

function dropboxLogin(func) {
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
            // Check that the 'trustydrive' folder exists
            dropboxExists('', { 'token': token }, function (args) {
                if (args.exists) {
                    dropboxUserInfo(token, false, func);
                } else {
                    dropboxCreateFolder(token, function () {
                        dropboxUserInfo(token, false, func);
                    });
                }
            });
        } else {
            $('.interface-body').append('<span class="error-message">Login failure: please retry to sign in later</span>');
            setTimeout(function () {
                WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
            }, 5000);
        }
    });
}

function dropboxSync(chunks, provider, orphans) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/metadata/auto/' + g_cloudFolder;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        response.content.readAsStringAsync().then(function (jsonInfo) {
            data = $.parseJSON(jsonInfo);
            if (data['contents'] != undefined) {
                data.contents.forEach(function (c) {
                    var chunkName = c['path'].substring(c['path'].lastIndexOf("/") + 1, c['path'].length);
                    if (indexOfChunk(chunks, chunkName) == -1) {
                        orphans.push({ 'name': chunkName, 'provider': provider });
                    }
                });
                g_complete++;
                syncComplete(orphans);
            } else {
                log('Dropbox Sync Error: no contents');
            }
        });
    });
}

function dropboxUpload(chunk, data, provider) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://content.dropboxapi.com/1/files_put/auto/' + g_cloudFolder + chunk.name;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    httpClient.sendRequestAsync(requestMessage).done(function (response) {
        if (!response.isSuccessStatusCode) {
            log('ERROR uploading again: ' + chunk.name);
            setTimeout(function () {
                dropboxUpload(chunk, data, provider);
            }, 1000);
        }
    });
}

function dropboxUserInfo(token, reconnect, func) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/account/info';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).done(
        function (success) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                var data, storage;
                try {
                    data = $.parseJSON(jsonInfo);
                    storage = data['quota_info'];
                    // Check that the 'trustydrive' folder exists
                    dropboxExists('', { 'token': token }, function (args) {
                        if (args.exists) {
                            createProvider('dropbox', data['email'], undefined, token, storage['quota'] - storage['shared'] - storage['normal'], storage['quota']);
                            func();
                        } else {
                            dropboxCreateFolder(token, function () {
                                createProvider('dropbox', data['email'], undefined, token, storage['quota'] - storage['shared'] - storage['normal'], storage['quota']);
                                func();
                            });
                        }
                    });
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

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
function dropboxDelete(chunkName, provider, nbDelete, folder, callNb) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/fileops/delete?root=auto&path=%2F' + g_cloudFolder + chunkName;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
    if (callNb == undefined) {
        // Number of call with erros
        callNb = 0;
    }
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            deleteComplete(nbDelete, folder);
        } else {
            log('ERROR can not delete the chunk ' + chunkName + ' from ' + provider.user + ': ' + response.statusCode);
            if (response.statusCode == 404) {
                deleteComplete(nbDelete, folder);
            } else if (callNb < 5) {
                setTimeout(function () {
                    dropboxDelete(chunkName, provider, nbDelete, folder, callNb + 1);
                }, 500);
            } else {
                // We delete the chunk later from the metadata editor
                deleteComplete(nbDelete, folder);
            }
        }
    });
}

function dropboxDownload(file, chunk, chunkIdx, bufferIdx, folder, writer, callNb) {
    var reader, size;
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://content.dropboxapi.com/1/files/auto/' + g_cloudFolder + chunk.info[chunkIdx].name;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage.headers.append('Authorization', 'Bearer ' + chunk.provider.token);
    //WARN: Delete the file if exists
    log('download the chunk ' + chunk.info[chunkIdx].name);
    httpClient.sendRequestAsync(requestMessage).then(
        function (success) {
            if (success.isSuccessStatusCode) {
                success.content.readAsBufferAsync().done(function (buffer) {
                    // TEST
                    Windows.Storage.ApplicationData.current.localFolder.createFileAsync(chunk.info[chunkIdx].name, Windows.Storage.CreationCollisionOption.replaceExisting).then(function (file) {
                        Windows.Storage.FileIO.writeBufferAsync(file, buffer).done();
                    });
                    // TEST END
                    reader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                    g_chunks.push({ 'idx': bufferIdx, 'reader': reader, 'size': buffer.length });
                    downloadComplete(file, folder, writer);
                });
            } else {
                if (callNb < 5) {
                    setTimeout(function () {
                        dropboxDownload(file, chunk, chunkIdx, bufferIdx, folder, writer, callNb + 1);
                    }, 1000);
                } else {
                    downloadComplete(file, folder, writer);
                }
            }
        }
    );
}

function dropboxExists(chunk, chunkIdx, func) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/metadata/auto/' + g_cloudFolder + chunk.info[chunkIdx].name;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + chunk.provider.token);
    chunk.info[chunkIdx].exists = false;
    httpClient.sendRequestAsync(requestMessage).done(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().done(function (info) {
                if (info.indexOf('is_deleted') == -1) {
                    chunk.info[chunkIdx].exists = true;
                }
                func(chunk, chunkIdx);
            });
        } else {
            func(chunk, chunkIdx);
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
        var token, data = response.responseData;
        if (response.responseStatus == webtools.WebAuthenticationStatus.success) {
            token = data.substring(data.indexOf('=') + 1, data.indexOf('&'));
            dropboxUserInfo(token, false, func);
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
                    if (chunks.indexOf(chunkName) == -1) {
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

function dropboxUpload(reader, file, chunk, chunkIdx, data, callNb) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://content.dropboxapi.com/1/files_put/auto/' + g_cloudFolder + chunk.info[chunkIdx].name;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    if (callNb == undefined) {
        // Number of call with erros
        callNb = 0;
    }
    requestMessage.headers.append('Authorization', 'Bearer ' + chunk.provider.token);
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    httpClient.sendRequestAsync(requestMessage).done(function (response) {
        if (response.isSuccessStatusCode) {
            uploadComplete(reader, file);
        } else {
            log('ERROR uploading again: ' + chunk.info[chunkIdx].name);
            if (callNb < 5) {
                setTimeout(function () {
                    dropboxUpload(reader, file, chunk, chunkIdx, data, callNb + 1);
                }, 1000);
            }
        }
    });
}

function dropboxFolderExists(token, func) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.dropboxapi.com/1/metadata/auto/' + g_cloudFolder;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    httpClient.sendRequestAsync(requestMessage).done(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().done(function (info) {
                if (info.indexOf('is_deleted') == -1) {
                    func(true);
                } else {
                    func(false);
                }
            });
        } else {
            func(false);
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
                    dropboxFolderExists(token, function (exists) {
                        if (exists) {
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

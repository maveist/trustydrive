/***
**  ONEDRIVE CONNECTOR
***/

/***
*   oneDriveDelete: Delete one chunk
*       chunkName: the name of the chunk
*       provider: the provider information to the authentication process
*       nbDelete: the number of chunks to delete to complete the whole operation
*       func: the function to execute after the folder creation
*       callNb: counter to limit the number of attempts
***/
function oneDriveDelete(chunkId, provider, nbDelete, func, callNb) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + chunkId;
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.delete, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode || response.statusCode == 404) {
            deleteComplete(nbDelete, func);
        } else {
            if (callNb < 5) {
                setTimeout(function () {
                    oneDriveDelete(chunkId, provider, nbDelete, func, callNb + 1);
                }, 500);
            } else {
                // We delete the chunk later from the metadata editor
                deleteComplete(nbDelete, func);
            }
        }
    });
}

/***
*   oneDriveExists: Check if the chunk exists
*       chunk: information about chunks (provider, name, id)
*       chunkIdx: the chunk index of the chunk to download
*       func: the function to execute after the checking
***/
function oneDriveExists(chunk, chunkIdx, func) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + chunk.provider.folder + '/children?select=id,name';
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + chunk.provider.token);
    chunk.info[chunkIdx].exists = false;
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            response.content.readAsStringAsync().then(function (jsonInfo) {
                $.parseJSON(jsonInfo)['value'].forEach(function (f) {
                    if (f.name == chunk.info[chunkIdx].name) {
                        chunk.info[chunkIdx].exists = true;
                        chunk.info[chunkIdx].id = f.id;
                    }
                });
                func(chunk, chunkIdx);
            });
        } else {
            func(chunk, chunkIdx);
        }
    });
}

/***
*   oneDriveFolderExists: Check if the trustydrive folder exists
*       token: authentication token
*       func: the function to deal with the result of the checking
***/
function oneDriveFolderExist(provider, func) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drives/' + provider.user + '/root/children?select=id,name,folder';
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                var data = $.parseJSON(jsonInfo)['value'], notfound = true;
                data.forEach(function (f) {
                    if (f.folder != undefined && f.name + '/' == g_cloudFolder) {
                        notfound = false;
                        provider['folder'] = f.id;
                        func();
                    }
                });
                if (notfound) {
                    // Create the app folder
                    uri = 'https://api.onedrive.com/v1.0/drive/root/children?select=id';
                    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
                    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
                    requestMessage.content = new Windows.Web.Http.HttpStringContent('{ "name": "' + g_cloudFolder.substr(0, g_cloudFolder.length - 1) + '", "folder": {} }',
                        Windows.Storage.Streams.UnicodeEncoding.utf8, 'application/json; charset=UTF-8');
                    httpClient.sendRequestAsync(requestMessage).then(function (success) {
                        if (success.isSuccessStatusCode) {
                            success.content.readAsStringAsync().then(function (jsonInfo) {
                                provider['folder'] = $.parseJSON(jsonInfo)['id'];
                                func();
                            });
                        }
                    });
                }
            });
        }
    });
}

/***
*   oneDriveLogin: Login to a new provider
*       func: the function to execute after the login
***/
function oneDriveLogin(func) {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://login.live.com/oauth20_authorize.srf?';
    if (!$('.user-interface').is(':visible')) {
        $('.user-interface').show();
        body = $('.interface-body');
        body.empty();
        body.append('Connecting to OneDrive<br><center><img src="../../images/style/waiting.gif"></center>');
    }
    uri += 'client_id=0000000040183D79&';
    uri += 'scope=wl.signin%20wl.offline_access%20onedrive.readwrite&';
    uri += 'response_type=code&';
    uri += 'redirect_uri=https://login.live.com/oauth20_desktop.srf';
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri),
        new Windows.Foundation.Uri('https://login.live.com/oauth20_desktop.srf')).then(function (response) {
            var data = response.responseData;
            var code = data.substring(data.indexOf('=') + 1, data.indexOf('&'));
            var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
            var content = 'client_id=0000000040183D79&';
            content += 'redirect_uri=https://login.live.com/oauth20_desktop.srf&';
            content += 'client_secret=VSjytqfsshxgSVBtJSHUZrYVdb1w6S3a&';
            content += 'code=' + code + '&';
            content += 'grant_type=authorization_code';
            uri = 'https://login.live.com/oauth20_token.srf';
            requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
            requestMessage.content = new Windows.Web.Http.HttpStringContent(content, Windows.Storage.Streams.UnicodeEncoding.utf8, 'application/x-www-form-urlencoded');
            httpClient.sendRequestAsync(requestMessage).then(function (response) {
                if (response.isSuccessStatusCode) {
                    response.content.readAsStringAsync().then(function (jsonInfo) {
                        oneDriveUserInfo($.parseJSON(jsonInfo)['refresh_token'], false, func);
                    });
                } else {
                    $('.interface-body').append('<span class="error-message">Login failure: please retry to sign in later</span>');
                    setTimeout(function () {
                        WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
                    }, 5000);
                }
            });
        });
}

/***
*   oneDriveSync: Check if every file on the cloud is used by TrustyDrive, i.e., every file located in the trustydrive folder
*       chunks: the names of every chunk used by TrustyDrive
*       provider: the provider information to the authentication process
*       orphans: the list of chunks that are not used by TrustyDrive
***/
function oneDriveSync(chunks, provider, orphans) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + provider.folder + '/children?select=id,name';
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            response.content.readAsStringAsync().then(function (jsonInfo) {
                var data = $.parseJSON(jsonInfo)['value'], found = false;
                data.forEach(function (f) {
                    if (chunks.indexOf(f.name) == -1) {
                        orphans.push({ 'name': f.name, 'id': f.id, 'provider': provider });
                    }
                });
                g_complete++;
                syncComplete(orphans);
            });
        } else {
            func(args);
        }
    });
}


/***
*   oneDriveUpload: Upload one chunk
*       reader: the reader that reads the file
*       file: the file metadata
*       chunk: information about chunks (provider, name, id)
*       chunkIdx: the chunk index of the chunk to upload
*       data: the data to upload
*       callNb: counter to limit the number of attempts
***/
function oneDriveUpload(reader, file, chunk, chunkIdx, data, callNb) {
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + chunk.provider.folder + ':/' + chunk.info[chunkIdx].name + ':/content?select=id';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    requestMessage.content.headers.append('Content-Type', 'application/octet-stream');
    requestMessage.headers.append('Authorization', 'Bearer ' + chunk.provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                chunk.info[chunkIdx]['id'] = $.parseJSON(jsonInfo)['id'];
                uploadComplete(reader, file);
            });
        } else {
            if (callNb < 5) {
                setTimeout(function () {
                    oneDriveUpload(reader, file, chunk, chunkIdx, data, callNb + 1);
                }, 1000);
            }
        }
    });
}

/***
*   oneDriveUploadFile: Measure the time to upload a file on oneDrive
*       filename: name of the file located in the appData folder
*       token: the token for the authentication process
***/
function ondeDriveUploadFile(filename, token) {
    var start = new Date();
    start = start.getTime();
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drive/items/root:/' + filename + ':/content?select=id';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    Windows.Storage.ApplicationData.current.localFolder.getFileAsync(filename).done(function (file) {
        Windows.Storage.FileIO.readBufferAsync(file).done(function (data) {
            requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    requestMessage.content.headers.append('Content-Type', 'application/octet-stream');
            httpClient.sendRequestAsync(requestMessage).done(function (response) {
                if (response.isSuccessStatusCode) {
                    var d = new Date();
                    start = (d.getTime() - start) / 1000;
                    $('body').append('time: ' + start);
                }
            });
        });
    });
}

/***
*   oneDriveUserInfo: Get the user information (email, storage stats - free space & total space) and refresh the token
*       token: refresh token
*       reconnect: boolean, try to reconnect or not
*       func: the function to deal with the result of the checking
***/
function oneDriveUserInfo(refreshToken, reconnect, func) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://login.live.com/oauth20_token.srf';
    var content = 'client_id=0000000040183D79&';
    content += 'redirect_uri=https://login.live.com/oauth20_desktop.srf&';
    content += 'client_secret=VSjytqfsshxgSVBtJSHUZrYVdb1w6S3a&';
    content += 'refresh_token=' + refreshToken + '&';
    content += 'grant_type=refresh_token';
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
    requestMessage.content = new Windows.Web.Http.HttpStringContent(content, Windows.Storage.Streams.UnicodeEncoding.utf8, 'application/x-www-form-urlencoded');
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            response.content.readAsStringAsync().then(function (jsonInfo) {
                var data = $.parseJSON(jsonInfo);
                var token = data['access_token'], provider;
                refreshToken = data['refresh_token'];
                // Get the user information
                uri = 'https://api.onedrive.com/v1.0/drive';
                requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get,
                    new Windows.Foundation.Uri(uri));
                requestMessage.headers.append('Authorization', 'Bearer ' + token);
                httpClient.sendRequestAsync(requestMessage).then(function (success) {
                    if (success.isSuccessStatusCode) {
                        success.content.readAsStringAsync().then(function (jsonInfo) {
                            var userId;
                            data = $.parseJSON(jsonInfo);
                            userId = data['owner']['user']['id'];
                            // Save tokens
                            provider = createProvider('onedrive', userId, refreshToken, token, data['quota']['remaining'], data['quota']['total']);
                            provider.username = data['owner']['user']['displayName'];
                            // Save the username in a file
                            Windows.Storage.ApplicationData.current.localFolder.createFileAsync(userId + '.name', Windows.Storage.CreationCollisionOption.replaceExisting).then(function (file) {
                                Windows.Storage.FileIO.writeTextAsync(file, provider.username).then();
                            });
                            // Create the TrustyDrive folder
                            oneDriveFolderExist(provider, func);
                        });
                    }
                });
            });
        }
    });
}

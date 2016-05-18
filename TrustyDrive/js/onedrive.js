﻿// OneDrive connector
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
                    } else {
                        log('onedrive connection failed!');
                    }
                });
            });
        } else {
            log('Refresh Token Failure ' + success.statusCode + ': ' + success.reasonPhrase);
        }
    });
}

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
                        } else {
                            log('Failed to create the app folder ' + g_cloudFolder + ': ' + success.statusCode + ' - ' + success.reasonPhrase);
                        }
                    });
                }
            });
        } else {
            log('Folder Exist Check Failure: ' + success.statusCode + ' - ' + success.requestMessage);
        }
    });
}

function oneDriveUpload(file, chunkIdx, data, provider, callNb) {
    // Create a new file with the name provided inside the 'data' buffer
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + provider.folder + ':/' + file.chunks[chunkIdx].name + ':/content?select=id';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    requestMessage.content.headers.append('Content-Type', 'application/octet-stream');
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                file.chunks[chunkIdx]['id'] = $.parseJSON(jsonInfo)['id'];
            });
        } else {
            log('Upload Failure ' + success.statusCode + ': ' + success.reasonPhrase);
            if (callNb < 5) {
                setTimeout(function () {
                    oneDriveUpload(file, chunkIdx, data, provider, callNb + 1);
                }, 1000);
            } else {
                // Fail to upload
            }
        }
    });
}

function oneDriveDownload(file, myProviders, folder, chunkIdx, provider, writer, callNb) {
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + provider.folder + ':/' + file.chunks[chunkIdx].name + ':/content';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsBufferAsync().then(function (buffer) {
                g_chunks.push({ 'idx': chunkIdx, 'reader': Windows.Storage.Streams.DataReader.fromBuffer(buffer), 'size': buffer.length });
                downloadComplete(file, myProviders, folder, writer);
            });
        } else {
            log('OneDrive Download Failure ' + success.statusCode + ': ' + success.reasonPhrase);
            if (callNb < 5) {
                setTimeout(function () {
                    oneDriveDownload(file, myProviders, folder, chunkIdx, provider, writer, callNb + 1);
                }, 1000);
            } else {
                downloadComplete(file, myProviders, folder, writer);
            }
        }
    });
}

function oneDriveExists(chunkName, provider, func, args) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + provider.folder + '/children?select=id,name';
    if (args == undefined) {
        args = { 'exists': false, 'chunks': [], 'providers': [], 'all': [] };
    } else {
        args.exists = false;
    }
    args.all.push(chunkName);
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode) {
            response.content.readAsStringAsync().then(function (jsonInfo) {
                $.parseJSON(jsonInfo)['value'].forEach(function (f) {
                    if (f.name == chunkName) {
                        args['exists'] = true;
                        args.chunks.push({ 'name': chunkName, 'id': f.id });
                        args.providers.push(provider);
                    }
                });
                func(args);
            });
        } else {
            log('File Exist Check Failure: ' + response.statusCode + ' - ' + response.requestMessage);
            func(args);
        }
    });
}

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
                    if (indexOfChunk(chunks, f['name']) == -1) {
                        orphans.push({ 'name': f['name'], 'id': f['id'], 'provider': provider });
                    }
                });
                g_complete++;
                syncComplete(orphans);
            });
        } else {
            log('File Exist Check Failure: ' + response.statusCode + ' - ' + response.requestMessage);
            func(args);
        }
    });
}

function oneDriveDelete(chunkId, provider, nbDelete, folder, callNb) {
    var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://api.onedrive.com/v1.0/drive/items/' + chunkId;
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.delete, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        if (response.isSuccessStatusCode || response.statusCode == 404) {
            deleteComplete(nbDelete, folder);
        } else {
            log('ERROR can not delete the chunk ' + chunkId + ' from ' + provider.user + ': ' + response.statusCode);
            if (callNb < 5) {
                setTimeout(function () {
                    oneDriveDelete(chunkId, provider, nbDelete, folder, callNb + 1);
                }, 500);
            } else {
                // We delete the chunk later from the metadata editor
                deleteComplete(nbDelete, folder);
            }
        }
    });
}

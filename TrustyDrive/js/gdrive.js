// Google Drive connector
function gdriveLogin(func) {
    var webtools = Windows.Security.Authentication.Web;
    var webAuthenticationBroker = webtools.WebAuthenticationBroker;
    var uri = 'https://accounts.google.com/o/oauth2/auth?'
        + 'redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob&'
        + 'response_type=code&'
        + 'client_id=1021343691223-1hnh53t8ak8kc17ar782kqjs9giq0hii.apps.googleusercontent.com&'
        + 'scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive';
    webAuthenticationBroker.authenticateAsync(webtools.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).then(function (response) {
        $('.user-interface').show();
        body = $('.interface-body');
        body.empty();
        body.append('<div class="verification-code">Please enter the verification code: <input id="verif-code" type="text"></input><br>'
            + '<button id="verif-button">Done</button><button id="cancel-button">Cancel</button></div>');
        $('#cancel-button').click(function () {
            WinJS.Navigation.navigate('/pages/addprovider/addprovider.html');
        });
        $('#verif-button').click(function () {
            var requestMessage, httpClient = new Windows.Web.Http.HttpClient();
            uri = 'https://www.googleapis.com/oauth2/v3/token?'
                + 'code=' + $('#verif-code').val().replace('/', '%2F') + '&'
                + 'redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob&'
                + 'client_id=1021343691223-1hnh53t8ak8kc17ar782kqjs9giq0hii.apps.googleusercontent.com&'
                + 'client_secret=HynYVlIhmN5wEFykSmyWEIFY&'
                + 'grant_type=authorization_code';
            requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
            httpClient.sendRequestAsync(requestMessage).then(function (success) {
                if (success.isSuccessStatusCode) {
                    success.content.readAsStringAsync().then(function (jsonInfo) {
                        gdriveUserInfo($.parseJSON(jsonInfo)['refresh_token'], false, func);
                    });
                } else {
                    $('.interface-body').append('<span class="error-message">Login failure: please check the code or retry to sign in later</span><br>');
                }
            });
        });
    });
}

// Get new token to use the REST API then get the user information
function gdriveUserInfo(refreshToken, reconnect, func) {
    var uri = 'https://www.googleapis.com/oauth2/v3/token?'
        + 'client_id=1021343691223-1hnh53t8ak8kc17ar782kqjs9giq0hii.apps.googleusercontent.com&'
        + 'client_secret=HynYVlIhmN5wEFykSmyWEIFY&'
        + 'refresh_token=' + refreshToken + '&'
        + 'grant_type=refresh_token';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                var token = $.parseJSON(jsonInfo)['access_token'];
                uri = 'https://www.googleapis.com/drive/v3/about?fields=storageQuota%2Cuser';
                requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get,
                    new Windows.Foundation.Uri(uri));
                requestMessage.headers.append('Authorization', 'Bearer ' + token);
                httpClient.sendRequestAsync(requestMessage).then(function (success) {
                    if (success.isSuccessStatusCode) {
                        success.content.readAsStringAsync().then(function (jsonInfo) {
                            var data = $.parseJSON(jsonInfo), provider;
                            provider = createProvider('gdrive', data['user']['emailAddress'], refreshToken, token,
                                    data['storageQuota']['limit'] - data['storageQuota']['usage'], data['storageQuota']['limit']);
                            gdriveFolderExist(provider, func);
                        });
                    } else {
                        log('gDrive UserInfo Failure ' + success.statusCode + ': ' + success.reasonPhrase);
                    }
                });
            });
        } else {
            log('Refresh Token Failure ' + success.statusCode + ': ' + success.reasonPhrase);
        }
    });
}

function gdriveExists(chunkName, provider, func, args) {
    var uri = 'https://www.googleapis.com/drive/v3/files?q=%22' + g_cloudFolderId
        + '%22+in+parents+and+name+%3D+%22' + chunkName + '%22+and+trashed+%3D+false';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    var myFiles;
    if (args == undefined) {
        args = { 'exists': false, 'chunks': [], 'providers': [], 'all': [] };
    } else {
        args.exists = false;
    }
    args.all.push(chunkName);
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                myFiles = $.parseJSON(jsonInfo)['files'];
                if (myFiles.length > 0) {
                    args.exists = true;
                    // Register the file ID
                    args.chunks.push({ 'name': chunkName, 'id': myFiles[0].id });
                    args.providers.push(provider);
                }
                func(args);
            });
        } else {
            func(args);
        }
    });
}

function gdriveFolderExist(provider, func) {
    var uri = 'https://www.googleapis.com/drive/v3/files?q=%22root%22+in+parents'
        + '+and+mimeType+%3D+%22application%2Fvnd.google-apps.folder%22+and+name+%3D+%22trustydrive%22+and+trashed+%3D+false';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    var myFiles;
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                myFiles = $.parseJSON(jsonInfo)['files'];
                if (myFiles.length == 0) {
                    // Create the app folder
                    uri = 'https://www.googleapis.com/drive/v3/files?fields=id';
                    requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
                    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
                    requestMessage.content = new Windows.Web.Http.HttpStringContent('{ "mimeType": "application/vnd.google-apps.folder", "name": "'
                        + g_cloudFolder.substr(0, g_cloudFolder.length - 1) + '" }', Windows.Storage.Streams.UnicodeEncoding.utf8, 'application/json; charset=UTF-8');
                    httpClient.sendRequestAsync(requestMessage).then(function (success) {
                        if (success.isSuccessStatusCode) {
                            success.content.readAsStringAsync().then(function (jsonInfo) {
                                g_cloudFolderId = $.parseJSON(jsonInfo)['id'];
                                func();
                            });
                        } else {
                            log('Failed to create the app folder ' + g_cloudFolder + ': ' + success.statusCode + ' - ' + success.reasonPhrase);
                        }
                    });
                } else {
                    g_cloudFolderId = myFiles[0].id;
                    func();
                }
            });
        } else {
            log('List Failure ' + success.statusCode + ': ' + success.reasonPhrase);
        }
    });
}

function gdriveUpload(reader, file, chunkIdx, data, provider, callNb) {
    // Create a new file with the name provided inside the 'data' buffer
    var uri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    requestMessage.content.headers.append('Content-Type', 'multipart/related; boundary=trustydrive_separator');
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                file.chunks[chunkIdx]['id'] = $.parseJSON(jsonInfo)['id'];
                uploadComplete(reader, file);
            });
        } else {
            log('gDrive Upload Failure ' + success.statusCode + ': ' + success.reasonPhrase);
            if (callNb < 5) {
                setTimeout(function () {
                    gdriveUpload(chunk, data, provider, callNb + 1);
                }, 1000);
            }
        }
    });
}

function gdriveUpdate(reader, file, chunkIdx, data, provider, callNb) {
    // Update the content of an existing file from its ID
    var uri = 'https://www.googleapis.com/upload/drive/v3/files/' + file.chunks[chunkIdx].id + '?uploadType=media';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.patch, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    if (callNb == undefined) {
        callNb = 0;
    }
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    requestMessage.content.headers.append('Content-Type', 'application/octet-stream');
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            uploadComplete(reader, file);
        } else {
            log('gDrive Update Failure ' + success.statusCode + ': ' + success.reasonPhrase);
            if (callNb < 5) {
                setTimeout(function () {
                    gdriveUpdate(reader, file, chunkIdx, data, provider, callNb + 1);
                }, 1000);
            }
        }
    });
}

function gdriveDownload(file, myProviders, folder, chunkIdx, provider, writer, callNb) {
    var uri = 'https://www.googleapis.com/drive/v3/files/' + file.chunks[chunkIdx].id + '?alt=media';
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
            log('gDrive Download Failure ' + success.statusCode + ': ' + success.reasonPhrase);
            if (callNb < 5) {
                setTimeout(function () {
                    gdriveDownload(file, myProviders, folder, chunkIdx, provider, writer, callNb + 1);
                }, 1000);
            } else {
                downloadComplete(file, myProviders, folder, writer);
            }
        }
    });
}

function gdriveDelete(chunkId, provider, nbDelete, folder, callNb) {
    var uri = 'https://www.googleapis.com/drive/v3/files/' + chunkId;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.delete, new Windows.Foundation.Uri(uri));
    var httpClient = new Windows.Web.Http.HttpClient();
    if (callNb == undefined) {
        callNb = 0;
    }
    if (chunkId == undefined) {
        log('ERROR can not delete the chunk ' + chunkId + ' from ' + provider.user);
    } else {
        requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
        httpClient.sendRequestAsync(requestMessage).then(function (response) {
            if (response.isSuccessStatusCode || response.statusCode == 404) {
                deleteComplete(nbDelete, folder);
            } else {
                log('ERROR can not delete the chunk ' + chunkId + ' from ' + provider.user + ': ' + response.statusCode);
                if (callNb < 5) {
                    setTimeout(function () {
                        gdriveDelete(chunkId, provider, nbDelete, folder, callNb + 1);
                    }, 500);
                } else {
                    // We delete the chunk later from the metadata editor
                    deleteComplete(nbDelete, folder);
                }
            }
        });
    }
}

function gdriveSync(chunks, provider, orphans) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://www.googleapis.com/drive/v3/files?q=%22' + g_cloudFolderId + '%22+in+parents+and+trashed+%3D+false';
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + provider.token);
    httpClient.sendRequestAsync(requestMessage).then(function (response) {
        response.content.readAsStringAsync().then(function (jsonInfo) {
            data = $.parseJSON(jsonInfo);
            if (data['files'] != undefined) {
                data.files.forEach(function (f) {
                    if (indexOfChunk(chunks, f['name']) == -1) {
                        orphans.push({ 'name': f['name'], 'id': f['id'], 'provider': provider });
                    }
                });
                g_complete++;
                syncComplete(orphans);
            } else {
                log('Google Drive Sync Error: no contents');
            }
        });
    });
}

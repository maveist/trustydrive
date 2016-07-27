/***
**  DROPBOX CONNECTOR
***/

/***
*   dropboxDelete: Delete one chunk
*       chunkName: the name of the chunk
*       provider: the provider information to the authentication process
*       nbDelete: the number of chunks to delete to complete the whole operation
*       func: the function to execute after the folder creation
*       callNb: counter to limit the number of attempts
***/
function dropboxDelete(chunkName, provider, nbDelete, func, callNb) {
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
            deleteComplete(nbDelete, func);
        } else {
            if (response.statusCode == 404) {
                deleteComplete(nbDelete, func);
            } else if (callNb < 5) {
                setTimeout(function () {
                    dropboxDelete(chunkName, provider, nbDelete, func, callNb + 1);
                }, 500);
            } else {
                // We delete the chunk later from the metadata editor
                deleteComplete(nbDelete, func);
            }
        }
    });
}

/***
*   dropboxExists: Check if the chunk exists
*       chunk: information about chunks (provider, name, id)
*       chunkIdx: the chunk index of the chunk to download
*       func: the function to execute after the checking
***/
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

/***
*   dropboxFolderExists: Check if the trustydrive folder exists
*       token: authentication token
*       func: the function to deal with the result of the checking
***/
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

/***
*   dropboxLogin: Login to a new provider
*       func: the function to execute after the login
***/
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
                $('.user-interface').hide();
            }, 3000);
        }
    });
}

/***
*   dropboxSync: Check if every file on the cloud is used by TrustyDrive, i.e., every file located in the trustydrive folder
*       chunks: the names of every chunk used by TrustyDrive
*       provider: the provider information to the authentication process
*       orphans: the list of chunks that are not used by TrustyDrive
***/
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
            }
        });
    });
}

/***
*   dropboxUpload: Upload one chunk
*       reader: the reader that reads the file
*       file: the file metadata
*       chunk: information about chunks (provider, name, id)
*       chunkIdx: the chunk index of the chunk to upload
*       data: the data to upload
*       callNb: counter to limit the number of attempts
***/
function dropboxUpload(reader, file, chunk, chunkIdx, data, callNb) {
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://content.dropboxapi.com/1/files_put/auto/' + g_cloudFolder + chunk.info[chunkIdx].name;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    if (callNb == undefined) {
        // Number of call with errors
        callNb = 0;
    }
    requestMessage.headers.append('Authorization', 'Bearer ' + chunk.provider.token);
    requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
    httpClient.sendRequestAsync(requestMessage).done(function (response) {
        if (response.isSuccessStatusCode) {
            uploadComplete(reader, file);
        } else {
            if (callNb < 5) {
                setTimeout(function () {
                    dropboxUpload(reader, file, chunk, chunkIdx, data, callNb + 1);
                }, 1000);
            }
        }
    });
}

/***
*   dropboxUploadFile: Measure the time to upload a file on dropbox
*       filename: name of the file located in the appData folder
*       token: the token for the authentication process
***/
function dropboxUploadFile(filename, token) {
    var start = new Date();
    start = start.getTime();
    var httpClient = new Windows.Web.Http.HttpClient();
    var uri = 'https://content.dropboxapi.com/1/files_put/auto/' + filename;
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.put, new Windows.Foundation.Uri(uri));
    requestMessage.headers.append('Authorization', 'Bearer ' + token);
    Windows.Storage.ApplicationData.current.localFolder.getFileAsync(filename).done(function (file) {
        Windows.Storage.FileIO.readBufferAsync(file).done(function (data) {
            requestMessage.content = new Windows.Web.Http.HttpBufferContent(data);
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
*   dropboxUserInfo: Get the user information (email, storage stats - free space & total space)
*       token: authentication token
*       reconnect: boolean, try to reconnect or not
*       func: the function to deal with the result of the checking
***/
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
                            // Create the 'trustydrive' folder
                            httpClient = new Windows.Web.Http.HttpClient();
                            uri = 'https://api.dropboxapi.com/1/fileops/create_folder?root=auto&path=%2F' + g_cloudFolder;
                            requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.post, new Windows.Foundation.Uri(uri));
                            requestMessage.headers.append('Authorization', 'Bearer ' + token);
                            httpClient.sendRequestAsync(requestMessage).then(function (response) {
                                if (response.isSuccessStatusCode) {
                                    createProvider('dropbox', data['email'], undefined, token, storage['quota'] - storage['shared'] - storage['normal'], storage['quota']);
                                    func();
                                } else {
                                    WinJS.Navigation.navigate('/pages/folder/folder.html', 'Can not create the trustydrive folder!. Please restart the application');
                                }
                            });
                        }
                    });
                } catch (ex) {
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

(function () {
    var workingDir;
    // APP URI: ms-appx://1cee9efb-b8db-46ff-b36e-6aad85b039fd/pages/mydocuments/mydocuments.js
    WinJS.UI.Pages.define('/pages/mydocuments/mydocuments.html', {
        ready: function () {
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            if (futureAccess.containsItem('PickedFolderToken')) {
                futureAccess.getFolderAsync('PickedFolderToken').done(function (folder) {
                    workingDir = folder;
                    var fileDiv = $('#files');
                    //    fileDiv.html('Parsing the working directory ' + folder.path + ':<br>');
                    //    folder.getFilesAsync().done(function (files) {
                    //        files.forEach(function (file) {
                    //            fileDiv.append(file.name + '<br>');
                    //        });
                    //    });
                });
            }
            login();
        }
    });

    function userinfo(token) {
        var fileDiv = $('#files');
        var httpClient = new Windows.Web.Http.HttpClient();
        var uri = new Windows.Foundation.Uri('https://api.dropboxapi.com/1/account/info');
        var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
        requestMessage.headers.append('Authorization', 'Bearer ' + token);
        httpClient.sendRequestAsync(requestMessage).done(
            function (success) {
                success.content.readAsStringAsync().done(function (string) {
                    fileDiv.append('Success:<br>');
                    fileDiv.append(string);
                });
            },
            function (error) {
                fileDiv.append('Error:<br>' + error);
            });
    }

    function download(filename, token) {
        var fileDiv = $('#files');
        var httpClient = new Windows.Web.Http.HttpClient();
        var uri = new Windows.Foundation.Uri('https://content.dropboxapi.com/1/files/auto/' + filename);
        var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
        var buffer = new Windows.Storage.Streams.Buffer(4096);
        requestMessage.headers.append('Authorization', 'Bearer ' + token);
        fileDiv.append('<br>HTTP request:<br>');
        //workingDir.createFileAsync("toto.txt").done(function () {
        //    fileDiv.append('HTTP request:<br>');
        //});
        httpClient.sendRequestAsync(requestMessage).done(
            function (success) {
                fileDiv.append('Success:<br>');
                success.content.readAsBufferAsync().done(function (buffer) {
                    //WARN: Overwrite the existing file
                    Windows.Storage.PathIO.writeBufferAsync(workingDir.path + '\\' + filename, buffer).done(function () {
                        fileDiv.append('File downloaded!<br>');
                    });
                });
            },
            function (error) {
                fileDiv.append('Error:<br>' + error);
            });
    }

    function login() {
        var credentials;
        var passwordVault = new Windows.Security.Credentials.PasswordVault();
        var fileDiv = $('#files');
        var webAuthenticationBroker = Windows.Security.Authentication.Web.WebAuthenticationBroker;
        var uri = 'https://www.dropbox.com/1/oauth2/authorize?';
        try {
            credentials = passwordVault.retrieve('trustydrive', 'dropbox');
            userinfo(credentials.password);
        } catch (ex) {
            uri += 'response_type=token&';
            uri += 'client_id=qsg6s8c70g3newe&';
            uri += 'redirect_uri=' + webAuthenticationBroker.getCurrentApplicationCallbackUri();
            webAuthenticationBroker.authenticateAsync(Windows.Security.Authentication.Web.WebAuthenticationOptions.none, new Windows.Foundation.Uri(uri)).done(
                function (success) {
                    var data = success.responseData;
                    var token = data.substring(data.indexOf('=') + 1, data.indexOf('&'));
                    credentials = new Windows.Security.Credentials.PasswordCredential('trustydrive', 'dropbox', token);
                    passwordVault.add(credentials);
                    fileDiv.append('<br>Success:<br>' + data + ', token=' + credentials.password);
                },
                function (error) {
                    fileDiv.append('Error:<br>' + error);
                });
        }
    }
})();
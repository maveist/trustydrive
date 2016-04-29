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
        if (response.responseStatus != 1) {
            body.append('<b>Connection error</b>');
            setTimeout(function () {
                $('.user-interface').hide();
            }, 2000);
        } else {
            $('.user-interface').show();
            body = $('.interface-body');
            body.empty();
            body.append('Please enter the verification code: <input id="verif-code" type="text"></input><br><button id="verif-button">Done</button>');
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
                        log('Login Failure ' + success.statusCode + ': ' + success.reasonPhrase);
                    }
                });
            });
        }
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
                            log('about my drive: ' + jsonInfo);
                            var data = $.parseJSON(jsonInfo), found = undefined;
                            // Check if the provider already exists, then just update the token
                            g_providers.forEach(function (p) {
                                if (p.provider == 'gdrive' && p.user == data['user']['emailAddress']) {
                                    found = p;
                                }
                            });
                            if (found == undefined) {
                                createProvider('gdrive', data['user']['emailAddress'], refreshToken, token,
                                    data['storageQuota']['limit'] - data['storageQuota']['usage'], data['storageQuota']['limit']);
                            } else {
                                p.token = token;
                            }
                            func();
                        });
                    } else {
                        log('List Failure ' + success.statusCode + ': ' + success.reasonPhrase);
                    }
                });
            });
        } else {
            log('Refresh Token Failure ' + success.statusCode + ': ' + success.reasonPhrase);
        }
    });
}

function driveList() {
    var uri = new Windows.Foundation.Uri('https://www.googleapis.com/drive/v3/files');
    var requestMessage = Windows.Web.Http.HttpRequestMessage(Windows.Web.Http.HttpMethod.get, uri);
    var httpClient = new Windows.Web.Http.HttpClient();
    accessToken = 'ya29.CjHTAtd1AEoG1Cj6RJn_1pAgoGFWFzm1-N6d5-jmRAzmAKFpzxRVlPYxK50d6332nWqB';
    requestMessage.headers.append('Authorization', 'Bearer ' + accessToken);
    httpClient.sendRequestAsync(requestMessage).then(function (success) {
        if (success.isSuccessStatusCode) {
            success.content.readAsStringAsync().then(function (jsonInfo) {
                var data, storage;
                log('about my drive: ' + jsonInfo);
            });
        } else {
            log('List Failure ' + success.statusCode + ': ' + success.reasonPhrase);
        }
    });
}

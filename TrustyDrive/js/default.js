// Global variables
var g_providers = [];

(function () {
    "use strict";

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var nav = WinJS.Navigation;

    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize your application here.
            } else {
                // TODO: This application was suspended and then terminated.
                // To create a smooth user experience, restore application state here so that it looks like the app never stopped running.
            }
            var start = WinJS.UI.processAll().then(function () {
                // Retrieve information from previous sessions
                var passwordVault = new Windows.Security.Credentials.PasswordVault();
                var provider;
                passwordVault.retrieveAll().forEach(function (credential) {
                    //passwordVault.remove(credential);
                    switch (credential.resource) {
                        case 'box':
                            break;
                        case 'dropbox':
                            dropbox_userinfo(passwordVault.retrieve(credential.resource, credential.userName).password, true);
                            break;
                        case 'googledrive':
                            break;
                        case 'onedrive':
                            break;
                    }
                });
                return nav.navigate("/pages/mydocuments/mydocuments.html");
            });
            args.setPromise(start);
        }
    };
    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state that needs to persist across suspensions here.
        // You might use the WinJS.Application.sessionState object, which is automatically saved and restored across suspension.
        // If you need to complete an asynchronous operation before your application is suspended, call args.setPromise().
    };

    nav.onnavigated = function (evt) {
        var contentHost = document.body.querySelector("#contenthost");
        var url = evt.detail.location;
        // Remove existing content from the host element.
        WinJS.Utilities.empty(contentHost);
        // Display the new page in the content host.
        WinJS.UI.Pages.render(url, contentHost);
    }

    app.start();
})();

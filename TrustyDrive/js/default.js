//TODO: manage folders
//TODO: Load/download automatically the configuration
//TODO: delete the existing chunks - dropboxDelete()
//BUG: Sometimes 'access is denied' error while opening files

// Global variables
const g_maxChunkSize = 10000
const g_configName = 'config1983stuff';
var g_chunks = [];
var g_providers = [];
var g_workingDir;
var g_complete;
var g_metadata = {};

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
                // Get access to the working directory

                var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
                if (futureAccess.containsItem('PickedFolderToken')) {
                    futureAccess.getFolderAsync('PickedFolderToken').done(function (folder) {
                        g_workingDir = folder;
                        WinJS.Navigation.navigate('/pages/mydocuments/mydocuments.html', { 'folder': 'home' });
                    });
                }
            });
            args.setPromise(start);
        }
    }

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state that needs to persist across suspensions here.
        // You might use the WinJS.Application.sessionState object, which is automatically saved and restored across suspension.
        // If you need to complete an asynchronous operation before your application is suspended, call args.setPromise().
    }

    nav.onnavigated = function (evt) {
        var contentHost = document.body.querySelector("#content");
        var url = evt.detail.location;
        // Remove existing content from the host element.
        WinJS.Utilities.empty(contentHost);
        // Display the new page in the content host.
        WinJS.UI.Pages.render(url, contentHost);
    }

    app.start();
})();

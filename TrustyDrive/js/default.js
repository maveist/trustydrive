//TODO Confirmation lors de la suppression d'un fichier ou d'un répertoire
//TODO Generate random names for chunks
//TODO Recherche de chunks présents dans le cloud mais non utilisés dans des fichiers (libération d'espace de stockage)
//TODO Login window
//TODO Network disconnections

// Global variables
const g_maxChunkSize = 10000;
const g_configName = 'config1983stuff';
// Do not forget the '/' at the end of the folder name
const g_cloudFolder = 'trustydrive/';
var g_homeFolderName = 'Home';
var g_chunks = [];
var g_providers = [];
var g_workingFolder;
var g_complete;
var g_files = {};
var g_folders = {};

(function () {
    "use strict";

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;

    WinJS.Navigation.onnavigated = function (evt) {
        var contentHost = document.getElementById("content");
        var url = evt.detail.location;
        // Remove existing content from the host element.
        WinJS.Utilities.empty(contentHost);
        // Display the new page in the content host.
        WinJS.UI.Pages.render(url, contentHost);
    }

    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize your application here.
            } else {
                // TODO: This application was suspended and then terminated.
                // To create a smooth user experience, restore application state here so that it looks like the app never stopped running.
            }
            args.setPromise(WinJS.UI.processAll());
            // Get access to the working directory
            var localSettings = Windows.Storage.ApplicationData.current.localSettings;
            if (localSettings.values['home'] != undefined) {
                g_homeFolderName = localSettings.values['home'];
            }
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            if (futureAccess.containsItem('PickedFolderToken')) {
                futureAccess.getFolderAsync('PickedFolderToken').done(function (folder) {
                    g_workingFolder = folder;
                    WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                });
            } else {
                WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
            }
        }
    }

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state that needs to persist across suspensions here.
        // You might use the WinJS.Application.sessionState object, which is automatically saved and restored across suspension.
        // If you need to complete an asynchronous operation before your application is suspended, call args.setPromise().
    }

    app.start();
})();

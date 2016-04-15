﻿//TODO Sort CSS by alphabetic order
//TODO Customize settings panel
//NOTE If no file in the folder, do I delete the folder ?
//LOGIN test / toto

// Global variables
// Do not forget the '/' at the end of the folder name
const g_cloudFolder = 'trustydrive/';
const g_configName = 'config1983stuff';
const g_maxChunkSize = 10000;
const g_td_version = '0.1.0';
var g_chunks = [];
var g_complete;
var g_files = {};
var g_folders = {};
var g_homeFolderName = 'Home';
var g_providers = [];
var g_workingFolder;

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
                futureAccess.getFolderAsync('PickedFolderToken').then(function (folder) {
                    g_workingFolder = folder;
                    // Go to login.html then connect to providers
                    WinJS.Navigation.navigate('/pages/login/login.html', '');
                }, function (error) {
                    // Go to login.html to load the CSS style and then jump to wfolder.html
                    WinJS.Navigation.navigate('/pages/login/login.html', '');
                });
            } else {
                // Go to login.html to load the CSS style and then jump to wfolder.html
                WinJS.Navigation.navigate('/pages/login/login.html', '');
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

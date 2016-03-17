WinJS.UI.Pages.define('/pages/wfolder/wfolder.html', {
    ready: function () {
        var index = 0;
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        });
        $('.working-folder').click(function () {
            var folderPicker = new Windows.Storage.Pickers.FolderPicker();
            var futureAccess = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
            folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.downloads;
            // Useless for the folder selection but required by the API
            folderPicker.fileTypeFilter.replaceAll(['.txt', '.pdf', '.jpg']);
            folderPicker.pickSingleFolderAsync().then(function (folder) {
                if (folder) {
                    futureAccess.addOrReplace('PickedFolderToken', folder);
                    g_workingFolder = folder;
                    WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                } else {
                    // The picker was dismissed with no selected file
                }
            });
        });
    }
})

function chunkStatus(args) {
    var status = $('#' + args.id);
    if (args.exists) {
        status.html('<b>SUCCESS</b>');
        status.css('color', 'green');
    } else {
        status.html('<b>ERROR</b>');
        status.css('color', 'red');
    }
}

function replaceAnnoyingChars(annoying) {
    return annoying.replace(' ', '_');
}

function sizeString(size) {
    var res = {};
    if (size > 999999999999) {
        res.value = (size / 1000000000).toFixed(1);
        res.unit = 'TBytes';
    } else if (size > 999999999) {
        res.value = (size / 1000000).toFixed(1);
        res.unit = 'GBytes';
    } else if (size > 999999) {
        res.value = (size / 1000000).toFixed(1);
        res.unit = 'MBytes';
    } else if (size > 999) {
        res.value = (size / 1000).toFixed(1);
        res.unit = 'KBytes';
    } else {
        res.value = size;
        res.unit = 'Bytes';
    }
    return res;
}

function renameFile(metadata, newName, folder) {
    if (newName.length > 0 && g_files[newName] == undefined) {
        delete g_files[metadata.name];
        metadata.name = newName;
        g_files[newName] = metadata;
        WinJS.Navigation.navigate('/pages/file/file.html', { 'md': metadata, 'folder': folder });
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'The file <b>' + newName + '</b> already exists!');
    }
}

function cloudDelete(metadata, folder, nbDelete) {
    var index = true;
    var myProviders = [];
    g_complete = 0;
    metadata.providers.forEach(function (p) {
        var temp = getProvider(p.provider, p.user);
        if (temp == undefined) {
            index = false;
            log('Can not get the provider ' + p.provider + '/' + p.user);
        } else {
            myProviders.push(temp);
        }
    });
    if (index) {
        for (index = 0 ; index < metadata.chunks.length; index++) {
            dropboxDelete(metadata.chunks[index], myProviders[index % myProviders.length].token, nbDelete, folder);
        }
        delete g_files[metadata.name];
        index = folder.files.indexOf(metadata);
        if (index > -1) {
            folder.files.splice(index, 1);
        }
    }
}

function deleteComplete(nbDelete, folder) {
    g_complete++;
    if (g_complete == nbDelete) {
        WinJS.Navigation.navigate('/pages/folder/folder.html', folder);
    } else {
        progressBar(g_complete, nbDelete + 1, 'Number of Deleted Chunks: ' + g_complete);
    }
}

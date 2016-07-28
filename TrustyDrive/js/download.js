/***
*   downloadMetadata: check whether metadata chunks exist, 
*       NOTE: there is only 1 chunk per provider for the metadata
***/
function downloadMetadata() {
    var metadata = g_files[g_metadataName];
    g_complete = 0;
    progressBar(0, metadata.chunks.length + 1, 'Initialization', 'Downloading the Metadata');
    metadata.chunks.forEach(function (c) {
        switch (c.provider.name) {
            case 'dropbox':
                dropboxExists(c, 0, checkMetadataComplete);
                break;
            case 'gdrive':
                gdriveExists(c, 0, checkMetadataComplete);
                break;
            case 'onedrive':
                oneDriveExists(c, 0, checkMetadataComplete);
                break;
        }
    });
}

function fakeDownload(idx, nbChunks) {
    idx++;
    if (idx == nbChunks + 2) {
        WinJS.Navigation.navigate('/pages/login/login.html', 'The user "' + g_files[g_metadataName].user + '" does not exist or the password is incorrect.');
    } else {
        setTimeout(function () {
            progressBar(idx, nbChunks + 1, 'Number of Downloaded Chunks: ' + idx, 'Downloading...');
            fakeDownload(idx, nbChunks);
        }, 600);
    }
}

/***
*   checkMetadataComplete: start the download of existing metadata chunks
***/
function checkMetadataComplete() {
    var metadata = g_files[g_metadataName];
    var i, writer;
    g_complete++;
    if (g_complete == metadata.chunks.length) {
        // Remove chunks that do not exist
        for (i = metadata.chunks.length - 1; i > -1; i--) {
            if (!metadata.chunks[i].info[0].exists) {
                metadata.chunks.splice(i, 1);
                metadata.nb_chunks--;
            }
        }
        if (metadata.chunks.length == 0) {
            progressBar(0, g_complete + 1, 'Initialization', 'Downloading the Metadata');
            fakeDownload(-1, g_complete);
        } else if (metadata.chunks.length == 1) {
            WinJS.Navigation.navigate('/pages/login/login.html', 'There is only one chunk for metadata. The metadata are illegible!'
                + 'You have to re-create your user.');
        } else {
            downloadFile(metadata, g_files[g_homeFolderName]);
        }
    }
}

/***
*   downloadFile: download one file
*       file: the file metadata
*       folder: the folder to display when the download is completed
***/
function downloadFile(file, folder) {
    var downloader = new breaker.Instance();
    var chunkNameList = [], chunkIdList = [], providerNameList = [], providerTokenList = [], cloudFolderList = [];
    file2lists(file, chunkNameList, chunkIdList, providerNameList, providerTokenList, cloudFolderList);
    if (file.name == g_metadataName) {
        downloader.downloadFile(g_workingFolder, file.name, chunkNameList, chunkIdList, providerNameList, providerTokenList, cloudFolderList);
    } else {
        downloader.downloadFile(g_workingFolder, file.name, chunkNameList, chunkIdList, providerNameList, providerTokenList, cloudFolderList);
    }
    progressBar(0, file.nb_chunks + 1, 'Initialization', 'Downloading the File ' + file.name);
    checkDownloading(downloader, file, folder);
}

/***
*   checkDownloading: detect the end of the downloading process
*       downloader: the downloader instance that downloads the file
*       file: the metadata of the file
*       folder: the folder including the file
***/
function checkDownloading(downloader, file, folder) {
    var pwd, error = "";
    progressBar(downloader.result.length, file.nb_chunks + 1, 'Number of Downloaded Chunks: ' + downloader.result.length, 'Downloading...');
    if (downloader.result.every(r => r != 'error')) {
        if (downloader.downloaded) {
            if (file.name == g_metadataName) {
                try {
                    g_files = JSON.parse(downloader.metadata, function (k, v) {
                        if (k == g_metadataName) {
                            // Do not modify the information of the metadata
                            pwd = v.password;
                            return g_files[g_metadataName];
                        } else {
                            return v;
                        }
                    });
                    if (pwd == g_files[g_metadataName].password) {
                        buildFolderStructure();
                        // Add provider information to the metadata
                        $.each(g_files, function (useless, file) {
                            file.chunks.forEach(function (c) {
                                g_providers.forEach(function (fullp) {
                                    if (c.provider.user == fullp.user && c.provider.name == fullp.name) {
                                        c.provider = fullp;
                                    }
                                });
                            });
                        });
                    } else {
                        // Delete the metadata
                        g_files = { [g_metadataName]: g_files[g_metadataName] };
                        error = 'The user "' + g_files[g_metadataName].user + '" does not exist or the password is incorrect.';
                    }
                } catch (ex) {
                    error = 'The metadata file is malformed. Please check your cloud accounts configuration in Settings'
                        + ', maybe some providers are missing!'
                        + '<br>To reset your metadata (<b>all files stored in TrustyDrive will be lost</b>),'
                        + ' delete the trustydrive folder on the following accounts:<div>';
                    g_providers.forEach(function (p) {
                        error += p.name + ' - ' + p.user + '<br>';
                    });
                    error += '</div>';
                }
                setTimeout(function () {
                    if (error.length == 0) {
                        WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
                    } else {
                        WinJS.Navigation.navigate('/pages/login/login.html', error);
                    }
                }, 1000);
            } else {
                setTimeout(function () {
                    if ($('.user-interface').is(':visible')) {
                        $('.user-interface').hide();
                    }
                    showDownloadedFileMenu(file);
                }, 300);
            }
        } else {
            setTimeout(function () {
                checkDownloading(downloader, file, folder);
            }, 1000);
        }
    } else {
        WinJS.Navigation.navigate('/pages/login/login.html', 'Download failure, please check the provider list');
    }
}

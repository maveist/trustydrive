WinJS.UI.Pages.define('/pages/editor/editor.html', {
    ready: function () {
        var index = 0;
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        });
        // Get parameters
        $.each(g_files, function (useless, file) {
            var account, chunkName;
            $('.editor-list').append('<div class="editor-item"><div class="item-title">' + file.name +
                '<button id="show-' + index + '" class="edit-button">Details</button>' +
                '</div><div id="chunks-' + index + '" class="chunk-list"></div></div>');
            $('#show-' + index).click(function () {
                var i, list, provider, idx = $(this).attr('id').indexOf('-');
                idx = $(this).attr('id').substr(idx);
                list = $('#chunks' + idx);
                if (list.children().length > 0) {
                    $(this).text('Details');
                    list.fadeOut('fast', function () {
                        list.empty();
                    });
                } else {
                    $(this).text('Hide');
                    log('editor nb chunks: ' + file.chunks.length);
                    for (i = 0; i < file.chunks.length; i++) {
                        chunkName = file.chunks[i];
                        if (file.name == g_configName) {
                            provider = g_providers[i % g_providers.length];
                        } else {
                            provider = file.providers[i % file.providers.length];
                            provider = getProvider(provider.provider, provider.user);
                        }
                        account = provider.provider + '/' + provider.user;
                        if (account.length < 28) {
                            list.append('<div class="chunk-item"><div class="chunk-name">' + chunkName + '</div><div class="chunk-provider">' +
                                 account + '</div><div id="' + chunkName + '" class="chunk-status">??</div></div>');
                        } else {
                            list.append('<div class="chunk-item"><div class="chunk-name">' + chunkName + '</div><div class="chunk-provider">' +
                                 account.substr(0, 23) + '...</div><div id="' + chunkName + '" class="chunk-status">??</div></div>');
                        }
                        dropboxExists(chunkName, provider.token, chunkStatus, { 'id': chunkName });
                    }
                    list.fadeIn('fast');
                }
            });
            index++;
        });
    }
})

function chunkStatus(args) {
    var status = $('#' + args.id);
    if (args.exists) {
        log('editor FOUND: ' + status);
        status.html('<b>SUCCESS</b>');
        status.css('color', 'green');
    } else {
        log('editor NOT FOUND');
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

function renameFile(file, newName, folder) {
    if (newName.length > 0 && g_files[newName] == undefined) {
        delete g_files[file.name];
        file.name = newName;
        g_files[newName] = file;
        WinJS.Navigation.navigate('/pages/file/file.html', { 'file': file, 'folder': folder });
    } else {
        WinJS.Navigation.navigate('/pages/folder/folder.html', 'The file <b>' + newName + '</b> already exists!');
    }
}

function cloudDelete(file, folder, nbDelete) {
    var index = true;
    var myProviders = [];
    g_complete = 0;
    file.providers.forEach(function (p) {
        var temp = getProvider(p.provider, p.user);
        if (temp == undefined) {
            index = false;
            log('Can not get the provider ' + p.provider + '/' + p.user);
        } else {
            myProviders.push(temp);
        }
    });
    if (index) {
        for (index = 0 ; index < file.chunks.length; index++) {
            dropboxDelete(file.chunks[index], myProviders[index % myProviders.length].token, nbDelete, folder);
        }
        delete g_files[file.name];
        index = folder.files.indexOf(file);
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

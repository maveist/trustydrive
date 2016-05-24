/***
*   metadata scope: read your metadata and check the state of your chunks
***/
WinJS.UI.Pages.define('/pages/metadata/metadata.html', {
    ready: function () {
        var allChunks = {}, index = 0;
        g_providers.forEach(function (p) {
            allChunks[metadataChunkName(p)] = [];
        });
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        });
        // List all files
        $.each(g_files, function (useless, file) {
            var account, chunkName, listWidth;
            file.chunks.forEach(function (c) {
                c.info.forEach(function (i) {
                    allChunks[metadataChunkName(c.provider)].push(i.name);
                });
            });
            listWidth = $('.editor-list').width();
            $('.editor-list').append('<div class="editor-item"><div class="item-title">' + longName(file.name, 40) +
                '<button id="show-' + index + '" class="edit-button">Details</button>' +
                '</div><div id="chunks-' + index + '" class="chunk-list"></div></div>');
            $('#show-' + index).click(function () {
                var providerDiv, chunkDiv;
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
                    file.chunks.forEach(function (c) {
                        $.each(c.info, function (idx, i) {
                            chunkName = i.name;
                            account = c.provider.name + '/' + c.provider.user
                            chunkDiv = $('<div title="' + chunkName + '" class="chunk-name"></div>');
                            providerDiv = $('<div class="chunk-provider"></div>');
                            // Remove the chunk status - 90px including the rigth margin
                            listWidth -= 90;
                            if (listWidth < 200) {
                                chunkDiv.css('width', listWidth / 2);
                                // 10 pixels / character
                                chunkDiv.html(longName(chunkName, listWidth / 20));
                                providerDiv.css('width', listWidth / 2);
                                providerDiv.html(longName(account, listWidth / 20));
                            } else {
                                chunkDiv.css('width', listWidth * 0.4);
                                chunkDiv.html(longName(chunkName, listWidth * 0.4 / 10));
                                providerDiv.css('width', listWidth * 0.6);
                                providerDiv.html(longName(account, listWidth * 0.6 / 10));
                            }
                            listWidth += 90;
                            list.append($('<div class="chunk-item"></div>').append(chunkDiv).append(providerDiv)
                                .append('<div id="' + chunkName + '" class="chunk-status">??</div>'));
                            switch (c.provider.name) {
                                case 'dropbox':
                                    dropboxExists(c, idx, chunkStatus);
                                    break;
                                case 'gdrive':
                                    gdriveExists(c, idx, chunkStatus);
                                    break;
                                case 'onedrive':
                                    oneDriveExists(c, idx, chunkStatus);
                                    break;
                            }
                        });
                    });
                    list.fadeIn('fast');
                }
            });
            index++;
        });//$.each(g_files
        // Check consistency button
        $('#orphaned-files').click(function () {
            var orphans = [];
            g_complete = 0;
            g_providers.forEach(function (p) {
                switch (p.name) {
                    case 'dropbox':
                        dropboxSync(allChunks[metadataChunkName(p)], p, orphans);
                        break;
                    case 'gdrive':
                        gdriveSync(allChunks[metadataChunkName(p)], p, orphans);
                        break;
                    case 'onedrive':
                        oneDriveSync(allChunks[metadataChunkName(p)], p, orphans);
                        break;
                }
            });
        });
    }
})

/***
*   chunkStatus: check if the chunk exists on the cloud (SUCCESS: the chunk exists, ERROR: there is no chunk)
***/
function chunkStatus(chunk, chunkIdx) {
    var status = $('#' + chunk.info[chunkIdx].name);
    if (chunk.info[chunkIdx].exists) {
        status.html('<b>SUCCESS</b>');
        status.css('color', 'green');
    } else {
        status.html('<b>ERROR</b>');
        status.css('color', 'red');
    }
}

/***
*  deleteOrphansDialog: dialog for confirmation before deleting
*       orphans: information about chunks to delete
***/
function deleteOrphansDialog(orphans) {
    var html = '<div class="interface-question">';
    if (orphans.length > 0) {
        html += '<b>' + orphans.length + ' unused chunks</b> have been detected. Would you like to delete them?<br><div class="orphan-list">';
        orphans.forEach(function (o) {
            html += o.name + ' on ' + o.provider.name + '/' + o.provider.user + '<br>';
        });
        html += '</div><div id="delete-button" class="interface-button">DELETE</div>' +
            '<div id="cancel-button" class="interface-button">CANCEL</div>';
        html += '</div>';
        $('.interface-body').empty();
        $('.user-interface').show();
        $('.interface-body').append(html);
        $('#delete-button').click(function () {
            g_complete = 0;
            progressBar(g_complete, orphans.length + 1, 'Initialization', 'Delete Unused Chunks');
            orphans.forEach(function (o) {
                switch (o.provider.name) {
                    case 'dropbox':
                        dropboxDelete(o.name, o.provider, orphans.length, function () {
                            WinJS.Navigation.navigate('/pages/metadata/metadata.html');
                        });
                        break;
                    case 'gdrive':
                        gdriveDelete(o.id, o.provider, orphans.length, function () {
                            WinJS.Navigation.navigate('/pages/metadata/metadata.html');
                        });
                        break;
                    case 'onedrive':
                        oneDriveDelete(o.id, o.provider, orphans.length, function () {
                            WinJS.Navigation.navigate('/pages/metadata/metadata.html');
                        });
                        break;
                }
            });
        });
        $('#cancel-button').click(function () {
            $('.user-interface').hide();
        });
    } else {
        html += 'Checking consistency complete with success. No chunk to delete!';
        html += '<br><br><div id="close-button" class="interface-button">CLOSE</div></div>';
        $('.interface-body').empty();
        $('.user-interface').show();
        $('.interface-body').append(html);
        $('#close-button').click(function () {
            $('.user-interface').hide();
        });
    }
}

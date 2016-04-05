WinJS.UI.Pages.define('/pages/editor/editor.html', {
    ready: function () {
        var index = 0;
        $('.upper-back').click(function () {
            WinJS.Navigation.navigate('/pages/folder/folder.html', g_folders[g_homeFolderName]);
        });
        // Get parameters
        $.each(g_files, function (useless, file) {
            var account, chunkName, listWidth;
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
                    for (i = 0; i < file.chunks.length; i++) {
                        chunkName = file.chunks[i];
                        if (file.name == g_configName) {
                            provider = g_providers[i % g_providers.length];
                        } else {
                            provider = file.providers[i % file.providers.length];
                            provider = getProvider(provider.provider, provider.user);
                        }
                        account = provider.provider + '/' + provider.user
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
        status.html('<b>SUCCESS</b>');
        status.css('color', 'green');
    } else {
        status.html('<b>ERROR</b>');
        status.css('color', 'red');
    }
}

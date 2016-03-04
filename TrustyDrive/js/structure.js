function initHomeFolder() {
    var home = { 'name': 'home', 'kind': 'folder', 'files': [], 'folders': [] };
    g_folders = { 'home': home };
    return home;
}

function createElement(name, kind) {
    var element;
    if (kind == 'file') {
        if (g_files[name] == undefined) {
            element = { 'name': name, 'kind': 'file', 'chunks': [] };
            g_files[name] = element;
            return element;
        } else {
            return g_files[name];
        }
    } else if (kind = 'folder') {
        if (g_folders[name] == undefined) {
            element = { 'name': name, 'kind': 'folder', 'files': [], 'folders': [] };
            g_folders[name] = element;
            return element;
        } else {
            return g_folders[name];
        }
    }
}

function addToFolder(parent, child) {
    var index, path = '';
    if (parent != undefined && child['kind'] != undefined) {
        if (child['kind'] == 'folder') {
            if (child['father'] != undefined) {
                index = child.father.folders.indexOf(child);
                if (index > -1) {
                    child.father.folders.splice(index, 1);
                }
            }
            parent.folders.push(child);
            child['father'] = parent;
        } else {
            parent['files'].push(child);
            // Compute the path of the parent folder
            while (parent.name != 'home') {
                path = parent.name + '/' + path;
                parent = parent.father;
            }
            path = '/' + path;
            child['path'] = path;
        }
    }
}

function buildFolderStructure() {
    var debug = $('#debug');
    var path, current, child;
    var home = initHomeFolder();
    $.each(g_files, function (name, file) {
        current = home;
        if (file['path'] == undefined || file.path == '/') {
            file['kind'] = 'file';
            addToFolder(g_folders['home'], file);
        } else {
            path = file.path.split('/');
            $.each(path, function (useless, folderName) {
                if (folderName.length > 0) {
                    child = undefined;
                    current.folders.forEach(function (f) {
                        if (name == folderName) {
                            child = f;
                        }
                    });
                    if (child == undefined) {
                        child = createElement(folderName, 'folder');
                        addToFolder(current, child);
                    }
                    current = child;
                }
            });
            addToFolder(child, file);
        }
    });
}

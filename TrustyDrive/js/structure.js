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
            setPath(parent, child);
        }
    }
}

function buildFolderStructure() {
    var path, current, child;
    $.each(g_files, function (name, file) {
        current = g_folders[g_homeFolderName];
        if (file['path'] == undefined || file.path == '/') {
            file['kind'] = 'file';
            addToFolder(g_folders[g_homeFolderName], file);
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

function createElement(name, kind) {
    var element;
    if (kind == 'file') {
        if (g_files[name] == undefined) {
            element = { 'name': name, 'kind': 'file', 'chunks': [], 'providers': [] };
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

function longName(name, limit) {
    if (limit == undefined) {
        limit = 25;
    }
    if (name.length > limit) {
        return name.substr(0, limit - 3) + '...';
    } else {
        return name;
    }
}

function setPath(folder, file) {
    var path = '';
    // Set the path of the file from the folder
    while (folder.name != g_homeFolderName) {
        path = folder.name + '/' + path;
        folder = folder.father;
    }
    path = '/' + path;
    file['path'] = path;
}

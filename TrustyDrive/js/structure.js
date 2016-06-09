/***
*   addToFolder: add a file or a folder object to the system
*       parent: the parent folder
*       child: the file/folder to link to its parent
***/
function addToFolder(parent, child) {
    var index, path = '';
    if (parent != undefined) {
        if (child.folders != undefined) {
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


/***
*   buildFolderStructure: create folders in the g_folders list and link files and folders from file pathes
***/
function buildFolderStructure() {
    var path, current, child;
    $.each(g_files, function (name, file) {
        current = g_folders[g_homeFolderName];
        if (file['path'] == undefined || file.path == '/') {
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

/***
*   createElement: create a file or a folder object
*       name: the name of the object
*       kind: the kind of the object (file, folder)
***/
function createElement(name, kind) {
    var element;
    if (kind == 'file') {
        if (g_files[name] == undefined) {
            element = { 'name': name, 'nb_chunks': 0, 'chunks': []};
            g_files[name] = element;
            return element;
        } else {
            return g_files[name];
        }
    } else if (kind == 'folder') {
        if (g_folders[name] == undefined) {
            element = { 'name': name, 'files': [], 'folders': [] };
            g_folders[name] = element;
            return element;
        } else {
            return g_folders[name];
        }
    }
}

/***
*   longName: shorten file/folder names to improve the user experience
*       name: the name of the file/folder
*       limit: the maximum number of caracters
***/
function longName(name, limit) {
    if (limit == undefined) {
        limit = 24;
    }
    if (name.length > limit) {
        return name.substr(0, limit - 3) + '...';
    } else {
        return name;
    }
}

/***
*   setPath: set the path of a file
*       folder: the folder that contains the file
*       file: the file to update
***/
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

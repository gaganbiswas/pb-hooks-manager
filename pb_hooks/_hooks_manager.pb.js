routerAdd(
  "GET",
  "/hooks-manager/folder",
  function (e) {
    const IGNORE = ["_hooks_manager.pb.js"];
    let path = e.queryParam("path");
    if (path && path.includes("../")) throw BadRequestError("Escape denied");

    return e.json(200, recurseFolder(__hooks + (path ? "/" + path : "")));

    function recurseFolder(folder) {
      let result = [];
      let list = $os.readDir(folder);
      list.sort();

      for (let file of list) {
        const fileName = file.name();
        if (file.isDir()) {
          let child = {};
          child[fileName] = recurseFolder(folder + "/" + fileName);
          result.push(child);
        } else if (!IGNORE.includes(fileName)) {
          let routes = [];
          try {
            const content = toString($os.readFile(folder + "/" + fileName));
            // Regex to find: routerAdd("METHOD", "/path"
            const regex =
              /routerAdd\s*\(\s*["']([A-Z]+)["']\s*,\s*["']([^"']+)["']/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
              routes.push({ method: match[1], path: match[2] });
            }
          } catch (err) {}

          result.push({
            name: fileName,
            type: "file",
            routes: routes,
          });
        }
      }
      return result;
    }
  },
  $apis.requireAdminAuth()
);

routerAdd(
  "PUT",
  "/hooks-manager/folder",
  function (e) {
    if ($app.settings().meta.hideControls)
      throw BadRequestError(
        'Read Only Mode. Switch off "Hide collection create and edit controls" in PocketBase admin dashboard at /_/#/settings'
      );

    let path = e.queryParam("path");
    if (!path) throw BadRequestError("Must supply path URL parameter");
    if (path.includes("../"))
      throw BadRequestError("Can't escape out of pb_hooks folder");

    let newPath = $apis.requestInfo(e).data.path;
    if (newPath) {
      if (newPath.includes("../"))
        throw BadRequestError("Can't escape out of pb_hooks folder");
      $os.rename(__hooks + "/" + path, __hooks + "/" + newPath);
    } else $os.mkdir(__hooks + "/" + path, 0o755);
  },
  $apis.requireAdminAuth()
);

routerAdd(
  "GET",
  "/hooks-manager/file",
  function (e) {
    let path = e.queryParam("path");
    if (!path) throw BadRequestError("Must supply path URL parameter");

    if (path.includes("../"))
      throw BadRequestError("Can't escape out of pb_hooks folder");
    return e.string(200, toString($os.readFile(__hooks + "/" + path)));
  },
  $apis.requireAdminAuth()
);

routerAdd(
  "PUT",
  "/hooks-manager/file",
  function (e) {
    if ($app.settings().meta.hideControls)
      throw BadRequestError(
        'Read Only Mode. Switch off "Hide collection create and edit controls" in PocketBase admin dashboard at /_/#/settings'
      );

    let path = e.queryParam("path");
    if (!path) throw BadRequestError("Must supply path URL parameter");
    if (path.includes("../"))
      throw BadRequestError("Can't escape out of pb_hooks folder");

    let newPath = $apis.requestInfo(e).data.path;
    if (newPath) {
      if (newPath.includes("../"))
        throw BadRequestError("Can't escape out of pb_hooks folder");
      $os.rename(__hooks + "/" + path, __hooks + "/" + newPath);
      path = newPath;
    }

    $os.writeFile(
      __hooks + "/" + path,
      $apis.requestInfo(e).data.contents,
      0o644
    );
  },
  $apis.requireAdminAuth()
);

routerAdd(
  "DELETE",
  "/hooks-manager/file",
  function (e) {
    if ($app.settings().meta.hideControls)
      throw BadRequestError(
        'Read Only Mode. Switch off "Hide collection create and edit controls" in PocketBase admin dashboard at /_/#/settings'
      );

    let path = e.queryParam("path");
    if (!path) throw BadRequestError("Must supply path URL parameter");
    if (path.includes("../"))
      throw BadRequestError("Can't escape out of pb_hooks folder");

    $os.removeAll(__hooks + "/" + path);
  },
  $apis.requireAdminAuth()
);

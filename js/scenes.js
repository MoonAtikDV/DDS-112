window.Scenes = {
  loadIndex: function () {
    return fetch("scenes/index.json")
      .then(function (res) {
        if (!res.ok) throw new Error("index");
        return res.json();
      })
      .then(function (data) {
        AppState.scenesList = data.scenes || [];
        return AppState.scenesList;
      })
      .catch(function () {
        AppState.scenesList = [];
        return [];
      });
  },

  loadScene: function (filename) {
    if (AppState.scenesCache[filename]) {
      return Promise.resolve(AppState.scenesCache[filename]);
    }
    return fetch("scenes/" + filename)
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data) AppState.scenesCache[filename] = data;
        return data;
      })
      .catch(function () {
        return null;
      });
  },

  randomScene: function () {
    var self = this;
    var list = AppState.scenesList || [];
    if (!list.length) {
      return this.loadIndex().then(function () {
        return self.randomScene();
      });
    }
    var name = list[Math.floor(Math.random() * list.length)];
    return this.loadScene(name).then(function (scene) {
      if (scene) return scene;
      return self.loadScene(list[0]);
    });
  }
};

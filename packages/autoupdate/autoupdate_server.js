// Publish the current client version to the client.  When a client
// sees the subscription change and that there is a new version of the
// client available on the server, it can reload.
//
// By default the current client version is identified by a hash of
// the client resources seen by the browser (the HTML, CSS, code, and
// static files in the `public` directory).
//
// If the environment variable `AUTOUPDATE_VERSION` is set it will be
// used as the client id instead.  You can use this to control when
// the client reloads.  For example, if you want to only force a
// reload on major changes, you can use a custom AUTOUPDATE_VERSION
// which you only change when something worth pushing to clients
// immediately happens.
//
// For backwards compatibility, SERVER_ID can be used instead of
// AUTOUPDATE_VERSION.
//
// The server publishes a `meteor_autoupdate_clientVersions`
// collection.  The contract of this collection is that each document
// in the collection represents an acceptable client version, with the
// `_id` field of the document set to the client id.
//
// An "unacceptable" client version, for example, might be a version
// of the client code which has a severe UI bug, or is incompatible
// with the server.  An "acceptable" client version could be one that
// is older than the latest client code available on the server but
// still works.
//
// One of the published documents in the collection will have its
// `current` field set to `true`.  This is the version of the client
// code that the browser will receive from the server if it reloads.
//
// In this implementation only one document is published, the current
// client version.  Developers can easily experiment with different
// versioning and updating models by forking this package.

Autoupdate = {};

// The client hash includes __meteor_runtime_config__, so wait until
// all packages have loaded and have had a chance to populate the
// runtime config before using the client hash as our default auto
// update version id.

Autoupdate.autoupdateVersion = null;

var autoupdateVersionRefreshable = null;

Meteor.startup(function () {
  // Allow people to override Autoupdate.autoupdateVersion before
  // startup. Tests do this.
  if (Autoupdate.autoupdateVersion === null)
    Autoupdate.autoupdateVersion =
      process.env.AUTOUPDATE_VERSION ||
      process.env.SERVER_ID || // XXX COMPAT 0.6.6
      WebApp.clientHashNonRefreshable;

  // Make autoupdateVersion available on the client.
  __meteor_runtime_config__.autoupdateVersion = Autoupdate.autoupdateVersion;

  if (autoupdateVersionRefreshable === null)
    autoupdateVersionRefreshable =
        process.env.AUTOUPDATE_VERSION ||
        process.env.SERVER_ID || // XXX COMPAT 0.6.6
        Random.id();
  console.log(autoupdateVersionRefreshable);
});

var publication;
Meteor.publish(
  "meteor_autoupdate_clientVersions",
  function () {
    console.log("running publish command");
    var self = publication = this;
    var shouldCallReady = false;
    // Using `autoupdateVersion` here is safe because we can't get a
    // subscription before webapp starts listening, and it doesn't do
    // that until the startup hooks have run.
    if (Autoupdate.autoupdateVersion) {
      self.added(
        "meteor_autoupdate_clientVersions",
        Autoupdate.autoupdateVersion,
        {refreshable: false, current: true}
      );
      shouldCallReady = true;
    } else {
      // huh? shouldn't happen. Just error the sub.
      self.error(new Meteor.Error(500, "Autoupdate.autoupdateVersion not set"));
    }

    if (autoupdateVersionRefreshable) {
      console.log("webAppAssets", WebApp.refreshableAssets);
      self.added(
        "meteor_autoupdate_clientVersions",
        autoupdateVersionRefreshable,
        {refreshable: true, current: true, assets: WebApp.refreshableAssets }
      );
      shouldCallReady = true;
    } else {
      // huh? shouldn't happen. Just error the sub.
      self.error(new Meteor.Error(500,
        "Autoupdate.autoupdateVersionRefreshable not set"));
    }

    if (shouldCallReady)
      self.ready();
  },
  {is_auto: true}
);


Meteor.methods({
  __meteor_update_client_assets: function () {
    WebApp._updateBoilerplateData(true);
    console.log(WebApp.refreshableAssets);
    publication.changed(
      "meteor_autoupdate_clientVersions",
      autoupdateVersionRefreshable,
      {refreshable: true, current: true, assets: WebApp.refreshableAssets }
    );
    publication.ready();
  }
});

# Atuin Desktop

Currently WIP, but it's being used!

## Running development

```
pnpm install
./script/dev
```

`script/dev` accepts the following options:

```
$ ./script/dev --help
Usage: script/dev [OPTIONS]

Options:
  -p --profile VALUE   Start with the given dev profile
  -s --no-sync         Start with automatic sync disabled
  -d --devtools        Start with devtools opened
  -h --help            Display this help message and exit
```

By default, the app will use the profile `dev`. You can pass a different profile name to use a different set of databases.

## Building a dmg

```
pnpm install
pnpm run tauri build
```

## Developer Tools

A global `app` object lives on the `window`. Items can be added to it via `DevConsole.addAppObject()`. The following items are currently available on the object:

* `app.useStore` - the store instance
* `app.state` - a proxy that forwards all property access to `useStore.getState()`
* `app.api` - API functions
* `app.invoke` - Tauri invoke function
* `app.serverObserver` - the server observer instance
* `app.socketManager` - the socket manager instance
* `app.notificationManager` - the notification manager instance
* `app.workspaceSyncManager` - the workspace sync manager instance
* `app.queryClient` - the React-Query client
* `app.AppBus` - the application bus instance
* `app.SSHBus` - the SSH bus instance
* `app.EditorBus` - the editor bus instance
* `app.BlockBus` - the block bus instance
* `app.SharedStateManager` - the shared state manager
* `app.models` - model classes (Runbook, Workspace, Operation)
* `app.handleDeepLink` - function to handle deep links
* `app.setHubCredentials` - function to set hub credentials in development
* `app.editor` - the BlockNote editor instance (when available)

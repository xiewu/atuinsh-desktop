# Contributing to Atuin Desktop

## Prerequisites

Developing on Atuin Desktop requires:

* Node.js 20.18.0 (see `.tool-versions` for most up-to-date information)
* [pnpm](https://pnpm.io/installation)
* Latest Rust stable

Since Atuin Desktop is a Tauri app, you'll also need all of the prerequisites listed in the [Tauri Prerequisites doc](https://tauri.app/start/prerequisites/) for your platform.

## Optional tools

For development, you may find it useful to have the following tools installed:

* [direnv](https://direnv.net/)

For documentation, you may find it useful to have the following tools installed:

* [uv](https://docs.astral.sh/uv/#installation)

## Installing dependencies

```
pnpm install
```

## Running development

```
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

## Building

### Building a binary (no packaging)

```
pnpm run tauri dev --no-bundle
```

### Building a package

```
pnpm run tauri build
```

### Regenerating TS-RS bindings from Rust structs

```
pnpm generate-bindings
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

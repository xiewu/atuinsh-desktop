import { me } from "@/api/api";
import Runbook, { RunbookFile } from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { fetch } from "@tauri-apps/plugin-http";

interface RouteHandler {
  (params: string[]): void;
}

interface Routes {
  [pattern: string]: RouteHandler;
}

const handleDeepLink = (navigate: any, url: string): void | null => {
  const routes: Routes = {
    // "Open in desktop" from the hub
    "^atuin://runbook/([\\w-]+)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$":
      async (params: string[]) => {
        const [username, id] = params;

        // Fetch the runbook from the hub api
        let resp = await fetch(
          `https://hub.atuin.sh/api/runbooks/${username}/${id}`,
        );
        let json = await resp.json();

        if (json.runbook?.content?.data)
          json.runbook.content = json.runbook.content.data;
        let runbook = await Runbook.importJSON(json.runbook as RunbookFile);

        useStore.getState().setCurrentRunbook(runbook);
        useStore.getState().refreshRunbooks();
        navigate("/runbooks");
      },

    // Register an auth token with this desktop app
    "^atuin://register-token/(atapi_[0-9A-F]+)$": async (params: string[]) => {
      const [token] = params;

      // Hit the "me" endpoint to verify the token and fetch username
      let user = await me(token);

      localStorage.setItem("proposedUsername", user.user.username);
      localStorage.setItem("proposedToken", token);

      useStore.getState().setDesktopConnect(true);
    },
  };

  // If no URL provided, return early
  if (!url) {
    return null;
  }

  // Try to match the URL against each route pattern
  for (const [pattern, handler] of Object.entries(routes)) {
    const regex = new RegExp(pattern, "i");
    const match = url.match(regex);

    if (match) {
      // Extract the captured groups (excluding the full match)
      const params = match.slice(1);

      try {
        return handler(params);
      } catch (error) {
        console.error(`Error handling route for URL ${url}:`, error);
        return null;
      }
    }
  }

  // No matching route found
  console.warn(`No matching route found for URL: ${url}`);
  return null;
};

export default handleDeepLink;

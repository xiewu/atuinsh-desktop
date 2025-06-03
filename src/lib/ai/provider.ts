// Setup the Blocknote AI Provider
// They use the next ai sdk
// Currently I'm thinking of taking the amp approach, and focus on a single model
// and making the experience with it great.
// Users will likely want to choose their own model though, but let's see how it goes.
import { createAnthropic } from "@ai-sdk/anthropic";

export const createModel = (key: string) => {
    const provider = createAnthropic({
        apiKey: key,

        headers: {
            // yes, we are a "browser"
            "anthropic-dangerous-direct-browser-access": "true",
        },
    });

    // https://docs.anthropic.com/en/docs/about-claude/models/overview
    const model = provider("claude-sonnet-4-20250514");

    return model;
};

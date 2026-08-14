import { describe, expect, it } from "vitest";
import { subscriptionChannelTopic } from "@/hooks/useSubscription";

const USER = "11111111-2222-3333-4444-555555555555";

describe("subscriptionChannelTopic", () => {
  it("gives each hook instance its own topic for the same user", () => {
    // /billing mounts useSubscription in the _attorney layout AND in the page.
    const layout = subscriptionChannelTopic(USER, ":r1:");
    const page = subscriptionChannelTopic(USER, ":r2:");
    expect(layout).not.toBe(page);
  });

  it("is stable for a given user + instance id", () => {
    expect(subscriptionChannelTopic(USER, ":r1:")).toBe(subscriptionChannelTopic(USER, ":r1:"));
  });

  it("scopes the topic to the user and strips unsafe characters", () => {
    const topic = subscriptionChannelTopic(USER, ":r7:");
    expect(topic.startsWith(`sub-${USER}-`)).toBe(true);
    expect(topic).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

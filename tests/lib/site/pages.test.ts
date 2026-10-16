import { describe, expect, it } from "vitest";
import { generateMetadata as debateMetadata } from "@/app/debates/[id]/page";
import { generateMetadata as transcriptMetadata } from "@/app/debates/[id]/transcript/page";
import { metadata as homeMetadata } from "@/app/page";

const DEBATE_ID = "11111111-1111-4111-8111-111111111111";
const params = () => Promise.resolve({ id: DEBATE_ID });

describe("page metadata", () => {
  it("P8 the home page is the one canonical URL", () => {
    expect(homeMetadata).toEqual({ alternates: { canonical: "/" } });
  });

  // A generated debate is a user's claim: previewable when shared, never in search results.
  // Only a title and noindex, so the root Open Graph tags and share card stay in place.
  it("P8 a debate page is titled by its id and stays out of search", async () => {
    expect(await debateMetadata({ params: params() })).toEqual({
      title: "debate 11111111",
      robots: { index: false },
    });
  });

  it("P8 a transcript page is titled by its id and stays out of search", async () => {
    expect(await transcriptMetadata({ params: params() })).toEqual({
      title: "transcript 11111111",
      robots: { index: false },
    });
  });
});

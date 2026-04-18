const BASE = "https://api.twitterapi.io/twitter";

export interface TwitterUser {
  id: string;
  userName: string;
  name: string;
  description?: string;
  followers?: number;
  following?: number;
  isBlueVerified?: boolean;
  profilePicture?: string;
}

export interface TwitterTweet {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
  quoteCount?: number;
  viewCount?: number;
  lang?: string;
  author: { id: string; userName: string; name: string; isBlueVerified?: boolean };
}

export interface AdvancedSearchResult {
  tweets: TwitterTweet[];
  has_next_page: boolean;
  next_cursor?: string;
}

export class TwitterApi {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("twitterapi.io key missing (set KODAMA_TWITTERAPI_KEY)");
  }

  async getUserByUsername(userName: string): Promise<TwitterUser | null> {
    const url = new URL(`${BASE}/user/info`);
    url.searchParams.set("userName", userName);
    const res = await this.fetch(url);
    const body = (await res.json()) as { status?: string; data?: TwitterUser };
    if (body?.status !== "success" || !body.data) return null;
    return body.data;
  }

  async advancedSearch(params: {
    query: string;
    queryType?: "Latest" | "Top";
    cursor?: string;
  }): Promise<AdvancedSearchResult> {
    const url = new URL(`${BASE}/tweet/advanced_search`);
    url.searchParams.set("query", params.query);
    url.searchParams.set("queryType", params.queryType ?? "Latest");
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    const res = await this.fetch(url);
    const body = (await res.json()) as AdvancedSearchResult;
    return {
      tweets: Array.isArray(body.tweets) ? body.tweets : [],
      has_next_page: Boolean(body.has_next_page),
      next_cursor: body.next_cursor
    };
  }

  async recentFromUser(userName: string, sinceUnix: number): Promise<TwitterTweet[]> {
    const parts = [`from:${userName}`, `since_time:${sinceUnix}`];
    const result = await this.advancedSearch({ query: parts.join(" "), queryType: "Latest" });
    return result.tweets;
  }

  private async fetch(url: URL): Promise<Response> {
    const res = await fetch(url, { headers: { "X-API-Key": this.apiKey } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`twitterapi.io ${res.status}: ${text.slice(0, 200)}`);
    }
    return res;
  }
}

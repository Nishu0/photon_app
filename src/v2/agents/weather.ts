import { createSdkMcpServer, tool, type Options } from "../ai/mcp";
import { z } from "zod";
import type { SubAgentDef } from "./base";
import { recordServiceCall, recordToolCall, type ObsContext } from "../observe";

export const WEATHER_AGENT_PROMPT = `you are the weather sub-agent inside kodama. you answer current conditions and short forecasts using the open-meteo api (no key required).

your tools:
- weather_now(location): current temperature, feels_like, conditions, wind, humidity.
- weather_forecast(location, days): daily highs/lows + conditions for the next N days (1-7).

rules:
- resolve the location via the geocoding tool inside weather_now / weather_forecast; if nothing matches say so plainly.
- default to celsius. if the owner mentioned fahrenheit in the request, pass unit="fahrenheit".
- the final reply back to the parent should be one short line like "bengaluru: 28° / humid / light breeze" or a 2-4 line forecast. never paste raw json.`;

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface GeocodeHit {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "rain showers",
  81: "rain showers",
  82: "violent showers",
  95: "thunderstorm",
  96: "thunderstorm w/ hail",
  99: "thunderstorm w/ hail"
};

function codeLabel(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? `code-${code}`;
}

async function geocode(location: string): Promise<GeocodeHit | null> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: GeocodeHit[] };
  return data.results?.[0] ?? null;
}

interface WeatherAgentDeps {
  obs?: ObsContext;
}

export function buildWeatherAgent(deps: WeatherAgentDeps = {}): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const obs: ObsContext = deps.obs ?? { userId: "unknown", agentName: "weather" };
  const wrap = <T>(toolName: string, input: unknown, fn: () => Promise<T>) =>
    recordToolCall({ ...obs, toolName, input }, fn);
  const callOpenMeteo = <T>(toolName: string, fn: () => Promise<T>) =>
    recordServiceCall({ ...obs, service: "open-meteo", toolName }, fn);

  const server = createSdkMcpServer({
    name: "kodama-weather",
    version: "1.0.0",
    tools: [
      tool(
        "weather_now",
        "Current conditions for a location.",
        {
          location: z.string().min(1).max(120),
          unit: z.enum(["celsius", "fahrenheit"]).default("celsius")
        },
        (args) =>
          wrap("weather_now", args, async () => {
            const hit = await callOpenMeteo("geocode", () => geocode(args.location));
            if (!hit) {
              return {
                content: [
                  { type: "text", text: JSON.stringify({ ok: false, error: `no match for "${args.location}"` }) }
                ]
              };
            }
            const url =
              `${FORECAST_URL}?latitude=${hit.latitude}&longitude=${hit.longitude}` +
              `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
              `&temperature_unit=${args.unit}&wind_speed_unit=kmh&timezone=auto`;
            const res = await callOpenMeteo("forecast.now", () => fetch(url));
            if (!res.ok) {
              return {
                content: [
                  { type: "text", text: JSON.stringify({ ok: false, error: `forecast ${res.status}` }) }
                ]
              };
            }
            const data = (await res.json()) as {
              current?: {
                temperature_2m: number;
                apparent_temperature: number;
                relative_humidity_2m: number;
                weather_code: number;
                wind_speed_10m: number;
              };
            };
            const c = data.current;
            if (!c) {
              return {
                content: [{ type: "text", text: JSON.stringify({ ok: false, error: "no current data" }) }]
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ok: true,
                    location: `${hit.name}${hit.admin1 ? ", " + hit.admin1 : ""}${hit.country ? ", " + hit.country : ""}`,
                    temperature: c.temperature_2m,
                    feels_like: c.apparent_temperature,
                    humidity_pct: c.relative_humidity_2m,
                    wind_kmh: c.wind_speed_10m,
                    conditions: codeLabel(c.weather_code),
                    unit: args.unit
                  })
                }
              ]
            };
          })
      ),
      tool(
        "weather_forecast",
        "Daily forecast for the next N days (1-7).",
        {
          location: z.string().min(1).max(120),
          days: z.number().int().min(1).max(7).default(3),
          unit: z.enum(["celsius", "fahrenheit"]).default("celsius")
        },
        (args) =>
          wrap("weather_forecast", args, async () => {
            const hit = await callOpenMeteo("geocode", () => geocode(args.location));
            if (!hit) {
              return {
                content: [
                  { type: "text", text: JSON.stringify({ ok: false, error: `no match for "${args.location}"` }) }
                ]
              };
            }
            const url =
              `${FORECAST_URL}?latitude=${hit.latitude}&longitude=${hit.longitude}` +
              `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
              `&temperature_unit=${args.unit}&forecast_days=${args.days}&timezone=auto`;
            const res = await callOpenMeteo("forecast.daily", () => fetch(url));
            if (!res.ok) {
              return {
                content: [
                  { type: "text", text: JSON.stringify({ ok: false, error: `forecast ${res.status}` }) }
                ]
              };
            }
            const data = (await res.json()) as {
              daily?: {
                time: string[];
                temperature_2m_max: number[];
                temperature_2m_min: number[];
                weather_code: number[];
                precipitation_probability_max: number[];
              };
            };
            const d = data.daily;
            if (!d) {
              return {
                content: [{ type: "text", text: JSON.stringify({ ok: false, error: "no daily data" }) }]
              };
            }
            const forecast = d.time.map((date, i) => ({
              date,
              high: d.temperature_2m_max[i],
              low: d.temperature_2m_min[i],
              conditions: codeLabel(d.weather_code[i] ?? 0),
              rain_chance_pct: d.precipitation_probability_max[i]
            }));
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ok: true,
                    location: `${hit.name}${hit.admin1 ? ", " + hit.admin1 : ""}${hit.country ? ", " + hit.country : ""}`,
                    unit: args.unit,
                    forecast
                  })
                }
              ]
            };
          })
      )
    ]
  });

  return {
    def: {
      name: "weather",
      systemPrompt: WEATHER_AGENT_PROMPT,
      allowedTools: [
        "mcp__kodama-weather__weather_now",
        "mcp__kodama-weather__weather_forecast"
      ]
    },
    mcpServers: { "kodama-weather": server }
  };
}

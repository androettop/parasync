import { Parser as ExprParser } from "expr-eval";
import { decode as decodeMsgPack } from "msgpackr";

type Config = {
  name: string;
  search_url: string;
  headers?: Record<string, string>[];
  response: {
    songs_array: string;
    serializer?: "none" | "msgpackr";
    fields: Record<string, string>;
  };
};

type SearchParams = {
  query: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
};

export class SongRepository {
  private config: Config;
  private exprParser: ExprParser;

  constructor(config: Config) {
    this.validateConfig();
    this.config = config;
    this.exprParser = new ExprParser();

    // Add custom functions
    this.exprParser.functions.case = (
      value: any,
      keys: any[],
      values: any[],
      fallback?: any,
    ) => {
      const index = keys.indexOf(value);
      return index >= 0
        ? values[index]
        : fallback !== undefined
          ? fallback
          : value;
    };

    this.exprParser.functions.encodeURIComponent = encodeURIComponent;
  }

  validateConfig() {
    // chequear los campos obligatorios.
    // Revisar que search_url sea una expresion (que comience con ~)
    // response.songs_array sea una expresion
    // fields solo contenga campos validos ["id", "title", "artist", "album", "duration", "coverUrl"]
    if (!this.config.name) {
      throw new Error("Repository name is required");
    }
    if (!this.config.search_url || !this.config.search_url.startsWith("~")) {
      throw new Error("search_url must be an expression starting with ~");
    }
    if (!this.config.response || !this.config.response.songs_array) {
      throw new Error(
        "response.songs_array is required and must be an expression starting with ~",
      );
    }
    if (
      !this.config.response.fields ||
      typeof this.config.response.fields !== "object"
    ) {
      throw new Error("response.fields must be an object with field mappings");
    }
    for (const field of Object.keys(this.config.response.fields)) {
      if (
        !["id", "title", "artist", "album", "duration", "coverUrl"].includes(
          field,
        )
      ) {
        throw new Error(`Invalid field "${field}" in response.fields`);
      }
    }
    if (
      this.config.response.serializer &&
      !["none", "msgpackr"].includes(this.config.response.serializer)
    ) {
      throw new Error(
        `Invalid serializer "${this.config.response.serializer}"`,
      );
    }
    if (this.config.headers) {
      for (const header of this.config.headers) {
        if (typeof header !== "object" || Object.keys(header).length !== 1) {
          throw new Error(
            "Each header must be an object with a single key-value pair",
          );
        }
        const key = Object.keys(header)[0];
        if (typeof key !== "string" || !key) {
          throw new Error("Header keys must be non-empty strings");
        }
        const value = header[key];
        if (typeof value !== "string") {
          throw new Error(`Header value for "${key}" must be a string`);
        }
      }
    }
  }

  async search(params: SearchParams): Promise<any[]> {
    const context = { ...(params || {}) };

    // evaluate search URL
    const url = this.evaluateField(this.config.search_url, context);
    if (typeof url !== "string") {
      throw new Error(`Invalid search URL, expected string, got ${typeof url}`);
    }

    // evaluate headers
    const headers: Record<string, string> = {};
    for (const header of this.config.headers || []) {
      const [key, rawValue] = Object.entries(header)[0];
      headers[key] = this.evaluateField(rawValue, context).toString();
    }

    // make request
    const response = await fetch(url, { headers });

    // deserialize response
    let data: any;
    if (this.config.response.serializer === "msgpackr") {
      const buffer = await response.arrayBuffer();
      data = decodeMsgPack(new Uint8Array(buffer));
    } else {
      data = await response.json();
    }

    // get songs array
    const items = this.evaluateField(this.config.response.songs_array, {
      response: data,
    });
    if (!Array.isArray(items)) {
      throw new Error(
        `Expected expression result to be an array, got ${typeof items}`,
      );
    }

    // map songs items
    return items.map((song: any) => {
      const result: Record<string, any> = {};
      for (const [field, expr] of Object.entries(this.config.response.fields)) {
        result[field] = this.evaluateField(expr, { song });
      }
      return result;
    });
  }

  private evaluateField(
    raw: string,
    context: Record<string, any>,
  ): string | number {
    if (typeof raw === "string" && raw.startsWith("~")) {
      const result = this.exprParser.evaluate(raw.slice(1), context);
      if (typeof result === "string" || typeof result === "number") {
        return result;
      } else {
        throw new Error(
          `Invalid expression result, expected string or number, got ${typeof result}`,
        );
      }
    }
    return raw;
  }
}

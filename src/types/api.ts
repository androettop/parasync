import { Song } from "./songs";

export type RepoConfig = {
  name: string;
  search_url: string;
  headers?: Record<string, string>[];
  response: {
    songs_array: string;
    serializer?: "none" | "msgpackr";
    fields: Record<string, string>;
  };
};

export type SearchParams = {
  query: string;
  page: number;
  pageSize: number;
  sortBy: keyof Song;
  sortDirection: "asc" | "desc";
};

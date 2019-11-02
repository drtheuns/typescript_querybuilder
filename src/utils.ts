import { Model } from "./Query";

export type PartialRequired<T, RequiredKeys extends keyof T> = Partial<T> &
  Required<Pick<T, RequiredKeys>>;

export type RequiredId<T extends Model> = PartialRequired<T, "id">;

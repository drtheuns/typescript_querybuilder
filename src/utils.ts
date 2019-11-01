export type PartialRequired<T, RequiredKeys extends keyof T> = Partial<T> &
  Required<Pick<T, RequiredKeys>>;

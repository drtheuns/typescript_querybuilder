import axios, { AxiosRequestConfig } from "axios";
import qs from "qs";

import { RequiredId } from "./types";
import { FilterBuilder } from "./Filter";

/**
 * A model must have an ID to support update/delete.
 */
export interface Model {
  id?: string;
}

/**
 * The possible sorting options.
 */
export type SortOrder = "asc" | "desc";

export enum Method {
  GET = "get",
  POST = "post",
  PUT = "put",
  PATCH = "patch",
  DELETE = "delete"
}

interface Sort {
  key: string;
  order: SortOrder;
}

export interface QueryParams {
  select: string | null;
  filter: string | null;
  limit: number | null;
  sort: Sort[];
  [key: string]: any; // Escape hatch for the queryParameter function.
}

/**
 * The response container that holds the API response.
 */
export interface ApiResponse<T> {
  data: T;
}

/*
 * The Select is a complex type that expresses a select statement on a model.
 *
 * For this select to work properly, all the models must inherit from Model.
 *
 * You may either select:
 *
 * 1. Everything with '*'
 * 2. Specific fields that are NOT models themselves.
 * 3. A related model and its fields using a tuple: ['relation_name', [fields]].
 *
 * When selecting specific attributes (point 2) it is not allowed to select an
 * attribute that has the type of a model itself. For example, with a User model
 * with attribute `posts: Post[]`, it will not be acceptable to select 'posts'.
 * Instead, to select anything like 'posts' (a related model), it must be done
 * using point 3.
 *
 * Related selects may be nested. Assuming a model like: User -> Posts -> Comments:
 *
 * ```typescript
 * new Query<User>()
 *   .select('*', ['posts', ['*', ['comments', ['body']]]]);
 * ```
 */
export type Select<T> = '*' | NonModelKeys<T> | TupleOfRelatedModels<T>;

// Gets all the keys on the type T which extend Model or Model[].
type ModelKeys<T> = Exclude<{ [K in keyof T]: T[K] extends Model | Model[] ? K : never }[keyof T], undefined>;
type NonModelKeys<T> = Exclude<keyof T, ModelKeys<T>>;

// GetModelType<Post[]> -> Post
// GetModelType<Post> -> Post
type GetModelType<T extends Model | Model[]> = T extends (infer U)[] ? U : T;
type TupleOfRelatedModels<T> = { [K in ModelKeys<T>]: [K, Select<GetModelType<T[K]>>[]] }[ModelKeys<T>];
// Circular ref in the Select above requires at least TS3.7

// The Select is only used for guarding against invalid use of the `select`
// function; however, it really is just the same type as the SimplifiedSelect
// below but with type checking.
type SimplifiedSelect = string | [string, SimplifiedSelect[]];

/**
 * Implements the API request builder.
 */
export class Query<T extends Model> {
  protected $queryParams: QueryParams;
  protected $headers: { [key: string]: string };
  protected $path = "";

  /**
   * `path` should be a relative path to the endpoint. See the `API_PATH` env
   * var for the base path.
   */
  public constructor(path: string) {
    this.$queryParams = {
      select: null,
      filter: null,
      limit: null,
      sort: []
    };
    this.$headers = {};
    this.$path = path;
  }

  /* ----------------------- Builder methods -----------------------*/

  /**
   * Set the filter for the request.
   *
   * ```typescript
   * new Query<User>()
   *   .filter((builder) => {
   *     return builder.where('name', 'John');
   *   })
   * ```
   */
  public filter(callback: (builder: FilterBuilder) => FilterBuilder | void): this {
    let builder = new FilterBuilder();
    callback(builder);
    this.queryParameter("filter", builder.build());

    return this;
  }

  /**
   * Select the fields you want returned from the API.
   *
   * ```typescript
   * new Query<User>()
   *   .select('*', ['posts', '*'])
   * ```
   *
   * If you're getting a type error when selecting something, check that the
   * field / relationship you're selecting is actually defined on your model.
   */
  public select(fields: Select<T>[]): this {
    this.$queryParams.select = this.buildSelect(<SimplifiedSelect[]>fields);

    return this;
  }

  private buildSelect(fields: SimplifiedSelect[]): string {
    return fields.map((value) => {
      return typeof value === "string"
        ? value
        : `${value[0]}(${this.buildSelect(value[1])})`;
    }).join(',');
  }

  /**
   * Adds a select to the query without validation.
   *
   * Prefer the select/1 function because this adds compile time checks if the
   * right fields are selected.
   */
  public rawSelect(select: string): this {
    this.$queryParams.select = select;

    return this;
  }

  /**
   * Adds a limit to the number of returned results.
   *
   * Translates to: /resource?limit=n
   */
  public limit(n: number): this {
    this.$queryParams.limit = n;

    return this;
  }

  /**
   * Escape hatch to pass in any kind of query parameters to be send with the
   * request.
   */
  public queryParameter(key: string, value: string | string[]): this {
    this.$queryParams[key] = value;

    return this;
  }

  /**
   * Set a custom header for the request.
   */
  public header(name: string, value: string): this {
    this.$headers[name] = value;

    return this;
  }

  /**
   * Set custom headers for the request. This will override any existing headers
   * by the same name.
   */
  public headers(headers: { [key: string]: string }): this {
    this.$headers = { ...this.$headers, ...headers };

    return this;
  }

  /**
   * Add a sort key to the query.
   *
   * Translates to: /resource?sort[]=key&sort[]=!key2
   */
  public sort(key: string, order: SortOrder): this {
    this.$queryParams.sort.push({ key: key, order: order });

    return this;
  }

  /* ----------------------- The actual API calls -----------------------*/

  /**
   * Get a list of the resource.
   *
   * Performs a GET call to the model's endpoint (e.g. GET /users).
   */
  public list(): Promise<T[]> {
    return this.request<T[]>(Method.GET, this.getPath());
  }

  /**
   * Get a single instance of the resource.
   *
   * Performs a GET call to the model's endpoint (e.g. GET /users/<id>).
   */
  public get(id: string): Promise<T> {
    return this.request<T>(Method.GET, this.getPath(id));
  }

  /**
   * Create a new resource.
   *
   * Performs a POST call to the model's endpoint (e.g. POST /users).
   */
  public create(data: Partial<T>): Promise<T> {
    return this.request<T>(Method.POST, this.getPath(), { data: data });
  }

  /**
   * Update an existing resource.
   *
   * Performs a PATCH call to the model's endpoint (e.g. PATCH /users/id).
   *
   * The `id` field on the model is required to be able to call the correct
   * endpoint (`RequiredId`).
   */
  public update(data: RequiredId<T>): Promise<T> {
    return this.request<T>(Method.PATCH, this.getPath(data.id), { data: data });
  }

  /**
   * Deletes an existing resource.
   *
   * Performs a DELETE call to the model's endpoint (e.g. DELETE /users/id).
   *
   * The `id` field on the model is required to be able to call the correct
   * endpoint (`RequiredId`).
   */
  public delete(model: RequiredId<T>): Promise<void> {
    return this.request<void>(Method.DELETE, this.getPath(model.id));
  }

  protected getPath(id?: string): string {
    let path = (process.env.API_PATH + this.$path).replace(/\/+$/, "");

    return id ? path + "/" + id : path;
  }

  protected formatSort(sorts: Sort[]) {
    return sorts.map(sort => {
      switch (sort.order) {
        case "asc":
          return sort.key;
        case "desc":
          return "!" + sort.key;
      }
    });
  }

  public request<Response>(
    method: Method,
    url: string,
    options?: Partial<AxiosRequestConfig>
  ): Promise<Response> {
    // The sorts must be pre-processed to a format the API understands.
    let queryParams = {
      ...this.$queryParams,
      ...{ sort: this.formatSort(this.$queryParams.sort) }
    };

    return axios
      .request<ApiResponse<Response>>({
        url: url,
        method: method,
        params: queryParams,
        paramsSerializer: (params: any) => {
          return qs.stringify(params, {
            arrayFormat: "brackets",
            skipNulls: true
          });
        },
        headers: this.$headers,
        ...(options ? options : [])
      })
      .then(response => {
        return response.data.data;
      });
  }
}

import { PartialRequired } from "./utils";
import axios, { AxiosRequestConfig } from "axios";
import qs from "qs";

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

type QueryParamObj = { [key: string]: string | string[] };

export interface QueryParams {
  includes: string[];
  filters: QueryParamObj;
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

/**
 * Implements the API request builder.
 *
 * The goal of this class is to simplify writing of menial queries against the API.
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
      includes: [],
      filters: {},
      limit: null,
      sort: []
    };
    this.$headers = {};
    this.$path = path;
  }

  /* ----------------------- Builder methods -----------------------*/

  /**
   * Add a list of resources that should be included to the request.
   *
   * Translates to: /resource?include[]=name1&include[]=name2
   */
  public include(includes: string[]): this {
    this.$queryParams.include = [...this.$queryParams.include, ...includes];

    return this;
  }

  /**
   * Add a filter to the request.
   *
   * Translates to: /resource?filters[key]=value
   * or: /resource?filters[key][]=value&filters[key][]=value2
   */
  public filter(key: string, value: string | string[]): this {
    this.$queryParams.filters[key] = value;

    return this;
  }

  /**
   * Add many filters at once. See `filter/2`
   */
  public filters(filters: QueryParamObj) {
    for (let key in filters) {
      this.$queryParams.filters[key] = filters[key];
    }

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
   * endpoint (`PartialRequired`).
   */
  public update(data: PartialRequired<T, "id">): Promise<T> {
    return this.request<T>(Method.PATCH, this.getPath(data.id), { data: data });
  }

  /**
   * Deletes an existing resource.
   *
   * Performs a DELETE call to the model's endpoint (e.g. DELETE /users/id).
   *
   * The `id` field on the model is required to be able to call the correct
   * endpoint (`PartialRequired`).
   */
  public delete(model: PartialRequired<T, "id">): Promise<void> {
    return this.request<any>(Method.DELETE, this.getPath(model.id));
  }

  /* ----------------------- Impl stuff -----------------------*/

  protected getPath(id?: string): string {
    let path = (process.env.API_PATH + this.$path).replace(/\/+$/, "");

    return id ? path + "/" + id : path;
  }

  protected formatSort(sorts: Sort[]) {
    sorts.map(sort => {
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

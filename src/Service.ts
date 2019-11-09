import { Query, Model } from "./Query";

/**
 * Generates a class that can quickly generate typesafe queries.
 *
 * ## Usage:
 *
 * ```typescript
 * interface User extends Model { name: string }
 *
 * const UserService = GenericApiService<User>("/users");
 *
 * UserService.query();
 * ```
 *
 * If you want to add your own methods, simply extend the anonymous class that
 * is returned by this service:
 *
 * ```typescript
 * class UserService extends GenericApiService<User>("/users") {
 *   public myMethod(): void {}
 * }
 * ```
 */
export function GenericApiService<T extends Model>(apiPath: string) {
  return class {
    public static query(): Query<T> {
      return new Query<T>(this.getPath());
    }

    public static getPath(): string {
      return apiPath;
    }
  }
}

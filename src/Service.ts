import { Query, Model } from "./Query";
import { PartialRequired } from "./utils";

/**
 * Implement some default API methods
 *
 * The business logic of the models should be placed in implementations of this
 * class.
 *
 * ## Usage
 *
 * Create a class that implements this class. Set the path on that model,
 * which is used as the path for the API call.
 *
 * ```typescript
 * interface User extends Model {
 *   name: string;
 * }
 *
 * class UserService extends GenericService<User> {
 *   protected path: string = "/users";
 * }
 * ```
 *
 * Now we can query this service.
 *
 * ```typescript
 * let userService = new UserService();
 *
 * let x: Promise<User[]> = userService.list();
 * let y: Promise<User> = userService.get(1);
 *
 * userService.create({name: "John Doe"});
 * ```
 */
export abstract class GenericApiService<T extends Model> {
  protected path: string = "";

  public query(): Query<T> {
    return new Query<T>(this.path);
  }

  public list(): Promise<T[]> {
    return this.query().list();
  }

  public get(id: string): Promise<T> {
    return this.query().get(id);
  }

  public create(data: Partial<T>): Promise<T> {
    return this.query().create(data);
  }

  public update(data: PartialRequired<T, "id">) {
    return this.query().update(data);
  }

  public delete(data: PartialRequired<T, "id">) {
    return this.query().delete(data);
  }
}

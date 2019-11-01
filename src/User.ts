import { Model } from "./Query";
import { GenericApiService } from "./Service";

export interface User extends Model {
  name: string;
  email: string;
}

export class UserService extends GenericApiService<User> {
  protected path: string = "/users";
}

import { Model } from "./Query";
import { GenericApiService } from "./Service";

export interface User extends Model {
  name: string;
  email: string;
}

export const UserService = GenericApiService<User>("/users");

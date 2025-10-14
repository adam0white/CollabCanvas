export class DurableObject {
  state: unknown;
  env: unknown;

  constructor(state: unknown, env: unknown) {
    this.state = state;
    this.env = env;
  }
}

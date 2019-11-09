export interface AndOrExpression {
  type: AndOr,
  expressions: Array<Expression | AndOrExpression>;
}

export interface Expression {
  key: string;
  operator: Operator;
  value: Value;
}

export type Operator = 'eq' | 'neq' | 'gte' | 'gt' | 'lte' | 'lt' | 'search' | 'ilike' | 'like' | 'contains' | 'in';
export type Value = string | string[] | number | number[] | boolean;
export type BuilderCallback = (builder: FilterBuilder) => FilterBuilder | void;
export type AndOr = 'and' | 'or';

function escape(str: string) {
  return (str + '')
    .replace(/[\\"]/g, '\\$&')
    .replace(/\u0000/g, '\\0')
}

/**
 * The goal of this builder is to support the complex filtering that is allowed
 * by the API.
 *
 * For example, the following query:
 *
 * GET /users?filter=id.in.(1,2,3,4,5), or(active.eq.true, created_at.gte.2019-01-01)
 *
 * Could be written in the builder as:
 *
 * ```typescript
 * new FilterBuilder()
 *   .where('id', 'in', [1,2,3,4,5])
 *   .or((builder) => {
 *     return builder
 *       .where('active', 'eq', true)
 *       .where('created_at', 'gte', '2019-01-01');
 *   })
 * ```
 *
 * This is a very LISP-like syntax:
 *
 * ```lisp
 * (and
 *   ("id" 'in '(1 2 3 4 5))
 *   (or (("active" 'eq true)
 *        ("created_at", 'gte, "2019-01-01"))))
 * ```
 *
 * If the first expressions is `or`, then the top-most filter will become "or"
 * too:
 *
 * ```
 * new FilterBuilder()
 *   .or((builder) => {
 *     return builder
 *       .where('name', 'eq', 'John')
 *       .where('age', 'gt', '18');
 *   })
 *   .build();
 *
 * // ?select=or(name.eq."John",age.gt.18)
 * ```
 */
export class FilterBuilder {
  protected and_or: 'and' | 'or';
  protected expressions: (Expression | FilterBuilder)[] = [];

  constructor(and_or?: AndOr) {
    this.and_or = (and_or === undefined) ? 'and' : and_or;
  }

  /**
   * Adds an "OR" expression to the query.
   *
   * This will "OR" all the expressions that were added to the builder in the
   * callback.
   *
   * Note that this has nothing to do with any previous where clauses.
   */
  public or(callback: BuilderCallback): this {
    this.addBooleanExpr('or', callback);

    return this;
  }

  /**
   * Adds an "AND" expression to the query.
   *
   * This will "AND" all the expressions that were added to the builder in the
   * callback.
   *
   * Note that this has nothing to do with any previous where clauses.
   */
  public and(callback: BuilderCallback): this {
    this.addBooleanExpr('and', callback);

    return this;
  }

  private addBooleanExpr(expr_type: 'and' | 'or', callback: BuilderCallback) {
    if (this.expressions.length == 0) {
      this.and_or = expr_type;
      callback(this);
    } else {
      let builder = new FilterBuilder(expr_type);
      callback(builder);
      this.expressions.push(builder);
    }
  }


  public where(key: string, value: string | number | boolean) {
    return this.addExpression(key, 'eq', value);
  }

  public whereNot(key: string, value: string | number | boolean) {
    return this.addExpression(key, 'neq', value);
  }

  public whereGte(key: string, value: number) {
    return this.addExpression(key, 'gte', value);
  }

  public whereGt(key: string, value: number) {
    return this.addExpression(key, 'gt', value);
  }

  public whereLte(key: string, value: number) {
    return this.addExpression(key, 'lte', value);
  }

  public whereLt(key: string, value: number) {
    return this.addExpression(key, 'lt', value);
  }

  public whereLike(key: string, value: string) {
    return this.addExpression(key, 'like', value);
  }

  public whereILike(key: string, value: string) {
    return this.addExpression(key, 'ilike', value);
  }

  public whereSearch(key: string, value: string) {
    return this.addExpression(key, 'search', value);
  }

  public whereContains(key: string, value: string | number) {
    return this.addExpression(key, 'contains', value);
  }

  public whereIn(key: string, values: string[] | number[]) {
    return this.addExpression(key, 'in', values);
  }

  // Public to allow for possibly automated use of the builder based on data structures.
  public addExpression(key: string, operator: Operator, value: Value): this {
    this.expressions.push({ key: key, operator: operator, value: value });

    return this;
  }

  /**
   * Builds the final query based on all the conditions.
   *
   * If the value of the expression is a string, then it will be quoted in the
   * resulting query.
   */
  public build(): string {
    if (this.expressions.length == 0) {
      return '';
    }

    let exprs = this.expressions.map((expr) => {
      return (expr instanceof FilterBuilder)
        ? expr.build()
        : this.buildExpression(expr);
    }).join(',')

    return `${this.and_or}(${exprs})`;
  }

  private buildExpression(expression: Expression) {
    let value = Array.isArray(expression.value)
      ? `(${expression.value.join(',')})`
      : (typeof expression.value == "string" ? `"${escape(expression.value)}"` : expression.value);

    return `${expression.key}.${expression.operator}.${value}`;
  }

}

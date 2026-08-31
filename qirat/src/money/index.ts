/**
 * Every piece of money arithmetic in Qirat lives here and nowhere else.
 *
 * Nothing in this directory imports from the database, the network, React, or
 * the request. It is pure, synchronous and total: given the same inputs it
 * returns the same outputs or throws a named error. That is what makes it
 * testable to the degree a payout engine has to be tested.
 *
 * If you find yourself writing `* 0.5` or `parseFloat` in a component, the
 * function you want belongs in this module instead.
 */
export * from './currency';
export * from './rounding';
export * from './money';
export * from './allocate';
export * from './fx';
export * from './margin';
export * from './costs';
export * from './format';

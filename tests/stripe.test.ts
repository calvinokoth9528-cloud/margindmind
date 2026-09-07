import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PLANS } from '../lib/stripe.ts';

describe('PLANS configuration', () => {
  it('defines all four plans', () => {
    assert.deepEqual(Object.keys(PLANS).sort(), ['ENTERPRISE', 'FREE', 'PRO', 'STARTER']);
  });

  it('FREE plan has no price and the lowest limits', () => {
    const free = PLANS.FREE;
    assert.equal(free.price, 0);
    assert.equal(free.orderLimit, 100);
    assert.equal(free.shopLimit, 1);
  });

  it('limits scale up with price', () => {
    const starter = PLANS.STARTER;
    const pro = PLANS.PRO;
    const enterprise = PLANS.ENTERPRISE;

    assert.ok(starter.price < pro.price);
    assert.ok(pro.price < enterprise.price);

    assert.ok(starter.shopLimit > PLANS.FREE.shopLimit);
    assert.ok(pro.shopLimit > starter.shopLimit);
    assert.equal(pro.orderLimit, -1); // unlimited
    assert.equal(enterprise.shopLimit, -1); // unlimited
  });

  it('every paid plan has a features list with entries', () => {
    for (const [id, plan] of Object.entries(PLANS)) {
      assert.ok(plan.features.length > 0, `${id} should list features`);
      assert.equal(plan.interval, 'month');
    }
  });
});
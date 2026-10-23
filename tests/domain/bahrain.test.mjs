import assert from "node:assert/strict";
import { normalizeBahrainPhone } from "../../src/domain/bahrain.mjs";

assert.equal(normalizeBahrainPhone("12345678"), "+97312345678");
assert.equal(normalizeBahrainPhone("+973 1234 5678"), "+97312345678");
assert.equal(normalizeBahrainPhone("97312345678"), "+97312345678");
assert.equal(normalizeBahrainPhone("097312345"), null, "non-BH prefix rejected");
assert.equal(normalizeBahrainPhone("+971234567"), null, "7-digit rejected");
console.log("bahrain: 5 assertions passed");

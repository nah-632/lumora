import assert from "node:assert/strict";
import { formatBhd, computeVatFils, FILS_PER_BHD } from "../../src/domain/money.mjs";

assert.equal(FILS_PER_BHD, 1000);
assert.equal(computeVatFils(10000, 1000), 1000, "10% VAT of 10.000 fils = 1000");
assert.equal(computeVatFils(10000, 0), 0, "unverified VAT = 0");
assert.equal(formatBhd(1500, "en"), "BHD 1.500");
assert.equal(formatBhd(1500, "ar"), "1.500 د.ب");
console.log("money: 5 assertions passed");

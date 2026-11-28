/*  Formato es-AR de montos y cotizaciones (mensajes de error y mails). */

import { describe, expect, it } from "vitest";
import { formatAmount, formatRate } from "../../src/utils/format";

describe("formatAmount", () => {
    it.each([
        [1_600_000, "1.600.000"],
        [857_142.85, "857.142,85"],
        [10.5, "10,50"],
        [0.01, "0,01"],
        ["1600000000.00", "1.600.000.000"],
        ["857142.85", "857.142,85"],
    ])("%s → %s", (value, expected) => {
        expect(formatAmount(value)).toBe(expected);
    });
});

describe("formatRate", () => {
    it.each([
        [1605.5, "1.605,5"],
        [3800, "3.800"],
        [0.914495, "0,914495"],
        [1.0934996910863373, "1,0935"],
        [0.000622858922454, "0,000622859"],
    ])("%s → %s", (rate, expected) => {
        expect(formatRate(rate)).toBe(expected);
    });
});
